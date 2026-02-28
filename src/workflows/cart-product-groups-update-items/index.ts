import {
    createStep,
    createWorkflow,
    StepResponse,
    transform,
    when,
    WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { CartDTO } from "@medusajs/framework/types";
import {
    addToCartWorkflow,
    createRemoteLinkStep,
    updateLineItemsStep,
    useQueryGraphStep,
} from "@medusajs/medusa/core-flows";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { B2B_MODULE } from "../../modules/b2b";
import { CART_PRODUCT_GROUP_ITEMS } from "../../utils/cache-templates";

export type cartProductGroupItemsUpdateQuantityWorkflowInput = {
    cart_id: string;
    pgroup_id?: string;
    items: {
        variant_id: string;
        quantity: number;
    }[];
};

export const cartProductGroupItemsUpdateQuantityStep = createStep(
    "cart-product-group-items-update-quantity",
    async (
        input: cartProductGroupItemsUpdateQuantityWorkflowInput,
        { container },
    ) => {
        const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
        const cache = container.resolve("cache");
        const query = container.resolve("query");

        const cartCurrent = await query.graph({
            entity: "cart",
            fields: ["id", "items.id", "items.quantity", "items.variant.id"],
            filters: {
                id: input.cart_id,
            },
        });

        const cartProductGroupItems = await cache.get(
            CART_PRODUCT_GROUP_ITEMS(input.cart_id, input.pgroup_id),
        );

        return new StepResponse(cartCurrent);
    },
);

export const cartProductGroupItemsUpdateQuantityWorkflow = createWorkflow(
    "cart-product-group-items-update-quantity",
    (input: cartProductGroupItemsUpdateQuantityWorkflowInput) => {
        const { data: currentLineItemsAtCart } = useQueryGraphStep({
            entity: "cart",
            fields: [
                "id",
                "items.id",
                "items.quantity",
                "items.variant_id",
                "items.variant.product_id",
            ],
            filters: {
                id: input.cart_id,
            },
        }).config({ name: "fetch-cart" });

        const { data: productGroupProducts } = useQueryGraphStep({
            entity: "pgroup",
            fields: ["id", "product_link.product.id"],
            filters: {
                id: input.pgroup_id,
            },
        }).config({ name: "fetch-product-groups" });

        // const { data: pro}

        const productGroupItems = transform(
            { currentLineItemsAtCart, productGroupProducts },
            (data) => {
                const productIds = new Set(
                    (data.productGroupProducts?.[0]?.product_link || [])
                        .map((item) => item?.product_id)
                        .filter(Boolean),
                );

                return (
                    data.currentLineItemsAtCart?.[0]?.items ||
                    [].filter((item: any) =>
                        productIds.has(item?.variant?.product_id),
                    )
                );
            },
        );

        const { updateOnlyLineItems, updateItems } = transform(
            { productGroupItems, input },
            (data) => {
                const updateOnlyItems = data.productGroupItems.filter((item) =>
                    data.input.items.some(
                        (line_item) =>
                            line_item.variant_id === item?.variant_id,
                    ),
                );
                const updateOnlyLineItems = updateOnlyItems.map((item) => ({
                    id: item?.id,
                    quantity: data.input.items.find(
                        (input_item) =>
                            input_item.variant_id === item?.variant_id,
                    )?.quantity,
                }));

                const updateItems = updateOnlyItems.map((item) => ({
                    variant: item?.variant_id,
                    quantity: data.input.items.find(
                        (input_item) =>
                            input_item.variant_id === item?.variant_id,
                    )?.quantity,
                }));

                return { updateOnlyLineItems, updateItems };
            },
        );

        const addToCartItems = transform({ updateItems, input }, (data) =>
            data.input.items.filter(
                (item) =>
                    !data.updateItems.some(
                        (line_item) => line_item?.variant === item.variant_id,
                    ),
            ),
        );

        const updateLineItemsResult = updateLineItemsStep({
            id: input.cart_id,
            items: updateOnlyLineItems,
        });

        const addToCartResult = addToCartWorkflow.runAsStep({
            input: {
                cart_id: input.cart_id,
                items: addToCartItems,
            },
        });

        const { data: updatedLineItemsCart } = useQueryGraphStep({
            entity: "cart",
            fields: [
                "id",
                "items.quantity",
                "items.variant.product_id",
                "items.variant_id",
            ],
            filters: {
                id: input.cart_id,
            },
        }).config({ name: "fetch-cart-after-update" });

        // const { data: pro}

        const productGroupItemsAfterUpdate = transform(
            { updatedLineItemsCart, productGroupProducts },
            (data) => {
                const productIds = new Set(
                    (data.productGroupProducts?.[0]?.product_link || [])
                        .map((item) => item?.product_id)
                        .filter(Boolean),
                );

                return (data.updatedLineItemsCart?.[0]?.items || [])
                    .filter((item: any) =>
                        productIds.has(item?.variant?.product_id),
                    )
                    .map((item) => ({
                        quantity: item?.quantity,
                        variant_id: item?.variant_id,
                    }));
            },
        );

        // const result = transform({updatedLineItemsCart},
        //     (data) => data.updatedLineItemsCart[0].items.map(item => ({quantity: item?.quantity, variant_id: item?.variant_id}))
        // )

        // const cart = cartProductGroupItemsUpdateQuantityStep(input)

        return new WorkflowResponse(productGroupItemsAfterUpdate);
    },
);
