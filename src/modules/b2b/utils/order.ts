export type B2bOrderItem = {
    id: string
    preorder_id: string
    customer_id: string
    customer_name: string
    product_id: string | null
    variant_id: string | null
    title: string
    variant_title: string
    sku: string
    thumbnail: string | null
    unit_price: number
    quantity: number
    subtotal: number
    metadata?: {
        ordered_quantity?: number
        original_unit_price?: number
        discount_type?: string
        discount_value?: number
        discount_percent?: number
        discount_group_id?: string
        discount_group_name?: string
    }
}

export const createDisplayCode = (prefix: string) => {
    const random = Math.floor(Math.random() * 9000 + 1000)
    return `${prefix}-${Date.now().toString().slice(-6)}${random}`
}

export const normalizeOrderItems = (items: B2bOrderItem[]) =>
    items.map((item, index) => {
        const unitPrice = Number(item.unit_price ?? 0)
        const quantity = Number(item.quantity ?? 0)

        return {
            ...item,
            id: item.id || `${item.preorder_id}-${item.variant_id ?? index}`,
            product_id: item.product_id ?? null,
            variant_id: item.variant_id ?? null,
            title: item.title ?? "",
            variant_title: item.variant_title ?? "",
            sku: item.sku ?? "",
            thumbnail: item.thumbnail ?? null,
            unit_price: unitPrice,
            quantity,
            subtotal: unitPrice * quantity,
            metadata:
                item.metadata && typeof item.metadata === "object"
                    ? {
                      ...item.metadata,
                      ordered_quantity: Number(
                          item.metadata.ordered_quantity ?? quantity,
                      ),
                      original_unit_price: Number(
                          item.metadata.original_unit_price ?? unitPrice,
                      ),
                      discount_value:
                          item.metadata.discount_value != null
                              ? Number(item.metadata.discount_value)
                              : undefined,
                      discount_percent:
                          item.metadata.discount_percent != null
                              ? Number(item.metadata.discount_percent)
                              : undefined,
                  }
                    : {
                          ordered_quantity: quantity,
                      },
        }
    })

export const getOrderTotals = (items: B2bOrderItem[]) => {
    const normalizedItems = normalizeOrderItems(items)

    const totalAmount = normalizedItems.reduce(
        (sum, item) => sum + Number(item.subtotal ?? 0),
        0,
    )
    const totalQuantity = normalizedItems.reduce(
        (sum, item) => sum + Number(item.quantity ?? 0),
        0,
    )

    return {
        items: normalizedItems,
        totalAmount,
        totalQuantity,
    }
}
