import { ModuleProvider, Modules } from "@medusajs/framework/utils";
import UnisenderNotificationService from "./service";

export default ModuleProvider(Modules.NOTIFICATION, {
    services: [UnisenderNotificationService],
});
