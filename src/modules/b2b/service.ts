import { InjectManager, InjectTransactionManager, MedusaContext, MedusaService } from "@medusajs/framework/utils"
import Selection from "./models/selection"
import MinioService from "./services/minio"
import Season from "./models/season"
import Pgroup from "./models/product-group"
import { EntityManager } from "@mikro-orm/knex"
import { Context, InferTypeOf, DAL } from "@medusajs/framework/types"
import SelectionList from "./models/selection"
import { Logger } from "@medusajs/medusa"


type Selection = InferTypeOf<typeof SelectionList>

type InjectedDependencies = {
    minioService: MinioService,
    selectionRepository: DAL.RepositoryService<Selection>
    logger: Logger
  }
  

class B2bModuleService extends MedusaService({
    Selection,
    Season,
    Pgroup
}){

    protected minioService_: MinioService
    protected selectionRepository_: DAL.RepositoryService<Selection>
    protected logger_: Logger

  constructor({ minioService, selectionRepository, logger }: InjectedDependencies) {
    super(...arguments)
    this.minioService_ = minioService
    this.selectionRepository_ = selectionRepository
    this.logger_ = logger

  }


  async listFiles(prefix?: string) {
    const result = await this.minioService_.listFiles(prefix)
    return result
  }

  @InjectManager()
  async clearSelection(
    selection_id: string,
    pgroup_ids: string[],
    @MedusaContext() sharedContext?: Context<EntityManager>
  ): Promise<any> {
    try {
    await sharedContext?.manager?.execute(
      `DELETE FROM pgroup_selections WHERE selection_id ='${selection_id}' AND pgroup_id IN ('${pgroup_ids}')`   
    )
    } catch (error) {
      this.logger_.error(JSON.stringify(error, null, 2))
    }

}
}

export default B2bModuleService 