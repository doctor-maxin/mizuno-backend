import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { processPreorderFile } from "../../../../../workflows/process-preorder-file";


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



  const { result } = await processPreorderFile(req.scope)
  .run({
    input: {
      // @ts-expect-error
      fileData: files[0].buffer,
      seasonString: season as string|| 'ss25',
      mode: "read"
    },
  })

  res.json(result)

  // res.status(200).send(data)


}

