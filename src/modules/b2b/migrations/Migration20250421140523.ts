import { Migration } from '@mikro-orm/migrations';

export class Migration20250421140523 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "pgroup" add column if not exists "title" text not null, add column if not exists "category" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "pgroup" drop column if exists "title", drop column if exists "category";`);
  }

}
