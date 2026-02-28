import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { cartClearAllPgroupsItemsWorkflow } from "../../../../../../workflows/cart-clear-all-pgroups-items";


type CartUpdateRequest = {
  items: {
    variant_id: string;
    quantity?: number;
  }[]
}

export async function POST(
  req: MedusaRequest<CartUpdateRequest>,
  res: MedusaResponse
) {

  const id = req.params.id

  // тут начинается логика записи в корзину

  await cartClearAllPgroupsItemsWorkflow(req.scope).run({ input: { cart_id: id } })

  res.status(200).json({message: "done"});
}


//получаем список всех групп товаров из сезона и категории
//сортируем его по правилам - для этого нужно иметь в списке данные по названию, цене, количеству цветов, по-умолчанию - с учетом мерча
//после установленной сортировки получаем нужное количество групп для вывода на странице 

// структура json

// артикул, цвета, цена, название, пол