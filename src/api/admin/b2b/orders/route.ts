import type {
    AuthenticatedMedusaRequest,
    MedusaResponse,
} from "@medusajs/framework/http";
import {
    ContainerRegistrationKeys,
    MedusaError,
} from "@medusajs/framework/utils";
import { B2B_MODULE } from "../../../../modules/b2b";
import B2bModuleService from "../../../../modules/b2b/service";
import {
    createDisplayCode,
    getOrderTotals,
    type B2bOrderItem,
} from "../../../../modules/b2b/utils/order";

type CreateOrderBody = {
    preorder_ids: string[];
};

export async function GET(
    req: AuthenticatedMedusaRequest,
    res: MedusaResponse,
) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const seasonHandle = req.query.season as string | undefined;
    const b2bModuleService = req.scope.resolve<B2bModuleService>(B2B_MODULE);
    const orders = await b2bModuleService.listB2bOrderRecords({
        season_handle: seasonHandle,
    });
    const preorderIds = [
        ...new Set(orders.flatMap((order) => order.preorder_ids).filter(Boolean)),
    ];
    const preorderCodesById = new Map<string, string>();

    if (preorderIds.length) {
        const { data: preorderRows } = await query.graph({
            entity: "preorder",
            fields: ["id", "code"],
            filters: {
                id: preorderIds,
            },
        });

        preorderRows.forEach((preorder) => {
            preorderCodesById.set(preorder.id, preorder.code);
        });
    }

    res.status(200).json({
        orders: orders.map((order) => ({
            ...order,
            preorder_codes: order.preorder_ids
                .map((id) => preorderCodesById.get(id) ?? id)
                .filter(Boolean),
            items: ((order.items as unknown as { rows?: unknown[] })?.rows ??
                []) as unknown[],
        })),
    });
}

export async function POST(
    req: AuthenticatedMedusaRequest<CreateOrderBody>,
    res: MedusaResponse,
) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const b2bModuleService = req.scope.resolve<B2bModuleService>(B2B_MODULE);
    const preorderIds = [...new Set(req.body.preorder_ids || [])];

    if (!preorderIds.length) {
        throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "Не выбраны предзаказы",
        );
    }

    const { data: preorders } = await query.graph({
        entity: "preorder",
        fields: ["*"],
        filters: {
            id: preorderIds,
        },
    });

    if (preorders.length !== preorderIds.length) {
        throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "Некоторые предзаказы не найдены",
        );
    }

    const alreadyLinked = preorders.find((preorder) => preorder.order_id);
    if (alreadyLinked) {
        throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            `Предзаказ ${alreadyLinked.code} уже добавлен в заказ`,
        );
    }

    const items = preorders.flatMap((preorder) =>
        (
            ((preorder.items as unknown as { rows?: B2bOrderItem[] })?.rows ??
                []) ||
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
    );

    const totals = getOrderTotals(items);
    const code = createDisplayCode("ORD");

    const orderId = await b2bModuleService.createB2bOrderRecord({
        code,
        status: "draft",
        season_handle: preorders[0]?.season_handle ?? null,
        currency_code: preorders[0]?.currency_code ?? "rub",
        total_amount: String(totals.totalAmount),
        total_quantity: String(totals.totalQuantity),
        preorder_ids: preorders.map((preorder) => preorder.id),
        items: { rows: totals.items } as Record<string, unknown>,
    });

    await b2bModuleService.updatePreorders(
        preorders.map((preorder) => ({
            id: preorder.id,
            status: "in_order",
            order_id: orderId,
        })),
    );

    const order = await b2bModuleService.getB2bOrderRecord(orderId);

    if (!order) {
        throw new MedusaError(
            MedusaError.Types.UNEXPECTED_STATE,
            "Не удалось загрузить созданный заказ",
        );
    }

    const preorderCodes = preorders.map((preorder) => preorder.code);

    res.status(200).json({
        order: {
            ...order,
            preorder_codes: preorderCodes,
            items: totals.items,
        },
    });
}
