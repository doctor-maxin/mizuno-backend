import { defineLink } from "@medusajs/framework/utils";
import ProductModule from "@medusajs/medusa/product"
import b2b from "../modules/b2b";


export default defineLink(
  b2b.linkable.selection,
  {
    linkable: ProductModule.linkable.product,
    isList: true
  }
)

