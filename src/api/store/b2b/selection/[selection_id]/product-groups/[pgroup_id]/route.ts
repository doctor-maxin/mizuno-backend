import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { B2B_MODULE } from "../../../../../../../modules/b2b";
import B2bModuleService from "../../../../../../../modules/b2b/service";
import { cartProductGroupDeleteItemsWorkflow } from "../../../../../../../workflows/cart-product-groups-delete-items";
import CartSelectionLink from "../../../../../../../links/cart-selection-list"

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {

  const { selection_id, pgroup_id } = req.params

  if (!selection_id || !pgroup_id) {
    res.status(400).send({ message: "Не передан selection_id или pgroup_id" })
    return
  }

  try {
    const b2bModuleService = req.scope.resolve<B2bModuleService>(
      B2B_MODULE
    )
    const query = req.scope.resolve('query')

      const { data } = await query.graph({
        entity: CartSelectionLink.entryPoint,
        fields: ["cart.id"],
        filters: {
          selection_id: selection_id,
        },
      })

      const cart_id = data[0].cart_id


    if (!cart_id)
      {
      res.status(400).json({ message: "Корзина не связана со списком, проверьте корректность связи списка избранного и корзины" })
      return
    }

    const selectionList = await b2bModuleService.retrieveSelection(selection_id, { relations: ['pgroups'] })

    if (!selectionList) {
      res.status(400).json({ message: "Список не найден" })
      return
    }

    if (!Array.isArray(selectionList.pgroups) || selectionList.pgroups.length === 0) {
      res.status(400).json({ message: "Список пуст" })
      return
    }


    const findPgroup = selectionList.pgroups.some(g => g.id === pgroup_id)
    if (!findPgroup) {
      res.status(200).json({ message: "Группа не найдена в списке" })
      return
    }


     await cartProductGroupDeleteItemsWorkflow(
            req.scope,
        ).run({ input: { cart_id: cart_id, pgroup_id: pgroup_id } });

    res.json({ message: `Группа ${pgroup_id} удалена из selection ${selection_id}` })
  } catch (e) {
    console.log(e)
    res.status(500).send({ message: "Ошибка сервера" })
  }
}

