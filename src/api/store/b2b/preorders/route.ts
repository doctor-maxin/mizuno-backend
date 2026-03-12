import {
    AuthenticatedMedusaRequest,
    MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { B2B_MODULE } from "../../../../modules/b2b"
import B2bModuleService from "../../../../modules/b2b/service"
import {
    createDisplayCode,
    getOrderTotals,
    type B2bOrderItem,
} from "../../../../modules/b2b/utils/order"

type CreatePreorderBody = {
    cart_id: string
    season_handle?: string
}

type DiscountInfo = {
    type: "percentage" | "flat"
    value: number
    percent?: number
    groupId?: string
    groupName?: string
}

const toNumber = (value: unknown) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
}

const resolveCustomerDiscount = (
    groups: Array<{ id?: string; name?: string; metadata?: Record<string, unknown> }> = [],
): DiscountInfo | null => {
    for (const group of groups) {
        const metadata =
            group.metadata && typeof group.metadata === "object"
                ? group.metadata
                : {}
        const rawGroupType = String(metadata.type ?? "")
        const rawDiscountType = String(
            metadata.discount_type ?? metadata.price_type ?? "",
        ).toLowerCase()
        const rawValue =
            toNumber(metadata.discount_percent) ??
            toNumber(metadata.discount_value) ??
            toNumber(metadata.percent) ??
            toNumber(metadata.value)

        const normalizedType =
            rawDiscountType === "percentage" ||
            rawDiscountType === "percent" ||
            (!rawDiscountType && rawValue !== null)
                ? "percentage"
                : rawDiscountType === "flat" || rawDiscountType === "fixed"
                  ? "flat"
                  : null

        if (
            rawGroupType === "discount" &&
            normalizedType &&
            rawValue !== null &&
            rawValue > 0
        ) {
            return {
                type: normalizedType,
                value: rawValue,
                percent: normalizedType === "percentage" ? rawValue : undefined,
                groupId: group.id,
                groupName: group.name,
            }
        }
    }

    return null
}

const applyDiscount = (price: number, discount: DiscountInfo | null) => {
    if (!discount) return price

    if (discount.type === "flat") {
        return Math.max(0, Math.round(price - discount.value))
    }

    return Math.max(0, Math.round(price - (price * discount.value) / 100))
}

export async function GET(
    req: AuthenticatedMedusaRequest,
    res: MedusaResponse,
) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const customerId = req.auth_context.actor_id
    const seasonHandle = req.query.season as string | undefined

    if (!customerId) {
        throw new MedusaError(
            MedusaError.Types.UNAUTHORIZED,
            "Требуется авторизация клиента",
        )
    }

    const filters: Record<string, unknown> = {
        customer_id: customerId,
    }

    if (seasonHandle) {
        filters.season_handle = seasonHandle
    }

    const { data } = await query.graph({
        entity: "preorder",
        fields: ["*"],
        filters,
    })

    const preorders = [...data].sort(
        (left, right) =>
            new Date(right.created_at).getTime() -
            new Date(left.created_at).getTime(),
    )

    res.status(200).json({
        preorders: preorders.map((preorder) => ({
            ...preorder,
            items: ((preorder.items as unknown as { rows?: unknown[] })?.rows ??
                []) as unknown[],
        })),
    })
}

export async function POST(
    req: AuthenticatedMedusaRequest<CreatePreorderBody>,
    res: MedusaResponse,
) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const b2bModuleService = req.scope.resolve<B2bModuleService>(B2B_MODULE)
    const customerId = req.auth_context.actor_id
    const { cart_id, season_handle } = req.body

    if (!customerId) {
        throw new MedusaError(
            MedusaError.Types.UNAUTHORIZED,
            "Customer auth is required",
        )
    }

    if (!cart_id) {
        throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "Не передан идентификатор корзины",
        )
    }

    const existingFilters: Record<string, unknown> = {
        cart_id,
        customer_id: customerId,
    }

    const {
        data: [existingPreorder],
    } = await query.graph({
        entity: "preorder",
        fields: ["*"],
        filters: existingFilters as any,
    })

    if (
        existingPreorder &&
        ["placed", "in_order"].includes(existingPreorder.status)
    ) {
        return res.status(200).json({ preorder: existingPreorder })
    }

    const {
        data: [cart],
    } = await query.graph(
        {
            entity: "cart",
            fields: [
                "id",
                "currency_code",
                "total",
                "items.id",
                "items.product_id",
                "items.variant_id",
                "items.quantity",
                "items.unit_price",
                "items.title",
                "items.subtitle",
                "items.thumbnail",
                "items.product_title",
                "items.variant_title",
                "selection.id",
                "selection.pgroups.id",
                "selection.pgroups.season_id",
            ],
            filters: {
                id: cart_id,
            },
        },
        { throwIfKeyNotFound: true },
    )

    const {
        data: [customer],
    } = await query.graph(
        {
            entity: "customer",
            fields: [
                "id",
                "email",
                "first_name",
                "last_name",
                "groups.id",
                "groups.name",
                "groups.metadata",
            ],
            filters: {
                id: customerId,
            },
        },
        { throwIfKeyNotFound: true },
    )
    const customerDiscount = resolveCustomerDiscount(customer.groups ?? [])

    const placedItems = (cart.items || [])
        .filter(
            (
                item,
            ): item is NonNullable<(typeof cart.items)[number]> =>
                item !== null && Number(item.quantity ?? 0) > 0,
        )
        .map(
            (item, index): B2bOrderItem => ({
                ...(customerDiscount
                    ? {
                          metadata: {
                              original_unit_price: Number(item.unit_price ?? 0),
                              discount_type: customerDiscount.type,
                              discount_value: customerDiscount.value,
                              discount_percent: customerDiscount.percent,
                              discount_group_id: customerDiscount.groupId,
                              discount_group_name: customerDiscount.groupName,
                          },
                      }
                    : {
                          metadata: {
                              original_unit_price: Number(item.unit_price ?? 0),
                          },
                      }),
                id: `${cart.id}-${item.variant_id ?? index}`,
                preorder_id: "",
                customer_id: customer.id,
                customer_name:
                    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
                    customer.email ||
                    "Клиент",
                product_id: item.product_id ?? null,
                variant_id: item.variant_id ?? null,
                title:
                    item.product_title ?? item.title ?? item.subtitle ?? "Товар",
                variant_title: item.variant_title ?? "",
                sku: item.variant_id ?? "",
                thumbnail: item.thumbnail ?? null,
                unit_price: applyDiscount(
                    Number(item.unit_price ?? 0),
                    customerDiscount,
                ),
                quantity: Number(item.quantity ?? 0),
                subtotal:
                    applyDiscount(
                        Number(item.unit_price ?? 0),
                        customerDiscount,
                    ) * Number(item.quantity ?? 0),
            }),
        )

    if (!placedItems.length) {
        throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "Корзина пуста",
        )
    }

    let resolvedSeasonHandle = season_handle ?? null
    if (!resolvedSeasonHandle) {
        const seasonId = cart.selection?.pgroups?.[0]?.season_id
        if (seasonId) {
            const {
                data: [season],
            } = await query.graph({
                entity: "season",
                fields: ["id", "handle"],
                filters: {
                    id: seasonId,
                },
            })
            resolvedSeasonHandle = season?.handle ?? null
        }
    }

    const code = createDisplayCode("P")
    const items = placedItems.map((item) => ({
        ...item,
        preorder_id: code,
    }))
    const totals = getOrderTotals(items)

    const preorder = await b2bModuleService.createPreorders({
        code,
        status: "placed",
        cart_id: cart.id,
        order_id: null,
        customer_id: customer.id,
        customer_name:
            [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
            customer.email ||
            "Клиент",
        customer_email: customer.email ?? null,
        season_handle: resolvedSeasonHandle,
        currency_code: cart.currency_code ?? "rub",
        total_amount: String(totals.totalAmount),
        total_quantity: String(totals.totalQuantity),
        items: { rows: totals.items } as Record<string, unknown>,
    })

    res.status(200).json({
        preorder: {
            ...preorder,
            items: totals.items,
        },
    })
}
