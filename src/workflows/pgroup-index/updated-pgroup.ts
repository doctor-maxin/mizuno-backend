import { createWorkflow, WorkflowResponse } from '@medusajs/workflows-sdk'
import { upsertProductGroupStep } from './steps/upsert-pgroup'

type WorkflowInput = {
  id: string
}

const productUpdatedWorkflow = createWorkflow('pgroup-updated', ({ id }: WorkflowInput) => {
  const { pgroups } = upsertProductGroupStep({ id })

  return new WorkflowResponse({
    pgroups,
  })
})

export default productUpdatedWorkflow