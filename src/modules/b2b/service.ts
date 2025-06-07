import { InjectManager, InjectTransactionManager, MedusaContext, MedusaService } from "@medusajs/framework/utils"
import Selection from "./models/selection"
import MinioService from "./services/minio"
import Season from "./models/season"
import Pgroup from "./models/product-group"
import { EntityManager } from "@mikro-orm/knex"
import { Context, InferTypeOf, DAL } from "@medusajs/framework/types"
import SelectionList from "./models/selection"


type Selection = InferTypeOf<typeof SelectionList>

type InjectedDependencies = {
    minioService: MinioService,
    selectionRepository: DAL.RepositoryService<Selection>
  }
  

class B2bModuleService extends MedusaService({
    Selection,
    Season,
    Pgroup
}){

    protected minioService_: MinioService
    protected selectionRepository_: DAL.RepositoryService<Selection>

  constructor({ minioService, selectionRepository }: InjectedDependencies) {
    super(...arguments)
    this.minioService_ = minioService
    this.selectionRepository_ = selectionRepository

  }


  async listFiles(prefix?: string) {
    const result = await this.minioService_.listFiles(prefix)
    return result
  }

  @InjectManager()
  async clearSelection(
    selection_id: string,
    pgroup_id: string,
    @MedusaContext() sharedContext?: Context<EntityManager>
  ): Promise<any> {
    await sharedContext?.manager?.execute(
      `DELETE FROM pgroup_selections WHERE selection_id ='${selection_id}' AND pgroup_id ='${pgroup_id}'`   
    )
}
}

export default B2bModuleService 