import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import SelectionListModuleService from "../../../modules/b2b/service"
import { SELECTION_LIST_MODULE } from "../../../modules/b2b"

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

    const selectionListModuleService: SelectionListModuleService = container.resolve(
      SELECTION_LIST_MODULE
    )

    const selectionList = await selectionListModuleService.createSelections(data)


    logger.info(JSON.stringify(selectionList, null, 2))


    return new StepResponse(selectionList, selectionList)
  },
  async (selectionList, { container }) => {
    const selectionListModuleService: SelectionListModuleService = container.resolve(
        SELECTION_LIST_MODULE
    )

    if (!selectionList) {
      return 
    }
    
    await selectionListModuleService.deleteSelections(selectionList.id)
  }
)