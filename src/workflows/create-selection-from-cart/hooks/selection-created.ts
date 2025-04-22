import { createCartWorkflow } from "@medusajs/medusa/core-flows"
import { createSelectionListFromCartWorkflow, createSelectionListFromCartWorkflowInput } from "../index"


createCartWorkflow.hooks.cartCreated(
	async (hookData, { container }) => {

    if (!hookData?.additional_data) hookData.additional_data =  { selection_title: "TODO Default title"}

    await createSelectionListFromCartWorkflow(container)
      .run({
        input: hookData as createSelectionListFromCartWorkflowInput,
      })
	}
)