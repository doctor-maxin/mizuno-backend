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

    private getVerifyStateCacheKey(email: string): string {
        return `otp:verify-state:${normalizeEmailForCacheKey(email)}`;
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

    private async getVerifyState(email: string): Promise<OTPResendState> {
        const rawState = await this.cacheService.get(
            this.getVerifyStateCacheKey(email),
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

    private async saveVerifyState(
        email: string,
        state: OTPResendState,
    ): Promise<void> {
        await this.cacheService.set(
            this.getVerifyStateCacheKey(email),
            JSON.stringify(state),
            60 * 60,
        );
    }

    async authenticate(
        data: AuthenticationInput,
        authIdentityProviderService: AuthIdentityProviderService,
    ): Promise<AuthenticationResponse> {
        const { email } = data.body || {};
        this.logger.info(
            `[otp-auth][request] authenticate:start email=${email ?? "unknown"}`,
        );
        if (!email) {
            this.logger.warn("[otp-auth][request] email is missing");
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
            this.logger.warn(
                `[otp-auth][request] auth identity not found email=${email}`,
            );
            return {
                success: false,
                location: "email",
                error: "Пользователь с таким email не существует",
            };
        }

        const resendState = await this.getResendState(email);
        const now = Date.now();
        this.logger.info(
            `[otp-auth][request] resend-state email=${email} count=${resendState.count} nextAllowedAt=${resendState.nextAllowedAt} now=${now}`,
        );

        if (resendState.nextAllowedAt > now) {
            const waitSeconds = Math.ceil(
                (resendState.nextAllowedAt - now) / 1000,
            );
            this.logger.warn(
                `[otp-auth][request] throttled email=${email} waitSeconds=${waitSeconds}`,
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
        this.logger.info(
            `[otp-auth][request] nextCount=${nextCount} cooldown=${cooldown}s email=${email}`,
        );

        if (cooldown < 0) {
            this.logger.warn(
                `[otp-auth][request] hard limit reached email=${email} count=${nextCount}`,
            );
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
        await this.cacheService.invalidate(this.getVerifyStateCacheKey(email));
        this.logger.info(
            `[otp-auth][request] resend-state saved email=${email} count=${nextCount} nextAllowedAt=${now + cooldown * 1000} verify-state reset`,
        );

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
            expiresIn: "5m",
        });

        return { hashedOTP, otp };
    }

    async validateCallback(
        data: AuthenticationInput,
        authIdentityProviderService: AuthIdentityProviderService,
    ): Promise<AuthenticationResponse> {
        const { email, otp } = data.query || {};
        this.logger.info(
            `[otp-auth][callback] validate:start email=${email ?? "unknown"} otpProvided=${Boolean(otp)}`,
        );

        const isAfterRegister = await this.cacheService.get(
            `otp:after-register:${email}`,
        );
        if (isAfterRegister) {
            this.logger.info(
                `[otp-auth][callback] after-register shortcut email=${email}`,
            );
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
            this.logger.warn(
                `[otp-auth][callback] missing credentials email=${email ?? "unknown"} otpProvided=${Boolean(otp)}`,
            );
            return {
                success: false,
                error: "Email или код подтверждения не указаны",
            };
        }

        const resendState = await this.getResendState(email);
        const verifyState = await this.getVerifyState(email);
        const now = Date.now();
        this.logger.info(
            `[otp-auth][callback] resend-state email=${email} count=${resendState.count} nextAllowedAt=${resendState.nextAllowedAt} now=${now}`,
        );
        this.logger.info(
            `[otp-auth][callback] verify-state email=${email} count=${verifyState.count} nextAllowedAt=${verifyState.nextAllowedAt} now=${now}`,
        );

        if (verifyState.nextAllowedAt > now) {
            const waitSeconds = Math.ceil(
                (verifyState.nextAllowedAt - now) / 1000,
            );
            this.logger.warn(
                `[otp-auth][callback] throttled email=${email} waitSeconds=${waitSeconds}`,
            );
            return {
                success: false,
                location: "otp",
                error: JSON.stringify({
                    type: "not_allowed",
                    message: `Повторная проверка будет доступна через ${waitSeconds} сек.`,
                    retry: verifyState.nextAllowedAt,
                    code: 429,
                }),
            };
        }

        const user = await authIdentityProviderService.retrieve({
            entity_id: email,
        });

        if (!user) {
            this.logger.warn(
                `[otp-auth][callback] user not found email=${email}`,
            );
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
            this.logger.warn(
                `[otp-auth][callback] provider metadata otp missing email=${email}`,
            );
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
            this.logger.info(
                `[otp-auth][callback] otp verified successfully email=${email}`,
            );
        } catch (error) {
            const nextVerifyCount = verifyState.count + 1;
            const verifyCooldown = this.getCooldownByCount(nextVerifyCount);
            const nextAllowedAt =
                verifyCooldown > 0 ? now + verifyCooldown * 1000 : 0;

            if (verifyCooldown >= 0) {
                await this.saveVerifyState(email, {
                    count: nextVerifyCount,
                    nextAllowedAt,
                });
                this.logger.warn(
                    `[otp-auth][callback] verify-state saved email=${email} count=${nextVerifyCount} nextAllowedAt=${nextAllowedAt}`,
                );
            } else {
                await this.saveVerifyState(email, {
                    count: nextVerifyCount,
                    nextAllowedAt: now + 60 * 60 * 1000,
                });
                this.logger.warn(
                    `[otp-auth][callback] verify hard limit reached email=${email} count=${nextVerifyCount}`,
                );
            }

            this.logger.warn(
                `[otp-auth][callback] verification failed email=${email} error=${
                    error instanceof Error ? error.message : "unknown"
                }`,
            );
            const message =
                verifyCooldown < 0
                    ? "Достигнут лимит попыток проверки кода. Попробуйте позже."
                    : error instanceof Error && error.message === "jwt expired"
                      ? "Срок действия кода истек. Запросите новый код."
                      : error instanceof Error && error.message === "Invalid OTP"
                        ? "Неверный код подтверждения"
                        : error instanceof Error
                          ? error.message
                          : "Не удалось подтвердить код";

            return {
                success: false,
                location: "otp",
                error:
                    verifyCooldown < 0
                        ? JSON.stringify({
                              type: "not_allowed",
                              message,
                              retry: now + 60 * 60 * 1000,
                              code: 429,
                          })
                        : message,
            };
        }

        const updatedUser = await authIdentityProviderService.update(email, {
            provider_metadata: {
                otp: null,
            },
        });
        await this.cacheService.invalidate(this.getResendStateCacheKey(email));
        await this.cacheService.invalidate(this.getVerifyStateCacheKey(email));
        this.logger.info(
            `[otp-auth][callback] success email=${email} resend-state invalidated verify-state invalidated`,
        );

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
