import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import B2bModuleService from "../../../modules/b2b/service";

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {

  const b2bModuleService: B2bModuleService = req.scope.resolve("b2b")

  const getListOfFiles = await b2bModuleService.listFiles("ss25")

  res.status(200).json(getListOfFiles)


}
