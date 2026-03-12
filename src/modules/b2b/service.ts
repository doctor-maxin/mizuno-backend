import { InjectManager, InjectTransactionManager, MedusaContext, MedusaService } from "@medusajs/framework/utils"
import { randomUUID } from "crypto"
import Selection from "./models/selection"
import MinioService from "./services/minio"
import Season from "./models/season"
import Pgroup from "./models/product-group"
import Preorder from "./models/preorder"
import B2bOrder from "./models/b2b-order"
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

type UpsertB2bOrderInput = {
  code?: string
  status?: string
  season_handle?: string | null
  currency_code?: string | null
  total_amount?: string
  total_quantity?: string
  preorder_ids?: string[]
  items?: Record<string, unknown>
  metadata?: Record<string, unknown> | null
}

type B2bOrderRecord = {
  id: string
  code: string
  status: string
  season_handle: string | null
  currency_code: string | null
  total_amount: string
  total_quantity: string
  preorder_ids: string[]
  items: Record<string, unknown>
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

const toSqlText = (value?: string | null) =>
  value == null ? "null" : `'${String(value).replace(/'/g, "''")}'`

const toSqlJson = (value?: Record<string, unknown> | null) =>
  value == null ? "null" : `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`

const toSqlTextArray = (value?: string[]) =>
  `ARRAY[${(value ?? []).map((item) => toSqlText(item)).join(", ")}]::text[]`

const mapB2bOrderRow = (row: Record<string, unknown>): B2bOrderRecord => ({
  id: String(row.id),
  code: String(row.code),
  status: String(row.status),
  season_handle:
    row.season_handle == null ? null : String(row.season_handle),
  currency_code:
    row.currency_code == null ? null : String(row.currency_code),
  total_amount: String(row.total_amount ?? "0"),
  total_quantity: String(row.total_quantity ?? "0"),
  preorder_ids: Array.isArray(row.preorder_ids)
    ? row.preorder_ids.map((item) => String(item))
    : [],
  items:
    row.items && typeof row.items === "object"
      ? (row.items as Record<string, unknown>)
      : { rows: [] },
  metadata:
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : null,
  created_at: String(row.created_at),
  updated_at: String(row.updated_at),
})
  

class B2bModuleService extends MedusaService({
    Selection,
    Season,
    Pgroup,
    Preorder,
    B2bOrder,
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

  @InjectManager()
  async createB2bOrderRecord(
    data: Required<
      Pick<
        UpsertB2bOrderInput,
        | "code"
        | "status"
        | "total_amount"
        | "total_quantity"
        | "preorder_ids"
        | "items"
      >
    > &
      Pick<UpsertB2bOrderInput, "season_handle" | "currency_code" | "metadata">,
    @MedusaContext() sharedContext?: Context<EntityManager>
  ) {
    const id = `b2border_${randomUUID().replace(/-/g, "")}`

    await sharedContext?.manager?.execute(`
      INSERT INTO "b2b_order" (
        "id",
        "code",
        "status",
        "season_handle",
        "currency_code",
        "total_amount",
        "total_quantity",
        "preorder_ids",
        "items",
        "metadata"
      ) VALUES (
        ${toSqlText(id)},
        ${toSqlText(data.code)},
        ${toSqlText(data.status)},
        ${toSqlText(data.season_handle ?? null)},
        ${toSqlText(data.currency_code ?? null)},
        ${toSqlText(data.total_amount)},
        ${toSqlText(data.total_quantity)},
        ${toSqlTextArray(data.preorder_ids)},
        ${toSqlJson(data.items)},
        ${toSqlJson(data.metadata ?? null)}
      )
    `)

    return id
  }

  @InjectManager()
  async updateB2bOrderRecord(
    id: string,
    data: UpsertB2bOrderInput,
    @MedusaContext() sharedContext?: Context<EntityManager>
  ) {
    const updates = [
      data.code !== undefined ? `"code" = ${toSqlText(data.code)}` : null,
      data.status !== undefined ? `"status" = ${toSqlText(data.status)}` : null,
      data.season_handle !== undefined
        ? `"season_handle" = ${toSqlText(data.season_handle)}`
        : null,
      data.currency_code !== undefined
        ? `"currency_code" = ${toSqlText(data.currency_code)}`
        : null,
      data.total_amount !== undefined
        ? `"total_amount" = ${toSqlText(data.total_amount)}`
        : null,
      data.total_quantity !== undefined
        ? `"total_quantity" = ${toSqlText(data.total_quantity)}`
        : null,
      data.preorder_ids !== undefined
        ? `"preorder_ids" = ${toSqlTextArray(data.preorder_ids)}`
        : null,
      data.items !== undefined ? `"items" = ${toSqlJson(data.items)}` : null,
      data.metadata !== undefined
        ? `"metadata" = ${toSqlJson(data.metadata)}`
        : null,
      `"updated_at" = now()`,
    ].filter(Boolean)

    if (!updates.length) {
      return
    }

    await sharedContext?.manager?.execute(`
      UPDATE "b2b_order"
      SET ${updates.join(", ")}
      WHERE "id" = ${toSqlText(id)}
    `)
  }

  @InjectManager()
  async getB2bOrderRecord(
    id: string,
    @MedusaContext() sharedContext?: Context<EntityManager>
  ): Promise<B2bOrderRecord | null> {
    const result = await sharedContext?.manager?.execute(`
      SELECT *
      FROM "b2b_order"
      WHERE "id" = ${toSqlText(id)}
        AND "deleted_at" IS NULL
      LIMIT 1
    `)

    const rows = Array.isArray(result) ? result : []
    const row = rows[0] as Record<string, unknown> | undefined

    return row ? mapB2bOrderRow(row) : null
  }

  @InjectManager()
  async listB2bOrderRecords(
    filters?: {
      season_handle?: string
      ids?: string[]
    },
    @MedusaContext() sharedContext?: Context<EntityManager>
  ): Promise<B2bOrderRecord[]> {
    const conditions = [`"deleted_at" IS NULL`]

    if (filters?.season_handle) {
      conditions.push(`"season_handle" = ${toSqlText(filters.season_handle)}`)
    }

    if (filters?.ids?.length) {
      conditions.push(`"id" = ANY(${toSqlTextArray(filters.ids)})`)
    }

    const result = await sharedContext?.manager?.execute(`
      SELECT *
      FROM "b2b_order"
      WHERE ${conditions.join(" AND ")}
      ORDER BY "created_at" DESC
    `)

    const rows = Array.isArray(result) ? result : []

    return rows.map((row) => mapB2bOrderRow(row as Record<string, unknown>))
  }
}

export default B2bModuleService 
