import { model } from "@medusajs/framework/utils"

const Pgroup = model.define("pgroup", {
    id: model.id().primaryKey(),
    product_ids: model.array(),
    season_id: model.text(),
    product_code: model.text(),
    title: model.text(),
    category: model.text().nullable() 
})

export default Pgroup