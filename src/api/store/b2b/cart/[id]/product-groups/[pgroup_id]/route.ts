// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { CART_PRODUCT_GROUP_HASH } from "../../../../../../../utils/cache-templates";
import { cartProductGroupItemsUpdateQuantityWorkflow } from "../../../../../../../workflows/cart-product-groups-update-items";


type CartUpdateRequest = {
  items: {
    variant_id: string;
    quantity?: number; 
  }[]
}

export async function PATCH(
  req: MedusaRequest<CartUpdateRequest>,
  res: MedusaResponse
) {


  const id = req.params.id
  const pgroup_id = req.params.pgroup_id
  const hash = req.headers['x-hash']
  const cache = req.scope.resolve('cache')
  const body = req.body

  if (!hash) {
    res.status(400).json({ message: 'Не передан hash' });
    return
  }

  if (!("items" in body)) {
    res.status(400).json({ message: 'Не передан список items' });
    return
  }

  const cached_cart_pgroup = await cache.get(CART_PRODUCT_GROUP_HASH(id, pgroup_id, hash))

  console.log("Cached: ", cached_cart_pgroup)
  const processedItems = body.items.map(item => {
      if (!("quantity" in item)) {
        item.quantity = 0
      }
      return item
    })

  if (cached_cart_pgroup) {
    res.status(200).json({ items: cached_cart_pgroup });
    return
  }


  // тут начинается логика записи в корзину

  const {result} = await cartProductGroupItemsUpdateQuantityWorkflow(req.scope).run({input: {items: processedItems, cart_id: id, pgroup_id: pgroup_id}})
  // тут заканчивается логика записи в корзину


  // console.log(JSON.stringify(result, null, 2))

  await cache.set(CART_PRODUCT_GROUP_HASH(id, pgroup_id, hash), processedItems, 60)

  res.status(200).json({
    items: result
  });
}


//получаем список всех групп товаров из сезона и категории
//сортируем его по правилам - для этого нужно иметь в списке данные по названию, цене, количеству цветов, по-умолчанию - с учетом мерча
//после установленной сортировки получаем нужное количество групп для вывода на странице 

// структура json

// артикул, цвета, цена, название, пол