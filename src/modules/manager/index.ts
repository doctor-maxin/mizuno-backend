import ManagerModuleService from "./service";
import { Module } from "@medusajs/framework/utils";

export const BLOG_MODULE = "manager";

export default Module(BLOG_MODULE, {
    service: ManagerModuleService,
});
