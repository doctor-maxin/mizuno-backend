import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { IAuthModuleService } from "@medusajs/framework/types";
import { AuthenticationInput } from "@medusajs/types";
import { MedusaError, Modules } from "@medusajs/framework/utils";
import { PostAuthPreRegisterSchemaType } from "../../validators";

const parseAuthError = (error: unknown) => {
    if (typeof error !== "string") {
        return null;
    }

    try {
        const parsed = JSON.parse(error) as {
            message?: unknown;
            retry?: unknown;
            code?: unknown;
            type?: unknown;
        };

        return {
            message:
                typeof parsed.message === "string" ? parsed.message : null,
            retry:
                typeof parsed.retry === "number" ? parsed.retry : null,
            code:
                typeof parsed.code === "number"
                    ? String(parsed.code)
                    : typeof parsed.code === "string"
                      ? parsed.code
                      : null,
            type: typeof parsed.type === "string" ? parsed.type : null,
        };
    } catch {
        return null;
    }
};

const resolveAuthLocationByEmail = async (
    query: {
        graph: (input: Record<string, unknown>) => Promise<{
            data?: Array<{ id?: string; email?: string | null }>;
        }>;
    },
    email: string,
) => {
    const targets = [
        { entity: "manager", location: "email" as const },
        { entity: "user", location: "email" as const },
        { entity: "customer", location: "otp" as const },
    ];

    for (const target of targets) {
        try {
            const result = await query.graph({
                entity: target.entity,
                fields: ["id", "email"],
                filters: {
                    email,
                },
            });

            const actor = result?.data?.[0];
            if (actor?.id) {
                return {
                    entity: target.entity,
                    location: target.location,
                    actorId: actor.id,
                };
            }
        } catch {
            // ignore lookup failures and continue with the next entity
        }
    }

    return null;
};

export const POST = async (
    req: MedusaRequest<PostAuthPreRegisterSchemaType>,
    res: MedusaResponse,
) => {
    const authService: IAuthModuleService = req.scope.resolve(Modules.AUTH);
    const logger = req.scope.resolve("logger");
    const query = req.scope.resolve("query");
    const email = req.validatedBody.email;
    logger.info(`[auth/otp/request] start email=${email}`);

    try {
        const resolvedActor = await resolveAuthLocationByEmail(query, email);
        logger.info(
            `[auth/otp/request] actor lookup email=${email} entity=${resolvedActor?.entity ?? "none"} location=${resolvedActor?.location ?? "none"} actorId=${resolvedActor?.actorId ?? "none"}`,
        );

        if (resolvedActor?.location === "email") {
            logger.info(
                `[auth/otp/request] password flow selected email=${email} entity=${resolvedActor.entity}`,
            );
            return res.status(200).json({
                success: true,
                location: "email",
            });
        }

        const authData: AuthenticationInput = {
            url: req.url,
            body: {
                email,
            },
            protocol: req.protocol,
        };

        const { success, error, location } = await authService.authenticate(
            "otp-auth",
            authData,
        );
        logger.info(
            `[auth/otp/request] auth result email=${email} success=${success} location=${location ?? "otp"} errorType=${typeof error}`,
        );

        if (!success) {
            const parsedError = parseAuthError(error);
            logger.warn(
                `[auth/otp/request] auth failed email=${email} parsedCode=${parsedError?.code ?? "none"} rawError=${
                    typeof error === "string" ? error : "non-string"
                }`,
            );

            if (parsedError?.code === "429") {
                logger.warn(
                    `[auth/otp/request] returning 429 email=${email} resetAt=${parsedError.retry ?? "null"}`,
                );
                return res.status(429).json({
                    type: parsedError.type ?? "not_allowed",
                    message:
                        parsedError.message ??
                        "Повторная отправка временно недоступна",
                    code: "429",
                    reset_at: parsedError.retry
                        ? new Date(parsedError.retry).toISOString()
                        : null,
                });
            }

            if (
                typeof error === "string" &&
                error.includes("Достигнут лимит отправки кодов")
            ) {
                logger.warn(
                    `[auth/otp/request] returning hard-limit 429 email=${email}`,
                );
                return res.status(429).json({
                    type: "not_allowed",
                    message: error,
                    code: "429",
                    reset_at: null,
                });
            }

            return res.status(400).json({
                success: false,
                location: location ?? "otp",
                error: error ?? "Authentication failed",
            });
        }

        logger.info(`[auth/otp/request] success email=${email}`);
        return res.status(200).json({
            success: true,
            location: location ?? "otp",
        });
    } catch (err) {
        const error = err as MedusaError & { resetAt?: number | Date };
        logger.error(
            `[auth/otp/request] exception email=${email} message=${error?.message ?? "unknown"}`,
        );

        if (error?.code === "429") {
            const resetAt =
                error.resetAt instanceof Date
                    ? error.resetAt
                    : typeof error.resetAt === "number"
                      ? new Date(error.resetAt)
                    : null;

            logger.warn(
                `[auth/otp/request] exception 429 email=${email} resetAt=${resetAt?.toISOString() ?? "null"}`,
            );
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
