import type {
	AuthenticatedMedusaRequest,
	MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { B2B_MODULE } from "../../../../../modules/b2b"
import B2bModuleService from "../../../../../modules/b2b/service"

export async function GET(
	req: AuthenticatedMedusaRequest,
	res: MedusaResponse,
) {
	const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
	const b2bModuleService = req.scope.resolve<B2bModuleService>(B2B_MODULE)
	const customerId = req.auth_context.actor_id
	const orderId = req.params.id

	if (!customerId) {
		throw new MedusaError(
			MedusaError.Types.UNAUTHORIZED,
			"Требуется авторизация клиента",
		)
	}

	const order = await b2bModuleService.getB2bOrderRecord(orderId)

	if (!order) {
		throw new MedusaError(MedusaError.Types.NOT_FOUND, "Заказ не найден")
	}

	const items =
		((order.items as unknown as { rows?: Record<string, unknown>[] })?.rows ??
			[]) as Record<string, unknown>[]
	const customerItems = items.filter((item) => item.customer_id === customerId)

	if (!customerItems.length) {
		throw new MedusaError(MedusaError.Types.NOT_FOUND, "Заказ не найден")
	}

	const customerPreorderIds = [
		...new Set(
			customerItems
				.map((item) =>
					typeof item.preorder_id === "string" ? item.preorder_id : null,
				)
				.filter(Boolean),
		),
	] as string[]

	const { data: preorderRows } = await query.graph({
		entity: "preorder",
		fields: ["id", "code"],
		filters: {
			id: customerPreorderIds,
			customer_id: customerId,
		},
	})
	const preorderCodesById = new Map(
		preorderRows.map((preorder) => [preorder.id, preorder.code]),
	)

	const totalAmount = customerItems.reduce(
		(sum, item) => sum + Number(item.subtotal ?? 0),
		0,
	)
	const totalQuantity = customerItems.reduce(
		(sum, item) => sum + Number(item.quantity ?? 0),
		0,
	)

	res.status(200).json({
		order: {
			...order,
			total_amount: String(totalAmount),
			total_quantity: String(totalQuantity),
			preorder_ids: customerPreorderIds,
			preorder_codes: customerPreorderIds
				.map((id) => preorderCodesById.get(id) ?? id)
				.filter(Boolean),
			items: customerItems,
		},
	})
}
