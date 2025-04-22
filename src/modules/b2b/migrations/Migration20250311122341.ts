import { Migration } from '@mikro-orm/migrations';

export class Migration20250311122341 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "selection" ("id" text not null, "title" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "selection_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_selection_deleted_at" ON "selection" (deleted_at) WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "selection" cascade;`);
  }

}
