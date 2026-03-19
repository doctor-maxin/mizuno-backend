// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {


  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)


    const {productId} = req.query 

    if(!productId) res.status(400).json({message: "Не указан season"});
  
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
          product_ids: { $contains: [productId] }
        }
      })

      if (queriedPGroup.length) {
        const { data: quriedProducts } =  await query.graph({
          entity: "product",
          fields: [
            "id",
            "thumbnail",
            "title",
            "metadata.style_name",
            "metadata.color",
            "handle"
          ],
          filters: {
            id: { $in: queriedPGroup[0].product_ids }
          }
        })


        res.status(200).json(quriedProducts);
        return;
      }

      res.status(200).json([]);

}


//получаем список всех групп товаров из сезона и категории
//сортируем его по правилам - для этого нужно иметь в списке данные по названию, цене, количеству цветов, по-умолчанию - с учетом мерча
//после установленной сортировки получаем нужное количество групп для вывода на странице 

// структура json

// артикул, цвета, цена, название, пол