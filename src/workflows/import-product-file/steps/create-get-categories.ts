// src/workflows/my-workflow/steps/step-two.ts
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { createSlug } from "../../../utils/slug"
import { ProductCategory } from "../../../../.medusa/types/query-entry-points"



export const createOrGetCategoriesStep = createStep(
  "create-or-get-categories",
  async ({ season, rawProducts }: any, { container }) => {

    if (!season) throw new Error("Не задан сезон")

    const B2bModuleService = container.resolve('b2b')
    const logger = container.resolve('logger')
    const query = container.resolve('query')
    const productModuleService = container.resolve('product')

    const { data: categoriesQuery } = await query.graph({
      entity: "product_category",
      fields: [
        "id",
        "handle",
        "parent_category.id",
        "metadata",
        "title",
        "name"
      ],
      filters: {
        handle: { $like: `${season.handle}%` }
      }
    })

    let seasonRootCategory = categoriesQuery.find(category => category.parent_category == null)
    const categoriesMap = new Map(rawProducts.map(product => [product.metadata.category, `${season.handle}/${createSlug(product.metadata.category)}`]))
    const findExistedSubCategories = categoriesQuery.filter(category => [...categoriesMap.values()].find(handle => category.handle === handle))
    const categoriesToCreate = [...categoriesMap.entries()].filter(item => !categoriesQuery.find(category => category.handle === item[1])).filter(item => item[1] !== seasonRootCategory?.handle)

    if (!seasonRootCategory) {
      seasonRootCategory = await productModuleService.createProductCategories({ name: season.title, handle: season.handle, metadata: { isSeasonRoot: true }, is_active: true }) as ProductCategory
    }

    const categoriesList = {
      season_root: seasonRootCategory.id
    }

    findExistedSubCategories.forEach(category => categoriesList[category.name] = category.id)

    const newCategories = await productModuleService.createProductCategories(categoriesToCreate.map(item => ({ name: item[0] as string, handle: item[1] as string, parent_category_id: seasonRootCategory.id, is_active: true})))
    newCategories.forEach(category => categoriesList[category.name] = category.id
    )

    return new StepResponse(categoriesList)

  }
)