// src/workflows/my-workflow/steps/step-two.ts
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

type createOrGetSeasonStepInput = {
  seasonString: string
}

export const createOrCreateSeasonStep = createStep(
  "create-or-get-season",
  async ({ seasonString }: createOrGetSeasonStepInput, { container }) => {

    if (!seasonString) throw new Error("Не задан сезон")
    
    const B2bModuleService = container.resolve('b2b')
    const logger = container.resolve('logger')
    const query = container.resolve('query')


    const { data: seasonsQuery } = await query.graph({
      entity: "season",
      fields: [
        "id",
        "title"
      ]
    })

    const findSeason = seasonsQuery.find(s => s.title === seasonString)


    logger.info(JSON.stringify(findSeason, null, 2))

    if (findSeason) {
        return new StepResponse({season: findSeason})
    } else {
        const newSeason = await B2bModuleService.createSeasons({title: seasonString})
        new StepResponse({season: newSeason})
    }
    



  }
)