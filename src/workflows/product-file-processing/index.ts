import { createStep, createWorkflow, StepResponse } from "@medusajs/framework/workflows-sdk"

export const selectCategory = createStep(
    "select-category",
    async ( input ) => {

        // нужно создать категорию сезона
        // получить ее id и использовать как родительскую для остальных категорий

        return new StepResponse("Done")


      }
    
)

export const productFileProccessing = createWorkflow(
    "product-file-proccessing",
    (input) => {


        // нужно получить id категории
        // нужно получить id коллекции, в данном случае у нас одна коллекция и можно пока захардкодить
        // тип = категории? 
        // картинки загружаем с фтп?  


    }

)


