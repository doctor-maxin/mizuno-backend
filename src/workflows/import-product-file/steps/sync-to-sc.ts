// src/workflows/my-workflow/steps/step-two.ts
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ProductDTO } from "@medusajs/framework/types";
import { linkProductsToSalesChannelWorkflow } from "@medusajs/medusa/core-flows";

type createLinkProductGroupStepInput = {
  productsList: {
    created: ProductDTO[]
    updated: ProductDTO[]
    deleted: string[]
  }
}

export const syncToSalesChannel = createStep(
  "sync-to-sales-channel",
  async ({ productsList }: createLinkProductGroupStepInput, { container }) => {


    const logger = container.resolve(
      ContainerRegistrationKeys.LOGGER
    )

    const mergedProducts = [...productsList.created, ...productsList.updated]

    const allProductIds = mergedProducts.map(product => product.id)

      try {

        const { result } = await linkProductsToSalesChannelWorkflow(container)
            .run({
                input: {
                id: "sc_01JP25ZS04QG8308JP0XPGJ5RY", 
                add: allProductIds, 
                }
            })

            return new StepResponse(result)
       
      } catch (error) {
        logger.error("Ошибка создания и привязки продуктовой группы:")
        logger.error(error)
        throw error
      }

  }

)