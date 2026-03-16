import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
    AuthenticationInput,
    IAuthModuleService,
    ICacheService,
} from "@medusajs/framework/types";
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { generateJwtTokenForAuthIdentity } from "@medusajs/medusa/api/auth/utils/generate-jwt-token";
import { createCustomerAccountWorkflow } from "@medusajs/medusa/core-flows";
import { PostAuthOtpRegisterSchemaType } from "../../validators";

type VerifyAttemptState = {
    count: number;
    nextAllowedAt: number;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const getVerifyStateCacheKey = (email: string) =>
    `otp:pre-register:verify-state:${normalizeEmail(email)}`;

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

const parseState = (state: unknown): VerifyAttemptState => {
    const unwrapped = unwrapCacheValue(state);

    if (!unwrapped) {
        return {
            count: 0,
            nextAllowedAt: 0,
        };
    }

    if (Buffer.isBuffer(unwrapped)) {
        return parseState(unwrapped.toString("utf-8"));
    }

    if (typeof unwrapped === "string") {
        try {
            const parsed = JSON.parse(unwrapped) as Partial<VerifyAttemptState>;
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

    const parsed = unwrapped as Partial<VerifyAttemptState>;
    return {
        count: Number(parsed.count) || 0,
        nextAllowedAt: Number(parsed.nextAllowedAt) || 0,
    };
};

export const POST = async (
    req: MedusaRequest<PostAuthOtpRegisterSchemaType>,
    res: MedusaResponse,
) => {
    const logger = req.scope.resolve("logger");
    const authService: IAuthModuleService = req.scope.resolve(Modules.AUTH);
    const cacheService: ICacheService = req.scope.resolve(Modules.CACHE);
    const config = req.scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE);
    const {
        email,
        otp,
        first_name,
        last_name,
        phone,
        company_name,
    } = req.validatedBody;

    logger.info(`[auth/otp/register] start email=${email}`);

    const verifyState = parseState(
        await cacheService.get(getVerifyStateCacheKey(email)),
    );
    const now = Date.now();

    logger.info(
        `[auth/otp/register] verify-state email=${email} count=${verifyState.count} nextAllowedAt=${verifyState.nextAllowedAt} now=${now}`,
    );

    if (verifyState.nextAllowedAt > now) {
        const waitSeconds = Math.ceil(
            (verifyState.nextAllowedAt - now) / 1000,
        );

        return res.status(429).json({
            type: "not_allowed",
            message: `Повторная проверка будет доступна через ${waitSeconds} сек.`,
            code: "429",
            reset_at: new Date(verifyState.nextAllowedAt).toISOString(),
        });
    }

    const registerData = {
        url: req.url,
        headers: req.headers,
        query: {
            email,
            otp,
        },
        body: {
            email,
            otp,
        },
        protocol: req.protocol,
    } as unknown as AuthenticationInput;

    const registerResult = await authService.register("otp-auth", registerData);

    logger.info(
        `[auth/otp/register] register result email=${email} success=${registerResult.success}`,
    );

    if (!registerResult.success || !registerResult.authIdentity) {
        const nextCount = verifyState.count + 1;
        const cooldown = getCooldownByCount(nextCount);

        if (cooldown < 0) {
            const resetAt = now + 60 * 60 * 1000;
            await cacheService.set(
                getVerifyStateCacheKey(email),
                JSON.stringify({
                    count: nextCount,
                    nextAllowedAt: resetAt,
                }),
                60 * 60,
            );

            return res.status(429).json({
                type: "not_allowed",
                message:
                    "Достигнут лимит попыток завершения регистрации. Попробуйте позже.",
                code: "429",
                reset_at: new Date(resetAt).toISOString(),
            });
        }

        const nextAllowedAt = cooldown > 0 ? now + cooldown * 1000 : 0;
        await cacheService.set(
            getVerifyStateCacheKey(email),
            JSON.stringify({
                count: nextCount,
                nextAllowedAt,
            }),
            60 * 60,
        );

        if (nextAllowedAt > now) {
            const waitSeconds = Math.ceil((nextAllowedAt - now) / 1000);
            return res.status(429).json({
                type: "not_allowed",
                message: `Повторная проверка будет доступна через ${waitSeconds} сек.`,
                code: "429",
                reset_at: new Date(nextAllowedAt).toISOString(),
            });
        }

        return res.status(400).json({
            success: false,
            message:
                typeof registerResult.error === "string"
                    ? registerResult.error
                    : "Не удалось завершить регистрацию",
        });
    }

    const { result: customer } = await createCustomerAccountWorkflow(
        req.scope,
    ).run({
        input: {
            authIdentityId: registerResult.authIdentity.id,
            customerData: {
                email,
                first_name,
                last_name,
                phone,
                company_name,
            },
        },
    });

    const callbackData = {
        url: req.url,
        headers: req.headers,
        query: {
            email,
        },
        body: {
            email,
        },
        protocol: req.protocol,
    } as unknown as AuthenticationInput;

    const callbackResult = await authService.validateCallback(
        "otp-auth",
        callbackData,
    );

    logger.info(
        `[auth/otp/register] callback result email=${email} success=${callbackResult.success}`,
    );

    if (!callbackResult.success || !callbackResult.authIdentity) {
        return res.status(400).json({
            success: false,
            message:
                typeof callbackResult.error === "string"
                    ? callbackResult.error
                    : "Не удалось выполнить вход после регистрации",
        });
    }

    const { http } = config.projectConfig;
    const token = generateJwtTokenForAuthIdentity(
        {
            authIdentity: callbackResult.authIdentity,
            actorType: "customer",
        },
        {
            secret: http.jwtSecret,
            expiresIn: http.jwtExpiresIn,
        },
    );

    await cacheService.invalidate(getVerifyStateCacheKey(email));

    logger.info(`[auth/otp/register] success email=${email}`);

    return res.status(200).json({
        success: true,
        token,
        customer,
    });
};
