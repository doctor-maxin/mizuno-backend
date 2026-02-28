import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { deleteLineItemsWorkflow, useQueryGraphStep } from "@medusajs/medusa/core-flows"
import B2bModuleService from "../../modules/b2b/service";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";


export type cartProductGroupDeleteItemsWorkflowInput = {
    cart_id: string;
}

export type cartSelectionClearStepInput = {
    selectionId:string,
    selectionProductGroups: string[]
}

export const cartSelectionClearStep = createStep(
    "cart-selection-clear",
    async (input: cartSelectionClearStepInput, { container }) => {
        const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
        const b2bModuleService = container.resolve<B2bModuleService>("b2b")

        if (!("selectionId" in input) && !("selectionProductGroups" in input)) return new StepResponse({ message: "error" })

            try {
               await b2bModuleService.clearSelection(input.selectionId, input.selectionProductGroups)
               return new StepResponse({ message: "done" })
            } catch (error) {
                return new StepResponse({ message: error })
            }

    }
)


export const cartClearAllPgroupsItemsWorkflow = createWorkflow(
    "cart-clear-all-pgroups-items",
    (input: cartProductGroupDeleteItemsWorkflowInput) => {

        //@ts-ignore
        const { data: currentCart } = useQueryGraphStep({
            entity: "cart",
            fields: [
                "id",
                "items.id",
                "selection.id",
                "selection.pgroups.*"
            ],
            filters: {
                id: input.cart_id
            }
        }).config({ name: "fetch-cart" })


        const cartItems = transform({ currentCart },
            (data) => (data.currentCart?.[0]?.items || [])
                .map(item => item?.id)

        )

        const { selectionId, selectionProductGroups } = transform({ currentCart },
            (data) => ({
                selectionId: data.currentCart?.[0]?.selection?.id, selectionProductGroups: (data.currentCart?.[0]?.selection?.pgroups || [])
                    .map(item => item?.id)
            })
        )


        // onst chekcStepResult = checkStep({ currentLineItemsAtCart, productGroupProducts })

        const products = deleteLineItemsWorkflow.runAsStep({
            input: {
                cart_id: input.cart_id,
                ids: cartItems
            },
        })

        const pgroupsDelete = cartSelectionClearStep({selectionId, selectionProductGroups})



        return new WorkflowResponse({ message: "Удалены все позиции в корзине и очищено списком", debug: {products, pgroupsDelete} })
    }
)