import { Migration } from '@mikro-orm/migrations';

export class Migration20250521113903 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "pgroup" ("id" text not null, "product_ids" text[] not null, "season_id" text not null, "product_code" text not null, "title" text not null, "category" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pgroup_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pgroup_deleted_at" ON "pgroup" (deleted_at) WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "season" ("id" text not null, "title" text not null, "start_at" timestamptz null, "end_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "season_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_season_deleted_at" ON "season" (deleted_at) WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "selection" ("id" text not null, "title" text null, "is_open" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "selection_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_selection_deleted_at" ON "selection" (deleted_at) WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "pgroup_selections" ("pgroup_id" text not null, "selection_id" text not null, constraint "pgroup_selections_pkey" primary key ("pgroup_id", "selection_id"));`);

    this.addSql(`alter table if exists "pgroup_selections" add constraint "pgroup_selections_pgroup_id_foreign" foreign key ("pgroup_id") references "pgroup" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table if exists "pgroup_selections" add constraint "pgroup_selections_selection_id_foreign" foreign key ("selection_id") references "selection" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "pgroup_selections" drop constraint if exists "pgroup_selections_pgroup_id_foreign";`);

    this.addSql(`alter table if exists "pgroup_selections" drop constraint if exists "pgroup_selections_selection_id_foreign";`);

    this.addSql(`drop table if exists "pgroup" cascade;`);

    this.addSql(`drop table if exists "season" cascade;`);

    this.addSql(`drop table if exists "selection" cascade;`);

    this.addSql(`drop table if exists "pgroup_selections" cascade;`);
  }

}
