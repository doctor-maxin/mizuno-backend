import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MedusaError } from "@medusajs/framework/utils";
import { PostAuthPreRegisterSchemaType } from "../validators";

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
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    logger.info(`Generated OTP for ${email}: ${otp}`);

    await cacheService.set(`otp:pre-register:${email}`, otp, 60 * 5);

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

    return res.status(200).json({ message: "OTP отправлен" });
};
