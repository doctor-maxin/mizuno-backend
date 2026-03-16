import { z } from "zod";

export const PostAuthPreRegisterSchema = z.object({
    email: z.string().email(),
});

export const PostAuthOtpVerifySchema = z.object({
    email: z.string().email(),
    otp: z.string().trim().min(1),
});

export const PostAuthPasswordLoginSchema = z.object({
    email: z.string().email(),
    password: z.string().trim().min(1),
});

export const PostAuthOtpRegisterSchema = z.object({
    email: z.string().email(),
    otp: z.string().trim().min(1),
    first_name: z.string().trim().min(1),
    last_name: z.string().trim().min(1),
    phone: z.string().trim().min(1),
    company_name: z.string().trim().min(1),
});

export type PostAuthPreRegisterSchemaType = z.infer<
    typeof PostAuthPreRegisterSchema
>;
export type PostAuthOtpVerifySchemaType = z.infer<typeof PostAuthOtpVerifySchema>;
export type PostAuthPasswordLoginSchemaType = z.infer<
    typeof PostAuthPasswordLoginSchema
>;
export type PostAuthOtpRegisterSchemaType = z.infer<
    typeof PostAuthOtpRegisterSchema
>;
