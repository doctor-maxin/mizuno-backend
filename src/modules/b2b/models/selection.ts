import { model } from "@medusajs/framework/utils"
import Pgroup from "./product-group"

const SelectionList = model.define("selection", {
    id: model.id().primaryKey(),
    title: model.text().nullable(),
    is_open: model.boolean().default(true),
    pgroups: model.manyToMany(() => Pgroup, {
        mappedBy: "selection_list"
    })
})

export default SelectionList