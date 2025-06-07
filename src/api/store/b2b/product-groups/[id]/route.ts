import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {


  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    const id = req.params.id

    if(!id) res.status(400).json({message: "Не указан id"});
  
      const { data: queriedPGroup } = await query.graph({
        entity: "pgroup",
        fields: [
          "id",
          "product_ids",
          "product_code",
          "title",
          "category"
        ],
        filters: {
          id: id
        }
      })

      if (queriedPGroup.length) {
        const { data: quriedProducts } =  await query.graph({
          entity: "product",
          fields: [
            "id",
            "*"
          ],
          filters: {
            id: { $in: queriedPGroup[0].product_ids }
          }
        })


        const response = {...queriedPGroup[0], products: quriedProducts}

        res.status(200).json(response);
        return;
      }

    
    const productModuleService = req.scope.resolve("product")

    


  res.status(200).json(queriedPGroup);
}


//получаем список всех групп товаров из сезона и категории
//сортируем его по правилам - для этого нужно иметь в списке данные по названию, цене, количеству цветов, по-умолчанию - с учетом мерча
//после установленной сортировки получаем нужное количество групп для вывода на странице 

// структура json

// артикул, цвета, цена, название, пол
