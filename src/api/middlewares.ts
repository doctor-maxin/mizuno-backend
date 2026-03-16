import {
    defineMiddlewares,
    authenticate,
    MedusaNextFunction,
    MedusaRequest,
    MedusaResponse,
    validateAndTransformBody,
} from "@medusajs/framework/http";
import { z } from "zod";
import multer from "multer";
import {
    PostAuthPasswordLoginSchema,
    PostAuthOtpRegisterSchema,
    PostAuthOtpVerifySchema,
    PostAuthPreRegisterSchema,
} from "./auth/validators";

const upload = multer({ storage: multer.memoryStorage() });

export default defineMiddlewares({
    routes: [
        {
            method: "POST",
            matcher: "/store/carts",
            additionalDataValidator: {
                selection: z.string().optional(),
            },
        },
        {
            method: ["POST"],
            matcher: "/admin/b2b*",
            middlewares: [
                // @ts-ignore
                upload.array("files"),
            ],
        },
        {
            matcher: "/manager",
            method: "POST",
            middlewares: [
                authenticate("manager", ["session", "bearer"], {
                    allowUnregistered: true,
                }),
            ],
        },
        {
            matcher: "/manager/me*",
            middlewares: [authenticate("manager", ["session", "bearer"])],
        },
        {
            matcher: "/auth/pre-register",
            middlewares: [validateAndTransformBody(PostAuthPreRegisterSchema)],
        },
        {
            matcher: "/auth/otp/request",
            middlewares: [validateAndTransformBody(PostAuthPreRegisterSchema)],
        },
        {
            matcher: "/auth/otp/verify",
            middlewares: [validateAndTransformBody(PostAuthOtpVerifySchema)],
        },
        {
            matcher: "/auth/otp/register",
            middlewares: [validateAndTransformBody(PostAuthOtpRegisterSchema)],
        },
        {
            matcher: "/auth/password/login",
            middlewares: [
                validateAndTransformBody(PostAuthPasswordLoginSchema),
            ],
        },
        {
            matcher: "/store/b2b/preorders*",
            middlewares: [authenticate("customer", ["session", "bearer"])],
        },
        {
            matcher: "/store/b2b/history*",
            middlewares: [authenticate("customer", ["session", "bearer"])],
        },
        {
            matcher: "/store/b2b/orders*",
            middlewares: [authenticate("customer", ["session", "bearer"])],
        },
        {
            matcher: "/store/customers/me",
            middlewares: [
                (req, res, next) => {
                    const pathname = (req.originalUrl || "")
                        .split("?")[0]
                        .replace(/\/+$/, "");

                    if (pathname === "/store/customers/me") {
                        (req.allowed ??= []).push("groups");
                    }
                    next();
                },
            ],
        },
    ],
});
