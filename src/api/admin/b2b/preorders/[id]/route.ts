import type {
	AuthenticatedMedusaRequest,
	MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export async function GET(
	req: AuthenticatedMedusaRequest,
	res: MedusaResponse,
) {
	const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
	const preorderId = req.params.id

	const { data } = await query.graph({
		entity: "preorder",
		fields: ["*"],
		filters: {
			id: preorderId,
		},
	})

	const preorder = data[0]

	if (!preorder) {
		res.status(404).json({
			message: "Предзаказ не найден",
		})
		return
	}

	res.status(200).json({
		preorder: {
			...preorder,
			items: ((preorder.items as unknown as { rows?: unknown[] })?.rows ??
				[]) as unknown[],
		},
	})
}
