import { MedusaService } from "@medusajs/framework/utils"
import Selection from "./models/selection"
import MinioService from "./services/minio"
import Season from "./models/season"
import Pgroup from "./models/product-group"


type InjectedDependencies = {
    minioService: MinioService
  }
  

class B2bModuleService extends MedusaService({
    Selection,
    Season,
    Pgroup
}){

    protected minioService_: MinioService

  constructor({ minioService }: InjectedDependencies) {
    super(...arguments)
    this.minioService_ = minioService
  }


  async listFiles(prefix?: string) {
    const result = await this.minioService_.listFiles(prefix)
    return result
  }

}

export default B2bModuleService 