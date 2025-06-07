import type {
    MedusaRequest,
    MedusaResponse,
  } from "@medusajs/framework/http"
  import { createCustomerAccountWorkflow } from "@medusajs/medusa/core-flows"
  
  export async function POST(
    req: MedusaRequest,
    res: MedusaResponse
  ) {
    const { result } = await createCustomerAccountWorkflow(req.scope)
      .run({
        input: {
          authIdentityId: "au_1234",
          customerData: {
            first_name: "John",
            last_name: "Doe",
            email: "john.doe@example.com",
          }
        }
      })
  
    res.send(result)
  }