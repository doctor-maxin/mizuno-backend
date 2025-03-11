import { model } from "@medusajs/framework/utils"

const SelectionList = model.define("selection-list", {
    id: model.id().primaryKey(),
    title: model.text()
})

export default SelectionList