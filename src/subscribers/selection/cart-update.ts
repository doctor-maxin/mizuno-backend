// @ts-nocheck
import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateAction, updateSelectionListWorkflow } from "../../workflows/update-selection"

export default async function cartUpdateHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {

  const logger = container.resolve("logger")

  const cartModuleService = container.resolve(Modules.CART)

  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: [cart] } = await query.graph({
    entity: "cart",
    fields: ["*", "items.*", "selection.*,", "selection.products"],
    filters: {
      id: data.id,
    },
  })


  const cartProducts = cart.items.map(item => item?.product_id)

  const cartSelectionList = cart.selection?.products || []

  if (cartProducts && cart.selection) {
    const currentCartProducts = cartProducts.filter(value => value != undefined)
    const findProductToAddToSelection = currentCartProducts.filter(productId => !cartSelectionList.every(selectionProduct => productId !== selectionProduct?.id))
    logger.info(JSON.stringify(findProductToAddToSelection, null, 2))

    if (findProductToAddToSelection.length) {


      for (const product of findProductToAddToSelection) {
        const input = {
          selection_id: cart.selection.id,
          product_id: product,
          update_action: updateAction.ADD
        }
        const { result } = await updateSelectionListWorkflow(container).run({ input })

        logger.info(JSON.stringify(result, null, 2))
      }

    }



  }

}

export const config: SubscriberConfig = {
  event: "cart.updated",
}