import { Migration } from '@mikro-orm/migrations';

export class Migration20250626073020 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "manager" ("id" text not null, "firstName" text not null, "lastName" text not null, "email" text not null, "phone" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "manager_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_manager_deleted_at" ON "manager" (deleted_at) WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "manager" cascade;`);
  }

}
