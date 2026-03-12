import type {
	AuthenticatedMedusaRequest,
	MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

export async function GET(
	req: AuthenticatedMedusaRequest,
	res: MedusaResponse,
) {
	const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
	const customerId = req.auth_context.actor_id
	const preorderId = req.params.id

	if (!customerId) {
		throw new MedusaError(
			MedusaError.Types.UNAUTHORIZED,
			"Требуется авторизация клиента",
		)
	}

	const { data } = await query.graph({
		entity: "preorder",
		fields: ["*"],
		filters: {
			id: preorderId,
			customer_id: customerId,
		},
	})

	const preorder = data[0]

	if (!preorder) {
		throw new MedusaError(MedusaError.Types.NOT_FOUND, "Предзаказ не найден")
	}

	res.status(200).json({
		preorder: {
			...preorder,
			items: ((preorder.items as unknown as { rows?: unknown[] })?.rows ??
				[]) as unknown[],
		},
	})
}
