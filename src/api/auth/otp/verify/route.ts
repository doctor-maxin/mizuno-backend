// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { IAuthModuleService } from "@medusajs/framework/types";
import {
    ContainerRegistrationKeys,
    MedusaError,
    Modules,
} from "@medusajs/framework/utils";
import { PostAuthOtpVerifySchemaType } from "../../validators";
import { generateJwtTokenForAuthIdentity } from "@medusajs/medusa/api/auth/utils/generate-jwt-token";

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

    if (metadata.customer_id) {
        return "customer" as const;
    }

    return null;
};

const getActorTypeDebugInfo = (authIdentity: {
    app_metadata?: Record<string, unknown> | null;
}) => {
    const metadata =
        authIdentity.app_metadata &&
        typeof authIdentity.app_metadata === "object"
            ? authIdentity.app_metadata
            : {};

    return {
        metadata,
        keys: Object.keys(metadata),
        has_user_id: Boolean(metadata.user_id),
        has_manager_id: Boolean(metadata.manager_id),
        has_customer_id: Boolean(metadata.customer_id),
        resolved_actor_type: resolveActorType(authIdentity),
    };
};

const parseAuthError = (error: unknown) => {
    if (typeof error !== "string") {
        return null;
    }

    try {
        const parsed = JSON.parse(error) as {
            type?: unknown;
            message?: unknown;
            retry?: unknown;
            code?: unknown;
        };

        return {
            type: typeof parsed.type === "string" ? parsed.type : null,
            message: typeof parsed.message === "string" ? parsed.message : null,
            retry: typeof parsed.retry === "number" ? parsed.retry : null,
            code:
                typeof parsed.code === "number"
                    ? String(parsed.code)
                    : typeof parsed.code === "string"
                      ? parsed.code
                      : null,
        };
    } catch {
        return null;
    }
};

export const POST = async (
    req: MedusaRequest<PostAuthOtpVerifySchemaType>,
    res: MedusaResponse,
) => {
    const logger = req.scope.resolve("logger");
    const authService: IAuthModuleService = req.scope.resolve(Modules.AUTH);
    const config = req.scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE);
    const { email, otp } = req.validatedBody;

    logger.info(`[auth/otp/verify] start email=${email}`);

    try {
        const authData = {
            url: req.url,
            headers: req.headers,
            query: {
                email,
                otp,
            },
            body: req.body,
            protocol: req.protocol,
        };

        const { success, error, authIdentity, location } =
            await authService.validateCallback("otp-auth", authData);

        logger.info(
            `[auth/otp/verify] validate result email=${email} success=${success} location=${location ?? "otp"} errorType=${typeof error}`,
        );

        if (!success || !authIdentity) {
            const parsedError = parseAuthError(error);
            logger.warn(
                `[auth/otp/verify] failed email=${email} parsedCode=${parsedError?.code ?? "none"} rawError=${
                    typeof error === "string" ? error : "non-string"
                }`,
            );

            if (parsedError?.code === "429") {
                return res.status(429).json({
                    type: parsedError.type ?? "not_allowed",
                    message:
                        parsedError.message ??
                        "Повторная проверка временно недоступна",
                    code: "429",
                    reset_at: parsedError.retry
                        ? new Date(parsedError.retry).toISOString()
                        : null,
                });
            }

            return res.status(401).json({
                success: false,
                location: location ?? "otp",
                error: error ?? "Authentication failed",
            });
        }

        const actorDebug = getActorTypeDebugInfo(authIdentity);
        logger.info(
            `[auth/otp/verify] actor-debug email=${email} ${JSON.stringify(actorDebug)}`,
        );

        const actorType = resolveActorType(authIdentity);
        if (!actorType) {
            logger.error(
                `[auth/otp/verify] actor type not resolved email=${email} actorDebug=${JSON.stringify(
                    actorDebug,
                )}`,
            );
            return res.status(401).json({
                success: false,
                error: "Не удалось определить тип учетной записи",
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
            `[auth/otp/verify] success email=${email} actorType=${actorType} metadata=${JSON.stringify(
                authIdentity.app_metadata ?? {},
            )}`,
        );

        return res.status(200).json({
            success: true,
            token,
            actor_type: actorType,
        });
    } catch (err) {
        const error = err as MedusaError & { resetAt?: number | Date };
        logger.error(
            `[auth/otp/verify] exception email=${email} message=${error?.message ?? "unknown"}`,
        );

        if (error?.code === "429") {
            const resetAt =
                error.resetAt instanceof Date
                    ? error.resetAt
                    : typeof error.resetAt === "number"
                      ? new Date(error.resetAt)
                      : null;

            return res.status(429).json({
                type: error.type,
                message: error.message,
                code: error.code,
                reset_at: resetAt ? resetAt.toISOString() : null,
            });
        }

        throw err;
    }
};
