import { Migration } from '@mikro-orm/migrations';

export class Migration20250311122818 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "selection" add column if not exists "is_open" boolean not null default true;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "selection" drop column if exists "is_open";`);
  }

}
