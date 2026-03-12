import type {
    AuthenticatedMedusaRequest,
    MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { B2B_MODULE } from "../../../../modules/b2b"
import B2bModuleService from "../../../../modules/b2b/service"

type HistoryEntry = {
    id: string
    kind: "preorder" | "order" | "approval"
    display_id: string
    season: string
    products_count: number
    status: string
    customer: string
    manager: string
    placed_at: string
    completed_at: string | null
    total: number
    sort_at: string
}

const toSeasonLabel = (handle?: string | null) =>
    handle ? handle.toUpperCase() : "-"

const toIsoString = (value?: string | Date | null) =>
    value ? new Date(value).toISOString() : null

export async function GET(
    req: AuthenticatedMedusaRequest,
    res: MedusaResponse,
) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
    const b2bModuleService = req.scope.resolve<B2bModuleService>(B2B_MODULE)
    const customerId = req.auth_context.actor_id

    if (!customerId) {
        throw new MedusaError(
            MedusaError.Types.UNAUTHORIZED,
            "Customer auth is required",
        )
    }

    const {
        data: [customer],
    } = await query.graph(
        {
            entity: "customer",
            fields: ["id", "email", "first_name", "last_name", "metadata"],
            filters: {
                id: customerId,
            },
        },
        { throwIfKeyNotFound: true },
    )

    const customerName =
        [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
        customer.email ||
        "Клиент"
    const managerName =
        typeof customer.metadata?.manager === "object" &&
        customer.metadata?.manager &&
        "fullName" in customer.metadata.manager
            ? String(customer.metadata.manager.fullName ?? "-")
            : "-"

    const { data: preorders } = await query.graph({
        entity: "preorder",
        fields: ["*"],
        filters: {
            customer_id: customerId,
        },
    })

    const preorderRows: HistoryEntry[] = preorders
        .filter((preorder) => !preorder.order_id)
        .map((preorder) => ({
            id: `preorder:${preorder.id}`,
            kind: "preorder",
            display_id: preorder.code,
            season: toSeasonLabel(preorder.season_handle),
            products_count: Number(preorder.total_quantity ?? 0),
            status: "Ждёт подтверждения",
            customer: preorder.customer_name || customerName,
            manager: managerName,
            placed_at: toIsoString(preorder.created_at) || new Date().toISOString(),
            completed_at: null,
            total: Number(preorder.total_amount ?? 0),
            sort_at:
                toIsoString(preorder.created_at) ||
                toIsoString(preorder.updated_at) ||
                new Date().toISOString(),
        }))

    const orderIds = [...new Set(preorders.map((preorder) => preorder.order_id).filter(Boolean))]

    const orderRows: HistoryEntry[] = []

    if (orderIds.length) {
        try {
            const orders = await b2bModuleService.listB2bOrderRecords({
                ids: orderIds as string[],
            })

            for (const order of orders) {
                const items =
                    ((order.items as unknown as { rows?: Record<string, unknown>[] })?.rows ??
                        []) as Record<string, unknown>[]

                const customerItems = items.filter(
                    (item) => item.customer_id === customerId,
                )

                if (!customerItems.length) {
                    continue
                }

                const total = customerItems.reduce(
                    (sum, item) => sum + Number(item.subtotal ?? 0),
                    0,
                )
                const productsCount = customerItems.reduce(
                    (sum, item) => sum + Number(item.quantity ?? 0),
                    0,
                )

                orderRows.push({
                    id: `order:${order.id}`,
                    kind: order.status === "confirmed" ? "approval" : "order",
                    display_id: order.code,
                    season: toSeasonLabel(order.season_handle),
                    products_count: productsCount,
                    status:
                        order.status === "confirmed"
                            ? "Подтверждён"
                            : "Подтверждение",
                    customer: customerName,
                    manager: managerName,
                    placed_at:
                        toIsoString(order.created_at) || new Date().toISOString(),
                    completed_at:
                        order.status === "confirmed"
                            ? toIsoString(order.updated_at)
                            : null,
                    total,
                    sort_at:
                        toIsoString(order.created_at) ||
                        toIsoString(order.updated_at) ||
                        new Date().toISOString(),
                })
            }
        } catch (error) {
            logger.warn(
                `[b2b-history] failed to load orders for customer ${customerId}: ${error instanceof Error ? error.message : String(error)}`,
            )
        }
    }

    const history = [...preorderRows, ...orderRows].sort(
        (left, right) =>
            new Date(right.sort_at).getTime() - new Date(left.sort_at).getTime(),
    )

    res.status(200).json({
        history: history.map(({ sort_at, ...row }) => row),
    })
}
