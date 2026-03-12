import { Migration } from '@mikro-orm/migrations';

export class Migration20260312062008 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "b2b_order" ("id" text not null, "code" text not null, "status" text not null, "season_handle" text null, "currency_code" text null, "total_amount" text not null, "total_quantity" text not null, "preorder_ids" text[] not null, "items" jsonb not null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "b2b_order_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_b2b_order_deleted_at" ON "b2b_order" (deleted_at) WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "preorder" ("id" text not null, "code" text not null, "status" text not null, "cart_id" text null, "order_id" text null, "customer_id" text not null, "customer_name" text not null, "customer_email" text null, "season_handle" text null, "currency_code" text null, "total_amount" text not null, "total_quantity" text not null, "items" jsonb not null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "preorder_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_preorder_deleted_at" ON "preorder" (deleted_at) WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "b2b_order" cascade;`);

    this.addSql(`drop table if exists "preorder" cascade;`);
  }

}
