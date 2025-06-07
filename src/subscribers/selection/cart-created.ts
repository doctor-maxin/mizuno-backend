// import type {
//   SubscriberArgs,
//   SubscriberConfig,
// } from "@medusajs/framework"
// import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
// import { updateAction, updateSelectionListWorkflow } from "../../workflows/update-selection"
// import B2bModuleService from "../../modules/b2b/service"

// export default async function cartUpdateHandler({
//   event: { data },
//   container,
// }: SubscriberArgs<{ id: string }>) {

//   const logger = container.resolve("logger")

//   const cartModuleService = container.resolve(Modules.CART)
//   const b2bModuleService = await container.resolve<B2bModuleService>('b2b')

//   const link = container.resolve(ContainerRegistrationKeys.LINK)

//   const newSelectionList = await b2bModuleService.createSelections({})

//   await link.create({
//   [Modules.CART]: {
//     cart_id: data.id,
//   },
//   "b2bModuleService": {
//     selection_id: newSelectionList.id,
//   },
// })

// logger.info(`Selection created ${newSelectionList.id}`)

// }

// export const config: SubscriberConfig = {
//   event: "cart.created",
// }