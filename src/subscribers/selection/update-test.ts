import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateAction, updateSelectionListWorkflow } from "../../workflows/update-selection"

export default async function cartUpdateHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {

  const logger = container.resolve("logger")

    logger.info(JSON.stringify(data, null, 2))

}

export const config: SubscriberConfig = {
  event: "selection.updated",
}