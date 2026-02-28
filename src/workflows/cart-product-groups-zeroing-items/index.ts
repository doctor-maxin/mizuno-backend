import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { updateLineItemsStep, useQueryGraphStep } from "@medusajs/medusa/core-flows"


export type cartProductGroupDeleteItemsWorkflowInput = {
    cart_id: string;
    pgroup_id: string;
}


export const cartProductGroupZeroingItemsWorkflow = createWorkflow(
    "cart-product-group-zeroing-items",
    (input: cartProductGroupDeleteItemsWorkflowInput) => {


        const { data: currentLineItemsAtCart } = useQueryGraphStep({
            entity: "cart",
            fields: [
                "id",
                "items.id",
                "items.variant.product_id"
            ],
            filters: {
                id: input.cart_id
            }
        }).config({ name: "fetch-cart" })

        const { data: productGroupProducts } = useQueryGraphStep({
            entity: "pgroup",
            fields: [
                "id",
                "product_link.product.id"
            ],
            filters: {
                id: input.pgroup_id
            }
        }).config({ name: "fetch-product-groups" })


        const productGroupItems = transform({ currentLineItemsAtCart, productGroupProducts },
            (data) => {
                const productIds = new Set(
                    (data.productGroupProducts?.[0]?.product_link || [])
                        .map(item => item?.product_id)
                        .filter(Boolean)
                );

                return (data.currentLineItemsAtCart?.[0]?.items || [])
                    .filter((item: any) =>
                        productIds.has(item?.variant?.product_id)
                    )
                    .map(item => ({ id: item?.id, quantity: 0 }))
            }
        )

        const products = updateLineItemsStep({
            id: input.cart_id,
            items: productGroupItems
        })

        return new WorkflowResponse({ message: "Обнулены все позиции связанные с товарной группой", products: products})
    }
)