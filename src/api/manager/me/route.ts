import {
    AuthenticatedMedusaRequest,
    MedusaResponse,
} from "@medusajs/framework/http";
import ManagerModuleService from "../../../modules/manager/service";

export async function GET(
    req: AuthenticatedMedusaRequest,
    res: MedusaResponse,
): Promise<void> {
    const query = req.scope.resolve("query");
    const managerId = req.auth_context?.actor_id;

    const {
        data: [manager],
    } = await query.graph(
        {
            entity: "manager",
            fields: ["*"],
            filters: {
                id: managerId,
            },
        },
        {
            throwIfKeyNotFound: true,
        },
    );

    res.json({ manager });
}
