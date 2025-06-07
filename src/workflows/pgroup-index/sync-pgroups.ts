import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { syncProductsStep } from './steps/sync-pgoups'

type SyncProductsWorkflowInput = {
  filters?: Record<string, unknown>
  limit?: number
  offset?: number
}

export const syncPgroupsWorkflow = createWorkflow(
  'sync-pgroups',
  ({ filters, limit, offset }: SyncProductsWorkflowInput) => {
    const { pgroups } = syncProductsStep({ filters, limit, offset })

    return new WorkflowResponse({
        pgroups,
    })
  },
)