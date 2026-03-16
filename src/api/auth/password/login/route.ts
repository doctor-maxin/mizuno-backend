import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
    AuthenticationInput,
    IAuthModuleService,
    ICacheService,
} from "@medusajs/framework/types";
import {
    ContainerRegistrationKeys,
    MedusaError,
    Modules,
} from "@medusajs/framework/utils";
import { generateJwtTokenForAuthIdentity } from "@medusajs/medusa/api/auth/utils/generate-jwt-token";
import { PostAuthPasswordLoginSchemaType } from "../../validators";

type LoginAttemptState = {
    count: number;
    nextAllowedAt: number;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const getCacheKey = (email: string) =>
    `auth:password-login-state:${normalizeEmail(email)}`;

const getCooldownByCount = (count: number) => {
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

const parseState = (state: unknown): LoginAttemptState => {
    if (!state) {
        return {
            count: 0,
            nextAllowedAt: 0,
        };
    }

    if (Buffer.isBuffer(state)) {
        return parseState(state.toString("utf-8"));
    }

    if (typeof state === "string") {
        try {
            const parsed = JSON.parse(state) as Partial<LoginAttemptState>;
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

    const parsed = state as Partial<LoginAttemptState>;
    return {
        count: Number(parsed.count) || 0,
        nextAllowedAt: Number(parsed.nextAllowedAt) || 0,
    };
};

const getAttemptState = async (
    cacheService: ICacheService,
    email: string,
): Promise<LoginAttemptState> => {
    const rawState = await cacheService.get(getCacheKey(email));
    return parseState(unwrapCacheValue(rawState));
};

const saveAttemptState = async (
    cacheService: ICacheService,
    email: string,
    state: LoginAttemptState,
) => {
    await cacheService.set(getCacheKey(email), JSON.stringify(state), 60 * 60);
};

const resolveActorType = (authIdentity: {
    app_metadata?: Record<string, unknown> | null;
}) => {
    const metadata =
        authIdentity.app_metadata &&
        typeof authIdentity.app_metadata === "object"
            ? authIdentity.app_metadata
            : {};

    if (metadata.user_id) {
        return "user" as const;
    }

    if (metadata.manager_id) {
        return "manager" as const;
    }

    return null;
};

export const POST = async (
    req: MedusaRequest<PostAuthPasswordLoginSchemaType>,
    res: MedusaResponse,
) => {
    const logger = req.scope.resolve("logger");
    const authService: IAuthModuleService = req.scope.resolve(Modules.AUTH);
    const cacheService: ICacheService = req.scope.resolve(Modules.CACHE);
    const config = req.scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE);
    const { email, password } = req.validatedBody;

    logger.info(`[auth/password/login] start email=${email}`);

    const attemptState = await getAttemptState(cacheService, email);
    const now = Date.now();

    logger.info(
        `[auth/password/login] state email=${email} count=${attemptState.count} nextAllowedAt=${attemptState.nextAllowedAt} now=${now}`,
    );

    if (attemptState.nextAllowedAt > now) {
        const waitSeconds = Math.ceil(
            (attemptState.nextAllowedAt - now) / 1000,
        );

        logger.warn(
            `[auth/password/login] throttled email=${email} waitSeconds=${waitSeconds}`,
        );

        return res.status(429).json({
            type: "not_allowed",
            message: `Повторный вход будет доступен через ${waitSeconds} сек.`,
            code: "429",
            reset_at: new Date(attemptState.nextAllowedAt).toISOString(),
        });
    }

    try {
        const authData = {
            url: req.url,
            headers: req.headers,
            query: {
                email,
                password,
            },
            body: {
                email,
                password,
            },
            protocol: req.protocol,
        } as unknown as AuthenticationInput;

        const { success, error, authIdentity } = await authService.authenticate(
            "emailpass",
            authData,
        );

        logger.info(
            `[auth/password/login] auth result email=${email} success=${success} errorType=${typeof error}`,
        );

        if (!success || !authIdentity) {
            const nextCount = attemptState.count + 1;
            const cooldown = getCooldownByCount(nextCount);

            if (cooldown < 0) {
                const resetAt = now + 60 * 60 * 1000;
                await saveAttemptState(cacheService, email, {
                    count: nextCount,
                    nextAllowedAt: resetAt,
                });

                return res.status(429).json({
                    type: "not_allowed",
                    message:
                        "Достигнут лимит попыток входа по паролю. Попробуйте позже.",
                    code: "429",
                    reset_at: new Date(resetAt).toISOString(),
                });
            }

            const nextAllowedAt = cooldown > 0 ? now + cooldown * 1000 : 0;
            await saveAttemptState(cacheService, email, {
                count: nextCount,
                nextAllowedAt,
            });

            if (nextAllowedAt > now) {
                const waitSeconds = Math.ceil((nextAllowedAt - now) / 1000);

                return res.status(429).json({
                    type: "not_allowed",
                    message: `Повторный вход будет доступен через ${waitSeconds} сек.`,
                    code: "429",
                    reset_at: new Date(nextAllowedAt).toISOString(),
                });
            }

            return res.status(401).json({
                success: false,
                message:
                    typeof error === "string"
                        ? error
                        : "Неверный email или пароль",
                code: "401",
            });
        }

        await cacheService.invalidate(getCacheKey(email));

        const actorType = resolveActorType(authIdentity);
        if (!actorType) {
            logger.error(
                `[auth/password/login] actor type not resolved email=${email} metadata=${JSON.stringify(
                    authIdentity.app_metadata ?? {},
                )}`,
            );
            return res.status(401).json({
                success: false,
                message: "Не удалось определить тип учетной записи",
                code: "401",
            });
        }

        const { http } = config.projectConfig;
        const token = generateJwtTokenForAuthIdentity(
            {
                authIdentity,
                actorType,
            },
            {
                secret: http.jwtSecret,
                expiresIn: http.jwtExpiresIn,
            },
        );

        logger.info(
            `[auth/password/login] success email=${email} actorType=${actorType}`,
        );

        return res.status(200).json({
            success: true,
            token,
            actor_type: actorType,
        });
    } catch (err) {
        const error = err as MedusaError;
        logger.error(
            `[auth/password/login] exception email=${email} message=${error?.message ?? "unknown"}`,
        );
        throw err;
    }
};
