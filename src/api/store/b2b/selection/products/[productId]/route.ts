import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { B2B_MODULE } from "../../../../../../modules/b2b";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { productId } = req.params;
  const { cart_id } = req.query

  if (!cart_id) {
    res.status(400).send({ message: "Не передан cart_id" })
    return
  }

  const productModuleService = req.scope.resolve("product")
  const logger = req.scope.resolve("logger")

  try {

    const product = await productModuleService.retrieveProduct(productId)
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    const { data: [cart] } = await query.graph({
      entity: "cart",
      fields: ["*", "items.*", "selection.*,", "selection.products.*"],
      filters: {
        id: cart_id as string,
      },
    })

    const { selection } = cart

    if (!selection) {
      res.status(404).send({ message: "Список не найден" })
      return
    }

    const link = req.scope.resolve(
      ContainerRegistrationKeys.LINK
    )

    if (product) {
      try {

        const isProductAlreadyInList = !!cart?.selection?.products?.length && cart.selection.products.some(item => item?.id === product.id)

        logger.info(JSON.stringify(isProductAlreadyInList, null, 2))

        if (!isProductAlreadyInList) {
          await link.create([{
            [B2B_MODULE]: {
              selection_id: selection.id
            },
            [Modules.PRODUCT]: {
              product_id: productId,
            },
          }])

          res.json({
            message: `Товар ${productId} добавлен в список ${selection.id}`
          })
        } else res.status(200).json({
          message: `Товар ${productId} уже в списке ${selection.id}`
        })



      } catch (error) {
        res.status(500).send({ message: "Ошибка сервера" })
      }

    }

  } catch (error) {
    res.status(404).send({ message: "Товар не найден" })
  }


}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { productId } = req.params;
  const { cart_id } = req.query

  if (!cart_id) {
    res.status(400).send({ message: "Не передан cart_id" })
    return
  }

  const productModuleService = req.scope.resolve("product")

  const logger = req.scope.resolve("logger")

  try {

    const product = await productModuleService.retrieveProduct(productId)
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    const { data: [cart] } = await query.graph({
      entity: "cart",
      fields: ["*", "items.*", "selection.*,", "selection.products.*"],
      filters: {
        id: cart_id as string,
      },
    })

    const { selection } = cart

    if (!selection) {
      res.status(404).send({ message: "Список не найден" })
      return
    }

    const link = req.scope.resolve(
      ContainerRegistrationKeys.LINK
    )

    if (product) {
      try {

        const isProductAlreadyInList = !!cart?.selection?.products?.length && cart.selection.products.some(item => item?.id == product.id)

        if (isProductAlreadyInList) {
          await link.dismiss({
            [B2B_MODULE]: {
              selection_id: selection.id
            },
            [Modules.PRODUCT]: {
              product_id: product.id,
            },
          })

          res.json({
            message: `Товар ${productId} убран из списка ${selection.id}`
          })
        } else res.status(200).json({
          message: `Товара ${productId} не было в списке ${selection.id}`
        })

      } catch (error) {
        res.status(500).send({ message: "Ошибка сервера" })
      }

    }

  } catch (error) {
    res.status(404).send({ message: "Товар не найден" })
  }


}
