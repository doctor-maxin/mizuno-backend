import { createWorkflow, transform, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { CartDTO } from "@medusajs/framework/types"
import { createRemoteLinkStep } from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { createSelectionListStep } from "./steps/create-selection"
import { SELECTION_LIST_MODULE } from "../../modules/b2b"

export type createSelectionListFromCartWorkflowInput = {
  cart: CartDTO
  additional_data?: {
    selection_title?: string
  }
}

export const createSelectionListFromCartWorkflow = createWorkflow(
  "create-selection-list-from-cart",
  (input: createSelectionListFromCartWorkflowInput) => {

    const selection = createSelectionListStep({
      title: input.additional_data?.selection_title
    })

    when(
      ({ selection }), ({ selection }) => selection !== undefined)
      .then(() => {
        createRemoteLinkStep([{
          [Modules.CART]: {
            cart_id: input.cart.id,
          },
          [SELECTION_LIST_MODULE]: {
            selection_id: selection.id,
          },
        }])
      })

    return new WorkflowResponse({
      selection,
    })
  }
)