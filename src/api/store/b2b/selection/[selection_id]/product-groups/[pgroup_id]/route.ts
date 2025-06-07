import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { B2B_MODULE } from "../../../../../../../modules/b2b";
import B2bModuleService from "../../../../../../../modules/b2b/service";

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

    const updatedPgroups = selectionList.pgroups.filter(pg => pg.id !== pgroup_id)

    if (updatedPgroups.length === 0) {
      await b2bModuleService.clearSelection(selection_id, pgroup_id)
      res.json({ message: `Группа ${pgroup_id} удалена из selection ${selection_id}. Список пуст` })
      return
    }

    await b2bModuleService.updateSelections({
      id: selection_id,
      pgroups: []
    })

    res.json({ message: `Группа ${pgroup_id} удалена из selection ${selection_id}` })
  } catch (e) {
    console.log(e)
    res.status(500).send({ message: "Ошибка сервера" })
  }
}

