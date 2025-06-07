import { model } from "@medusajs/framework/utils"

const Season = model.define("season", {
    id: model.id().primaryKey(),
    title: model.text(),
    handle: model.text(),
    start_at: model.dateTime().nullable(),
    end_at: model.dateTime().nullable()
})

export default Season