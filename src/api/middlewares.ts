import { defineMiddlewares, MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import multer from "multer"

const upload = multer({ storage: multer.memoryStorage() })

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
        upload.array("files")
      ],
    },
  ],
})
