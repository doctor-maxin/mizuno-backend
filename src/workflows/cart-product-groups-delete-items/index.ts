import { createStep, createWorkflow, StepResponse, transform, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { CartDTO } from "@medusajs/framework/types"
import { addToCartWorkflow, createRemoteLinkStep, deleteLineItemsStep, deleteLineItemsWorkflow, updateLineItemsStep, useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { B2B_MODULE } from "../../modules/b2b"
import { CART_PRODUCT_GROUP_ITEMS } from "../../utils/cache-templates"
import { cartSelectionClearStep } from "../cart-clear-all-pgroups-items"

export type cartProductGroupDeleteItemsWorkflowInput = {
    cart_id: string;
    pgroup_id: string;
}


export const cartProductGroupDeleteItemsWorkflow = createWorkflow(
    "cart-product-group-delete-items",
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
                "product_link.product.id",
                "selection_list.*"
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
                    .map(item => item?.id)
            }

        )





// onst chekcStepResult = checkStep({ currentLineItemsAtCart, productGroupProducts })

        const products = deleteLineItemsWorkflow.runAsStep({
            input: {
                cart_id: input.cart_id,
                ids: productGroupItems
            },
        })


        const pgroupsDelete = cartSelectionClearStep({selectionId:productGroupProducts[0]?.selection_list[0]?.id, selectionProductGroups:[input.pgroup_id]})
    

        return new WorkflowResponse({message: "Удалены позиции связанные с товарной группой", products, pgroupsDelete})
    }
)