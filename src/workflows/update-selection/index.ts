// @ts-nocheck
import { createStep, createWorkflow, StepResponse, transform, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { emitEventStep } from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { B2B_MODULE } from "../../modules/b2b"
import { container } from "@medusajs/framework"
import B2bModuleService from "../../modules/b2b/service"


export enum updateAction {
    ADD = "add-pgroup",
    REMOVE = "remove-pgroup",
    CLOSE = "close-selection",
    OPEN = "open-selection"
}

export type updateSelectionListWorkflowInput = {
    selection_id: string
    pgroup_id?: string
    update_action: updateAction
}

export const addProductGroupStep = createStep(
    "add-pgroup-step",
    async ( input : updateSelectionListWorkflowInput,  { container }) => {

        const {selection_id, pgroup_id} = input

        const b2bModuleService = await container.resolve<B2bModuleService>('b2b')

        const getSelection = await b2bModuleService.retrieveSelection(selection_id)

        if (getSelection && pgroup_id) {
                    const updatedSelection = await b2bModuleService.updateSelections( {...getSelection, pgroups: [...getSelection.pgroups, pgroup_id]})
                    return new StepResponse(updatedSelection)

        }

        // return new StepResponse({message: "Не найден selection list или группа товаров не передана"})
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

                addProductGroupStep(input)

                return { message: "pgroup-added" }
            })

        return new WorkflowResponse({
            addAction,
        })


    }

)


