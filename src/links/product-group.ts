// src/links/product-season.ts
import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import b2b from "../modules/b2b"

export default defineLink(
    {
        linkable: ProductModule.linkable.product,
        isList: true,
    },
    b2b.linkable.pgroup
)