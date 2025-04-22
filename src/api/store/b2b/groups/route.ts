import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {


  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)


    const {season, offset = 0, limit = 10 } = req.query 

    if(!season) res.status(400).json({message: "Не указан season"});
  
      const { data: queriedPGroups } = await query.graph({
        entity: "pgroup",
        fields: [
          "id",
          "product_ids",
          "product_code",
          "title",
          "category"
        ],
        filters: {
          season_id: season as string
        }
      })

    
    const productModuleService = req.scope.resolve("product")

    


  res.status(200).json(queriedPGroups);
}


//получаем список всех групп товаров из сезона и категории
//сортируем его по правилам - для этого нужно иметь в списке данные по названию, цене, количеству цветов, по-умолчанию - с учетом мерча
//после установленной сортировки получаем нужное количество групп для вывода на странице 

// структура json

// артикул, цвета, цена, название, пол