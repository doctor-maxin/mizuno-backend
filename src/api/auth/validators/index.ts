import { z } from "zod";

export const PostAuthPreRegisterSchema = z.object({
    email: z.string().email(),
});

export type PostAuthPreRegisterSchemaType = z.infer<
    typeof PostAuthPreRegisterSchema
>;
