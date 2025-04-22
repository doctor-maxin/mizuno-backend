import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { importProductFileWorkflow } from "../../../../workflows/import-product-file";


export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {

  const files = req.files as Express.Multer.File[]

  const season = req.query.season

  if (!files?.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "No files were uploaded"
    )
  }



  const { result } = await importProductFileWorkflow(req.scope)
  .run({
    input: {
      fileData: files[0].buffer,
      seasonString: season || 'ss25'
    },
  })

  res.json(result)

  // res.status(200).send(data)


}

