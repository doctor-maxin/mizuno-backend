import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { B2B_MODULE } from "../../../../../../modules/b2b";
import B2bModuleService from "../../../../../../modules/b2b/service";

export async function POST(req: MedusaRequest, res: MedusaResponse) {

  const {selection_id } = req.params

  const { pgroup_id } = req.body as any

  if (!selection_id || !pgroup_id) {
    res.status(400).send({ message: "Не передан selection_id или pgroup_id" })
    return
  }

  try {
    const b2bModuleService = req.scope.resolve<B2bModuleService>(
      B2B_MODULE
    )

    const selectionList = await b2bModuleService.retrieveSelection(selection_id, {relations: ['pgroups']})

    if (!selectionList) {
      res.status(400).json({ message: "Список не найден" })
      return
    }

    if (Array.isArray(selectionList.pgroups)) {
      const alreadyLinked = selectionList.pgroups.some(g => g.id === pgroup_id)
      if (alreadyLinked) {
        res.status(200).json({ message: "Группа уже добавлена в список" })
        return
      }

      const updatedPgroups = [...selectionList.pgroups.map(g => g.id), pgroup_id]

      await b2bModuleService.updateSelections({
        id: selection_id,
        pgroups: updatedPgroups
      })
    } else {
      await b2bModuleService.updateSelections({
        id: selection_id,
        pgroups: [pgroup_id]
      })
    }

    res.json({ message: `Группа ${pgroup_id} добавлена в selection ${selection_id}` })
  } catch (e) {
    console.log(e)
    res.status(500).send({ message: "Ошибка сервера" })
  }
}

