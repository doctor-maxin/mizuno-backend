import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const seasonHandle = req.query.season as string | undefined
    const filters: Record<string, unknown> = {}

    if (seasonHandle) {
        filters.season_handle = seasonHandle
    }

    const { data } = await query.graph({
        entity: "preorder",
        fields: ["*"],
        filters,
    })

    const preorders = [...data].sort((left, right) =>
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    )

    res.status(200).json({
        preorders: preorders.map((preorder) => ({
            ...preorder,
            items: ((preorder.items as unknown as { rows?: unknown[] })?.rows ??
                []) as unknown[],
        })),
    })
}
