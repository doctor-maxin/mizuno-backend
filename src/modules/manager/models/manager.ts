import { model } from "@medusajs/framework/utils";

const Manager = model.define("manager", {
    id: model.id().primaryKey(),
    firstName: model.text(),
    lastName: model.text(),
    email: model.text(),
    phone: model.text(),
});

export default Manager;
