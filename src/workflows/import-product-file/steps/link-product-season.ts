// src/workflows/my-workflow/steps/step-two.ts
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import ExcelJS from 'exceljs';
import { Season } from "../../../../.medusa/types/query-entry-points";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { ProductDTO } from "@medusajs/framework/types";
import { B2B_MODULE } from "../../../modules/b2b";


type linkProductWithSeasonStepInput = {
  season: Season
  products: ProductDTO[]
}

export const linkProductWithSeason = createStep(
  "link-product-season",
  async ({products, season}: linkProductWithSeasonStepInput, { container }) => {

    const link = container.resolve(
      ContainerRegistrationKeys.LINK
    )

    const logger = container.resolve(
      ContainerRegistrationKeys.LOGGER
    )


    const result = {
      success: 0,
      error: 0,
    }
  
    for (const product of products) {
      try {
        await link.create({
          [Modules.PRODUCT]: {
            product_id: product.id,
          },
          [B2B_MODULE]: {
            season_id: season.id,
          },
        })

        result.success++
      } catch (error) {
        result.error++
        logger.error(error)
      }
      
    }

    return new StepResponse({result})

  }
)