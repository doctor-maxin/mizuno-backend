import { Migration } from '@mikro-orm/migrations';

export class Migration20250524201806 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "pgroup" add column if not exists "metadata" jsonb null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "pgroup" drop column if exists "metadata";`);
  }

}
