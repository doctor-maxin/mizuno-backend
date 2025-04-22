import { Migration } from '@mikro-orm/migrations';

export class Migration20250401122731 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "pgroup" ("id" text not null, "product_ids" text[] not null, "season_id" text not null, "product_code" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pgroup_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pgroup_deleted_at" ON "pgroup" (deleted_at) WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "season" ("id" text not null, "title" text not null, "start_at" timestamptz null, "end_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "season_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_season_deleted_at" ON "season" (deleted_at) WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "pgroup" cascade;`);

    this.addSql(`drop table if exists "season" cascade;`);
  }

}
