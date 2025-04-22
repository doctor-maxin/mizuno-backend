import { model } from "@medusajs/framework/utils"

const SelectionList = model.define("selection", {
    id: model.id().primaryKey(),
    title: model.text().nullable(),
    is_open: model.boolean().default(true)
})

export default SelectionList