import {
    AbstractAuthModuleProvider,
    AbstractEventBusModuleService,
    MedusaError,
} from "@medusajs/framework/utils";
import {
    AuthIdentityProviderService,
    AuthenticationInput,
    ICacheService,
    AuthenticationResponse,
    AuthIdentityDTO,
} from "@medusajs/framework/types";
import { Logger } from "@medusajs/framework/types";
import EventBusService from "@medusajs/test-utils/dist/mock-event-bus-service";
import jwt from "jsonwebtoken";

type Options = {
    jwtSecret: string;
};

type InjectedDependencies = {
    logger: Logger;
    event_bus: AbstractEventBusModuleService;
    cache: ICacheService;
};

type OTPResendState = {
    count: number;
    nextAllowedAt: number;
};

const unwrapCacheValue = (rawState: unknown): unknown => {
    if (!rawState || typeof rawState !== "object") {
        return rawState;
    }

    const maybeWrapped = rawState as Record<string, unknown>;
    if ("value" in maybeWrapped) {
        return maybeWrapped.value;
    }

    if ("data" in maybeWrapped) {
        return maybeWrapped.data;
    }

    return rawState;
};

const normalizeEmailForCacheKey = (email: string): string =>
    email.trim().toLowerCase();

class OTPAuthProvider extends AbstractAuthModuleProvider {
    static DISPLAY_NAME = "Basic OTP Auth";
    static identifier = "otp-auth";
    protected logger: Logger;
    protected options: Options;
    protected event_bus: EventBusService;
    protected cacheService: ICacheService;
    // assuming you're initializing a client

    constructor(container: InjectedDependencies, options: Options) {
        //@ts-ignore
        super(...arguments);

        this.options = options;
        this.logger = container.logger;
        this.event_bus = container.event_bus;
        this.cacheService = container.cache;

        // assuming you're initializing a client
    }

    static validateOptions(options: Record<any, any>): void | never {
        if (!options.jwtSecret) {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "JWT secret is required",
            );
        }
    }

    private getResendStateCacheKey(email: string): string {
        return `otp:resend-state:${normalizeEmailForCacheKey(email)}`;
    }

    private getCooldownByCount(count: number): number {
        if (count <= 3) {
            return 0;
        }

        if (count <= 6) {
            return 60;
        }

        if (count <= 9) {
            return 300;
        }

        return -1;
    }

    private async getResendState(email: string): Promise<OTPResendState> {
        const rawState = await this.cacheService.get(
            this.getResendStateCacheKey(email),
        );
        const state = unwrapCacheValue(rawState);

        if (!state) {
            return {
                count: 0,
                nextAllowedAt: 0,
            };
        }

        if (Buffer.isBuffer(state)) {
            try {
                const parsed = JSON.parse(
                    state.toString("utf-8"),
                ) as Partial<OTPResendState>;
                return {
                    count: Number(parsed.count) || 0,
                    nextAllowedAt: Number(parsed.nextAllowedAt) || 0,
                };
            } catch {
                return {
                    count: 0,
                    nextAllowedAt: 0,
                };
            }
        }

        if (typeof state === "string") {
            try {
                const parsed = JSON.parse(state) as Partial<OTPResendState>;
                return {
                    count: Number(parsed.count) || 0,
                    nextAllowedAt: Number(parsed.nextAllowedAt) || 0,
                };
            } catch {
                return {
                    count: 0,
                    nextAllowedAt: 0,
                };
            }
        }

        const parsed = state as Partial<OTPResendState>;
        return {
            count: Number(parsed.count) || 0,
            nextAllowedAt: Number(parsed.nextAllowedAt) || 0,
        };
    }

    private async saveResendState(
        email: string,
        state: OTPResendState,
    ): Promise<void> {
        await this.cacheService.set(
            this.getResendStateCacheKey(email),
            JSON.stringify(state),
            60 * 60,
        );
    }

    async authenticate(
        data: AuthenticationInput,
        authIdentityProviderService: AuthIdentityProviderService,
    ): Promise<AuthenticationResponse> {
        const { email } = data.body || {};
        if (!email) {
            return {
                success: false,
                location: "email",
                error: "Укажите email",
            };
        }

        try {
            await authIdentityProviderService.retrieve({
                entity_id: email,
            });
        } catch (error) {
            return {
                success: false,
                location: "email",
                error: "Пользователь с таким email не существует",
            };
        }

        const resendState = await this.getResendState(email);
        const now = Date.now();

        if (resendState.nextAllowedAt > now) {
            const waitSeconds = Math.ceil(
                (resendState.nextAllowedAt - now) / 1000,
            );

            return {
                success: false,
                location: "error",
                error: JSON.stringify({
                    message: `Повторная отправка будет доступна через ${waitSeconds} сек.`,
                    retry: resendState.nextAllowedAt,
                    code: 429,
                }),
            };
        }

        const nextCount = resendState.count + 1;
        const cooldown = this.getCooldownByCount(nextCount);

        if (cooldown < 0) {
            return {
                success: false,
                location: "otp",
                error: "Достигнут лимит отправки кодов. Попробуйте позже.",
            };
        }

        const { hashedOTP, otp } = await this.generateOTP();

        await authIdentityProviderService.update(email, {
            provider_metadata: {
                otp: hashedOTP,
            },
        });

        await this.saveResendState(email, {
            count: nextCount,
            nextAllowedAt: now + cooldown * 1000,
        });

        await this.event_bus.emit(
            {
                name: "email-auth.otp.generated",
                data: {
                    otp,
                    email,
                },
            },
            {},
        );

        return {
            success: true,
            location: "otp",
        };
    }

    async generateOTP(): Promise<{ hashedOTP: string; otp: string }> {
        // Generate a 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // for debug
        this.logger.info(`Generated OTP: ${otp}`);

        const hashedOTP = jwt.sign({ otp }, this.options.jwtSecret, {
            expiresIn: "60s",
        });

        return { hashedOTP, otp };
    }

    async validateCallback(
        data: AuthenticationInput,
        authIdentityProviderService: AuthIdentityProviderService,
    ): Promise<AuthenticationResponse> {
        const { email, otp } = data.query || {};

        const isAfterRegister = await this.cacheService.get(
            `otp:after-register:${email}`,
        );
        if (isAfterRegister) {
            await this.cacheService.invalidate(`otp:after-register:${email}`);

            const user = await authIdentityProviderService.retrieve({
                entity_id: email,
            });
            return {
                success: true,
                authIdentity: user,
            };
        }

        if (!email || !otp) {
            return {
                success: false,
                error: "Email или код подтверждения не указаны",
            };
        }

        const user = await authIdentityProviderService.retrieve({
            entity_id: email,
        });

        if (!user) {
            return {
                success: false,
                location: "email",
                error: "Пользователь с таким email не найден",
            };
        }

        // verify that OTP is correct
        const userProvider = user.provider_identities?.find(
            (provider) => provider.provider === this.identifier,
        );
        if (!userProvider || !userProvider.provider_metadata?.otp) {
            return {
                success: false,
                location: "email",
                error: "Пользователь с таким email не имеет email auth provider",
            };
        }

        try {
            const decodedOTP = jwt.verify(
                userProvider.provider_metadata.otp as string,
                this.options.jwtSecret,
            ) as { otp: string };

            if (decodedOTP.otp !== otp) {
                throw new Error("Invalid OTP");
            }
        } catch (error) {
            return {
                success: false,
                location: "otp",
                error: error.message || "Invalid OTP",
            };
        }

        const updatedUser = await authIdentityProviderService.update(email, {
            provider_metadata: {
                otp: null,
            },
        });
        await this.cacheService.invalidate(this.getResendStateCacheKey(email));

        return {
            success: true,
            authIdentity: updatedUser,
        };
    }

    async register(
        data: AuthenticationInput,
        authIdentityProviderService: AuthIdentityProviderService,
    ): Promise<AuthenticationResponse> {
        const { email } = data.body || {};
        if (!email) {
            return {
                success: false,
                location: "email",
                error: "Email не указан",
            };
        }
        if (!data.body?.otp) {
            return {
                success: false,
                location: "otp",
                error: "Код не указан",
            };
        }

        const otp = await this.cacheService.get(`otp:pre-register:${email}`);
        if (otp !== data.body?.otp) {
            return {
                success: false,
                location: "otp",
                error: "Неверный код",
            };
        }

        let authIdentity: AuthIdentityDTO | undefined;

        try {
            authIdentity = await authIdentityProviderService.retrieve({
                entity_id: email,
            });
        } catch (error) {
            if (!(error instanceof MedusaError))
                return { success: false, error: JSON.stringify(error) };
            if (error.type !== MedusaError.Types.NOT_FOUND)
                return { success: false, error: error.message };

            authIdentity = await authIdentityProviderService.create({
                entity_id: email,
                user_metadata: data.body,
            });
        }

        await this.cacheService.set(`otp:after-register:${email}`, "1", 60 * 5);

        return {
            success: true,
            authIdentity,
        };
    }
}

export default OTPAuthProvider;
