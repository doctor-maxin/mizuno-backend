import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { IAuthModuleService } from "@medusajs/framework/types";
import { AuthenticationInput } from "@medusajs/types";
import { MedusaError, Modules } from "@medusajs/framework/utils";
import { PostAuthPreRegisterSchemaType } from "../../validators";

export const POST = async (
    req: MedusaRequest<PostAuthPreRegisterSchemaType>,
    res: MedusaResponse,
) => {
    const authService: IAuthModuleService = req.scope.resolve(Modules.AUTH);

    try {
        const authData: AuthenticationInput = {
            url: req.url,
            body: {
                email: req.validatedBody.email,
            },
            protocol: req.protocol,
        };

        const { success, error, location } = await authService.authenticate(
            "otp-auth",
            authData,
        );

        if (!success) {
            return res.status(400).json({
                success: false,
                location: location ?? "otp",
                error: error ?? "Authentication failed",
            });
        }

        return res.status(200).json({
            success: true,
            location: location ?? "otp",
        });
    } catch (err) {
        const error = err as MedusaError & { resetAt?: number | Date };

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
