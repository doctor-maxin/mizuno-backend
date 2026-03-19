// @ts-nocheck
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
import { createOrGetCategoriesStep } from "./steps/create-get-categories";
  
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
      const mappedDataFromTable = mapDataStep(productFileStepInput)

      const prepareProductsListOfJSONs = prepareDataStep(mappedDataFromTable)

      const productsCategoriesDict = createOrGetCategoriesStep({season, rawProducts: prepareProductsListOfJSONs})

      const findAddImagesStepInput = transform({prepareProductsListOfJSONs, input},
        (data) => ({seasonString: data.input.seasonString, listOfProducts: data.prepareProductsListOfJSONs})
      )

      const productJSONsWithImages = findAddImagesStep(findAddImagesStepInput)

      const productJSONsWithCategories = transform({productJSONsWithImages, productsCategoriesDict},
        (data) => ( data.productJSONsWithImages.map(product => ({...product, category_ids: [data.productsCategoriesDict.season_root, data.productsCategoriesDict[product.metadata?.category]]})))
      )

      const separateProductsToUpdateOrCreate = separateProductsToUpdateOrCreateStep({season, productJSONsWithCategories})

      const batchProductsWorkflowResult =  batchProductsWorkflow
      .runAsStep({
        input: separateProductsToUpdateOrCreate
      })

      const linkProductWithSeasonResult = linkProductWithSeason({products: batchProductsWorkflowResult.created, season: season})

      const linkProductGroups = createLinkProductGroupStep({season, productsList: batchProductsWorkflowResult})

      const syncToSalesChannelStepResult = syncToSalesChannel({productsList: batchProductsWorkflowResult})

      return new WorkflowResponse(batchProductsWorkflowResult)
    }
  )
  
  export default importProductFileWorkflow