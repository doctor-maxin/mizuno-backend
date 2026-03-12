import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { B2B_MODULE } from "../../../../../modules/b2b"
import B2bModuleService from "../../../../../modules/b2b/service"
import {
    getOrderTotals,
    normalizeOrderItems,
    type B2bOrderItem,
} from "../../../../../modules/b2b/utils/order"

type UpdateOrderBody = {
    items?: B2bOrderItem[]
    confirm?: boolean
    preorder_ids_to_add?: string[]
}

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const b2bModuleService = req.scope.resolve<B2bModuleService>(B2B_MODULE)
    const id = req.params.id

    const order = await b2bModuleService.getB2bOrderRecord(id)

    if (!order) {
        throw new MedusaError(
            MedusaError.Types.NOT_FOUND,
            "Заказ не найден",
        )
    }

    const { data: preorderRows } = await query.graph({
        entity: "preorder",
        fields: ["id", "code"],
        filters: {
            id: order.preorder_ids,
        },
    })
    const preorderCodesById = new Map(
        preorderRows.map((preorder) => [preorder.id, preorder.code]),
    )

    res.status(200).json({
        order: {
            ...order,
            preorder_codes: order.preorder_ids
                .map((preorderId) => preorderCodesById.get(preorderId) ?? preorderId)
                .filter(Boolean),
            items: ((order.items as unknown as { rows?: unknown[] })?.rows ??
                []) as unknown[],
        },
    })
}

export async function PATCH(
    req: AuthenticatedMedusaRequest<UpdateOrderBody>,
    res: MedusaResponse,
) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const b2bModuleService = req.scope.resolve<B2bModuleService>(B2B_MODULE)
    const id = req.params.id

    const order = await b2bModuleService.getB2bOrderRecord(id)

    if (!order) {
        throw new MedusaError(
            MedusaError.Types.NOT_FOUND,
            "Заказ не найден",
        )
    }

    if (order.status === "confirmed") {
        throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "Подтвержденный заказ нельзя изменить",
        )
    }

    const preorderIdsToAdd = [...new Set(req.body.preorder_ids_to_add || [])]

    if (preorderIdsToAdd.length) {
        const { data: preordersToAdd } = await query.graph({
            entity: "preorder",
            fields: ["*"],
            filters: {
                id: preorderIdsToAdd,
            },
        })

        if (preordersToAdd.length !== preorderIdsToAdd.length) {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "Некоторые предзаказы не найдены",
            )
        }

        const alreadyLinkedToOtherOrder = preordersToAdd.find(
            (preorder) => preorder.order_id && preorder.order_id !== order.id,
        )

        if (alreadyLinkedToOtherOrder) {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                `Предзаказ ${alreadyLinkedToOtherOrder.code} уже добавлен в другой заказ`,
            )
        }

        const existingItems =
            (((order.items as unknown as { rows?: B2bOrderItem[] })?.rows ??
                []) as B2bOrderItem[]) || []

        const appendedItems = preordersToAdd.flatMap((preorder) =>
            (
                ((preorder.items as unknown as { rows?: B2bOrderItem[] })?.rows ?? []) ||
                []
            ).map((item, index) => ({
                ...item,
                id: item.id || `${preorder.id}-${item.variant_id ?? index}`,
                preorder_id: preorder.id,
                customer_id: preorder.customer_id,
                customer_name: preorder.customer_name,
                metadata: {
                    ...(item.metadata ?? {}),
                    ordered_quantity: Number(
                        item.metadata?.ordered_quantity ?? item.quantity ?? 0,
                    ),
                },
            })),
        )

        const totals = getOrderTotals(
            normalizeOrderItems([...existingItems, ...appendedItems]),
        )
        const mergedPreorderIds = [
            ...new Set([...(order.preorder_ids as string[]), ...preorderIdsToAdd]),
        ]

        await b2bModuleService.updateB2bOrderRecord(id, {
            preorder_ids: mergedPreorderIds,
            total_amount: String(totals.totalAmount),
            total_quantity: String(totals.totalQuantity),
            items: { rows: totals.items } as Record<string, unknown>,
        })

        await b2bModuleService.updatePreorders(
            preordersToAdd.map((preorder) => ({
                id: preorder.id,
                status: "in_order",
                order_id: order.id,
            })),
        )
    }

    const currentOrder = await b2bModuleService.getB2bOrderRecord(id)

    if (!currentOrder) {
        throw new MedusaError(
            MedusaError.Types.NOT_FOUND,
            "Заказ не найден",
        )
    }

    const inputItems =
        req.body.items ??
        (((currentOrder.items as unknown as { rows?: B2bOrderItem[] })?.rows ??
            []) as B2bOrderItem[])
    const totals = getOrderTotals(normalizeOrderItems(inputItems))
    const nextStatus = req.body.confirm ? "confirmed" : "draft"

    await b2bModuleService.updateB2bOrderRecord(id, {
        status: nextStatus,
        total_amount: String(totals.totalAmount),
        total_quantity: String(totals.totalQuantity),
        items: { rows: totals.items } as Record<string, unknown>,
    })

    if (req.body.confirm) {
        await b2bModuleService.updatePreorders(
            (currentOrder.preorder_ids as string[]).map((preorderId) => ({
                id: preorderId,
                status: "confirmed",
                order_id: currentOrder.id,
            })),
        )
    }

    const updatedOrder = await b2bModuleService.getB2bOrderRecord(id)

    if (!updatedOrder) {
        throw new MedusaError(
            MedusaError.Types.NOT_FOUND,
            "Заказ не найден",
        )
    }

    const { data: preorderRows } = await query.graph({
        entity: "preorder",
        fields: ["id", "code"],
        filters: {
            id: updatedOrder.preorder_ids,
        },
    })
    const preorderCodesById = new Map(
        preorderRows.map((preorder) => [preorder.id, preorder.code]),
    )

    res.status(200).json({
        order: {
            ...updatedOrder,
            preorder_codes: updatedOrder.preorder_ids
                .map((preorderId) => preorderCodesById.get(preorderId) ?? preorderId)
                .filter(Boolean),
            items: ((updatedOrder.items as unknown as { rows?: unknown[] })?.rows ??
                []) as unknown[],
        },
    })
}
