import { createStep, createWorkflow, StepResponse, transform, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { emitEventStep } from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { B2B_MODULE } from "../../modules/b2b"
import { container } from "@medusajs/framework"


export enum updateAction {
    ADD = "add-products",
    REMOVE = "remove-products",
    CLOSE = "close-selection",
    OPEN = "open-selection"
}

export type updateSelectionListWorkflowInput = {
    selection_id: string
    product_id?: string
    update_action: updateAction
}


export const addProductStep = createStep(
    "add-product-step",
    async ( input : updateSelectionListWorkflowInput) => {
        const link = container.resolve(
            ContainerRegistrationKeys.LINK
        )
       await link.create({
            [B2B_MODULE]: {
                selection_id: input.selection_id,
            },
            [Modules.PRODUCT]: {
                product_id: input.product_id,
            },
        })

        return new StepResponse("Done")
      }
    
)

export const updateSelectionListWorkflow = createWorkflow(
    "update-selection-list",
    (input: updateSelectionListWorkflowInput) => {

        emitEventStep({
            eventName: "selection.updated",
            data: {
                id: input.selection_id,
            },
        })

        const actionCheck = transform({ input }, (data) => ({
            isAdd: data.input.update_action === updateAction.ADD,
            isRemove: data.input.update_action === updateAction.REMOVE,
            isClose: data.input.update_action === updateAction.CLOSE,
            isOpen: data.input.update_action === updateAction.OPEN

        }))




        const addAction = when(
            "add-action",
            (actionCheck), (actionCheck) => actionCheck.isAdd)
            .then(() => {

                addProductStep(input)

                return { message: "products-added" }
            })

        return new WorkflowResponse({
            addAction,
        })


    }

)


