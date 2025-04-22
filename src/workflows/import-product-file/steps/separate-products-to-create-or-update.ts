
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import ExcelJS from 'exceljs';
import { Product, Season } from "../../../../.medusa/types/query-entry-points";
import { ProductDTO } from "@medusajs/framework/types";

type separateProductsToUpdateOrCreateStepInput = {
  season: Season,
  productJSONsWithImages: ProductDTO[]
}

interface SeasonWithProducts {
  id: Season,
  products: ProductDTO[]
}

export const separateProductsToUpdateOrCreateStep = createStep(
  "separate-products-to-create-or-update",
  async ({ season, productJSONsWithImages }: separateProductsToUpdateOrCreateStepInput, { container }) => {

    const query = container.resolve(ContainerRegistrationKeys.QUERY)

    const { data } = await query.graph({
      entity: "season",
      fields: [
        "id",
        "products.*",
        "products.variants.*"
      ],
      filters: {
        id: season.id
      }
    })

    const seasonWithProducts = data[0] as unknown as SeasonWithProducts

    if (!seasonWithProducts?.products?.length) return new StepResponse({ create: productJSONsWithImages, update: {} })


    const result = {
      create: [] as ProductDTO[],
      update: [] as ProductDTO[]
    }


    productJSONsWithImages.forEach(productJSON => {
      const existingProduct = seasonWithProducts.products.find(item => item.handle === productJSON.handle);

      if (existingProduct) {

        const productUpdate = { ...existingProduct };


        for (const key in productJSON) {
          if (key !== 'variants' && productJSON.hasOwnProperty(key)) {
            productUpdate[key] = productJSON[key];
          }
        }


        if (productJSON.variants && existingProduct.variants) {
          productUpdate.variants = mergeVariants(existingProduct.variants, productJSON.variants);
        } else if (productJSON.variants) {

          productUpdate.variants = productJSON.variants;
        }


        result.update.push(productUpdate);
      } else {

        result.create.push(productJSON);
      }
    });


    function mergeVariants(existingVariants, newVariants) {
      const merged = [...existingVariants];

      newVariants.forEach(newVariant => {
        const existingIndex = merged.findIndex(v => v.ean === newVariant.ean);

        if (existingIndex !== -1) {

          merged[existingIndex] = { ...merged[existingIndex], ...newVariant };
        } else {

          merged.push(newVariant);
        }
      });

      return merged;
    }

    return new StepResponse(result)


  }
)