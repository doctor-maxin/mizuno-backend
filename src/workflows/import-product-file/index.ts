// src/workflows/my-workflow/index.ts
import {
    createWorkflow,
    WorkflowResponse,
    transform
  } from "@medusajs/framework/workflows-sdk"
  import { testFileStep } from "./steps/test-file"
import { createMappingConfigStep } from "./steps/create-mapping-config";
import { mapDataStep } from "./steps/map-table-data";
import { prepareDataStep } from "./steps/group-prepare-product-data";
import { batchProductsWorkflow } from "@medusajs/medusa/core-flows";
import { findAddImagesStep } from "./steps/find-add-product-images";
import { createOrCreateSeasonStep } from "./steps/create-get-season";
import { linkProductWithSeason } from "./steps/link-product-season";
import { separateProductsToUpdateOrCreateStep } from "./steps/separate-products-to-create-or-update";
import { createLinkProductGroupStep } from "./steps/create-link-product-group";
import { syncToSalesChannel } from "./steps/sync-to-sc";
  
  type WorkflowInput = {
    fileData: {
      type: string;
      data: Buffer;
    },
    seasonString: string
  }
  
  export const importProductFileWorkflow = createWorkflow(
    "import-product-file-workflow",
    function (input: WorkflowInput) {

      const {season} = createOrCreateSeasonStep(input)

      const mappingConfig = createMappingConfigStep()
      
      const productFileStepInput = transform({input, mappingConfig},
        (data) => ({...data.input, mappingConfig: data.mappingConfig})
      )
      // const testFileResult = testFileStep(productFileStepInput)

      const mappedDataFromTable = mapDataStep(productFileStepInput)

      const prepareProductsListOfJSONs = prepareDataStep(mappedDataFromTable)

      const findAddImagesStepInput = transform({prepareProductsListOfJSONs, input},
        (data) => ({seasonString: data.input.seasonString, listOfProducts: data.prepareProductsListOfJSONs})
      )

      const productJSONsWithImages = findAddImagesStep(findAddImagesStepInput)

      const separateProductsToUpdateOrCreate = separateProductsToUpdateOrCreateStep({season, productJSONsWithImages})

      const batchProductsWorkflowResult =  batchProductsWorkflow
      .runAsStep({
        input: separateProductsToUpdateOrCreate
      })

      const linkProductWithSeasonResult = linkProductWithSeason({products: batchProductsWorkflowResult.created, season: season})

      const linkProductGroups = createLinkProductGroupStep({season, productsList: batchProductsWorkflowResult})

      const syncToSalesChannelStepResult = syncToSalesChannel({productsList: batchProductsWorkflowResult})

      return new WorkflowResponse(linkProductGroups)
    }
  )
  
  export default importProductFileWorkflow