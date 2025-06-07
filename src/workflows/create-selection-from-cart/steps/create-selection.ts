import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import SelectionListModuleService from "../../../modules/b2b/service"
import {B2B_MODULE } from "../../../modules/b2b"
import B2bModuleService from "../../../modules/b2b/service"

type CreateSelectionListStepInput = {
  title?: string
  is_open?: boolean
}

export const createSelectionListStep = createStep(
  "create-selection-list",
  async (data: CreateSelectionListStepInput, { container }) => {
    const logger = container.resolve("logger")

    logger.info(JSON.stringify(data, null, 2))

    if (!data?.title) {
      return 
    }

    const b2bModuleService: B2bModuleService = container.resolve(
      B2B_MODULE
    )

    const selectionList = await b2bModuleService.createSelections(data)

    return new StepResponse(selectionList, selectionList)
  },
  async (selectionList, { container }) => {
    const selectionListModuleService: SelectionListModuleService = container.resolve(
        B2B_MODULE
    )

    if (!selectionList) {
      return 
    }
    
    await selectionListModuleService.deleteSelections(selectionList.id)
  }
)