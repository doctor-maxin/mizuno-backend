import { model } from "@medusajs/framework/utils"

const Preorder = model.define("preorder", {
    id: model.id().primaryKey(),
    code: model.text(),
    status: model.text(),
    cart_id: model.text().nullable(),
    order_id: model.text().nullable(),
    customer_id: model.text(),
    customer_name: model.text(),
    customer_email: model.text().nullable(),
    season_handle: model.text().nullable(),
    currency_code: model.text().nullable(),
    total_amount: model.text(),
    total_quantity: model.text(),
    items: model.json(),
    metadata: model.json().nullable(),
})

export default Preorder
