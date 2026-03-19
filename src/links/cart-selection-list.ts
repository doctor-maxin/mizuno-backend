// @ts-nocheck
import { defineLink } from "@medusajs/framework/utils";
import CartModule from "@medusajs/medusa/cart";
import b2b from "../modules/b2b";


export default defineLink(
  CartModule.linkable.cart,
  b2b.linkable.selection
)

