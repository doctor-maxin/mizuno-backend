// @ts-nocheck
// src/workflows/my-workflow/steps/step-two.ts
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import ExcelJS from 'exceljs';
import { Season } from "../../../../.medusa/types/query-entry-points";
import { ProductDTO } from "@medusajs/framework/types";
import { B2B_MODULE } from "../../../modules/b2b";

type createLinkProductGroupStepInput = {
  season: Season
  productsList: {
    created: ProductDTO[]
    updated: ProductDTO[]
    deleted: string[]
  }
}

export const createLinkProductGroupStep = createStep(
  "create-or-get-product-group",
  async ({ season, productsList }: createLinkProductGroupStepInput, { container }) => {

    const B2bModuleService = container.resolve('b2b')

    const query = container.resolve(ContainerRegistrationKeys.QUERY)

    const { data: queriedProductsFromSeasonData } = await query.graph({
      entity: "season",
      fields: [
        "id",
        "products.*",
        "products.metadata",
        "products.pgroup.*"
      ],
      filters: {
        id: season.id
      }
    })

    const { data: quriedProductsGroupData } = await query.graph({
      entity: "pgroup",
      fields: [
        "*"
      ],
      filters: {
        season_id: season.id
      }
    })

    const link = container.resolve(
      ContainerRegistrationKeys.LINK
    )

    const logger = container.resolve(
      ContainerRegistrationKeys.LOGGER
    )

    const queriedProducts = queriedProductsFromSeasonData[0]?.products as unknown as ProductDTO[]

    const mergedProducts = [...productsList.created, ...productsList.updated]

    const filteredProducts = queriedProducts.filter(productDB => mergedProducts.some(productImport => productImport.id === productDB.id))

    const result = {
      created: 0,
      added: 0,
      updated: 0,
      errors: 0
    }

    async function voidCreateProductProductGroupLink({ product, productGroup }) {
      await link.create({
        [Modules.PRODUCT]: {
          product_id: product.id,
        },
        [B2B_MODULE]: {
          pgroup_id: productGroup.id,
        },
      })
    }


    for (const product of filteredProducts) {
      try {
        let productGroup
        const isProductGroupExist = quriedProductsGroupData.find(pgroup => pgroup.product_code === product?.metadata?.product_code)
        // @ts-expect-error
        const isProductGroupLinkedToProduct = product?.pgroup?.id
        const colorHexPair =  `${product?.metadata?.color_rus}:${product?.metadata?.color_hex}`
        if (!isProductGroupExist) {
          productGroup = await B2bModuleService.createPgroups({
            product_ids: [product.id],
            season_id: season.id,
            product_code: product?.metadata?.product_code as string,
            title: product?.metadata?.style_name as string,
            category: product?.metadata?.category,
            metadata: {
              handle: product?.handle,
              is_shoes: product?.metadata?.is_shoes,
              thumbnail: product?.thumbnail,
              gender: product?.metadata?.gender,
              price: product?.metadata?.price,
              colors: [colorHexPair]
            }
          })

          voidCreateProductProductGroupLink({ product, productGroup })
          result.created++
          quriedProductsGroupData.push(productGroup)


        } if (isProductGroupExist && !isProductGroupLinkedToProduct) {
          productGroup = isProductGroupExist
          await B2bModuleService.updatePgroups({
            id: productGroup.id,
            product_ids: [...new Set([...productGroup.product_ids, product.id])],
            title: product?.metadata?.style_name as string,
            
            metadata: { ...productGroup.metadata, 
              is_shoes: product?.metadata?.is_shoes,
              handle: productGroup.metadata?.product?.handle ? productGroup.metadata?.product?.handle : product?.handle,
              thumbnail: productGroup.metadata?.thumbnail ? productGroup.metadata.thumbnail : product.thumbnail,
              colors: Array.from(new Set([...productGroup.metadata.colors, colorHexPair]))
            }
          })
          voidCreateProductProductGroupLink({ product, productGroup })
          result.added++
        }

        if (isProductGroupExist && isProductGroupLinkedToProduct) 
         {
          productGroup = isProductGroupExist
          await B2bModuleService.updatePgroups({
            id: productGroup.id,
            title: product?.metadata?.style_name as string,
            metadata: { ...productGroup.metadata, 
              handle: productGroup.metadata?.product?.handle ? productGroup.metadata?.product?.handle : product?.handle,
              is_shoes: product?.metadata?.is_shoes,
              colors: Array.from(new Set([...productGroup.metadata.colors, colorHexPair]))}
          })
          result.updated++
         }
      } catch (error) {
        logger.error("Ошибка создания и привязки продуктовой группы:")
        logger.error(error)
        result.errors++
      }
    }

    return new StepResponse(result)

  }

)