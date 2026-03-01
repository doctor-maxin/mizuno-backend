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
import { PostAuthPreRegisterSchema } from "./auth/validators";

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
