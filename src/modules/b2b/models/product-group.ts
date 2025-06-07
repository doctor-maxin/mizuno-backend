import { model } from "@medusajs/framework/utils"
import SelectionList from "./selection"

const Pgroup = model.define("pgroup", {
    id: model.id().primaryKey(),
    product_ids: model.array(),
    season_id: model.text(),
    product_code: model.text(),
    title: model.text(),
    category: model.text().nullable(),
    selection_list: model.manyToMany(() => SelectionList, {
        mappedBy: "pgroups"
    }),
    metadata: model.json().nullable()
})

export default Pgroup