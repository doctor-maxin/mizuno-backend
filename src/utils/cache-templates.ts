export const CART_PRODUCT_GROUP_HASH = (cart_id, pgroup_id, hash) => `CART:${cart_id}:PRODUCT_GROUP:${pgroup_id}:HASH_KEY:${hash}`

export const CART_PRODUCT_GROUP_ITEMS = (cart_id, pgroup_id) => `CART:${cart_id}:PRODUCT_GROUP:${pgroup_id}:ITEMS`