import { Migration } from '@mikro-orm/migrations';

export class Migration20250526202541 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "season" add column if not exists "handle" text not null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "season" drop column if exists "handle";`);
  }

}
