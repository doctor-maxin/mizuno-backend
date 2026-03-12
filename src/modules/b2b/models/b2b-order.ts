import { model } from "@medusajs/framework/utils"

const B2bOrder = model.define("b2b_order", {
    id: model.id().primaryKey(),
    code: model.text(),
    status: model.text(),
    season_handle: model.text().nullable(),
    currency_code: model.text().nullable(),
    total_amount: model.text(),
    total_quantity: model.text(),
    preorder_ids: model.array(),
    items: model.json(),
    metadata: model.json().nullable(),
})

export default B2bOrder
