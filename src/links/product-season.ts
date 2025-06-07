// src/links/product-season.ts
import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import b2b, { B2B_MODULE } from "../modules/b2b"

export default defineLink(
    {
        linkable: ProductModule.linkable.product,
        isList: true,
    },
    b2b.linkable.season
)