import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MedusaError } from "@medusajs/framework/utils";
import { PostAuthPreRegisterSchemaType } from "../validators";

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

const getResendStateCacheKey = (email: string) =>
    `otp:pre-register:resend-state:${normalizeEmailForCacheKey(email)}`;

const getVerifyStateCacheKey = (email: string) =>
    `otp:pre-register:verify-state:${normalizeEmailForCacheKey(email)}`;

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

const parseResendState = (rawState: unknown): OTPResendState => {
    const state = unwrapCacheValue(rawState);

    if (!state) {
        return { count: 0, nextAllowedAt: 0 };
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
            return { count: 0, nextAllowedAt: 0 };
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
            return { count: 0, nextAllowedAt: 0 };
        }
    }

    const parsed = state as Partial<OTPResendState>;
    return {
        count: Number(parsed.count) || 0,
        nextAllowedAt: Number(parsed.nextAllowedAt) || 0,
    };
};

export const POST = async (
    req: MedusaRequest<PostAuthPreRegisterSchemaType>,
    res: MedusaResponse,
) => {
    const logger = req.scope.resolve("logger");
    const customerService = req.scope.resolve("customer");
    const eventBus = req.scope.resolve("event_bus");
    const { email } = req.validatedBody;

    const customers = await customerService.listCustomers({
        email,
    });

    if (customers.length > 0) {
        const hasAccount = customers.some((c) => c.has_account);
        if (hasAccount) {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "Пользователь с таким email уже зарегистрирован",
            );
        }
    }

    const cacheService = req.scope.resolve("cache");
    const resendState = parseResendState(
        await cacheService.get(getResendStateCacheKey(email)),
    );
    const now = Date.now();

    if (resendState.nextAllowedAt > now) {
        return res.status(429).json({
            type: "not_allowed",
            message: "Повторная отправка временно недоступна",
            code: "429",
            reset_at: new Date(resendState.nextAllowedAt).toISOString(),
        });
    }

    const nextCount = resendState.count + 1;
    const cooldown = getCooldownByCount(nextCount);

    if (cooldown < 0) {
        return res.status(429).json({
            type: "not_allowed",
            message: "Достигнут лимит отправки кодов",
            code: "429",
            reset_at: null,
        });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    logger.info(`Generated OTP for ${email}: ${otp}`);

    await cacheService.set(`otp:pre-register:${email}`, otp, 60 * 5);
    await cacheService.set(
        getResendStateCacheKey(email),
        JSON.stringify({
            count: nextCount,
            nextAllowedAt: now + cooldown * 1000,
        }),
        60 * 60,
    );
    await cacheService.invalidate(getVerifyStateCacheKey(email));

    await eventBus.emit(
        {
            name: "email-auth.otp.generated",
            data: {
                otp,
                email,
            },
        },
        {},
    );

    return res.status(200).json({ success: true, location: "otp" });
};
