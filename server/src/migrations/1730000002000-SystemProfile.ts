import { MigrationInterface, QueryRunner } from 'typeorm'

export class SystemProfile1730000002000 implements MigrationInterface {
  name = 'SystemProfile1730000002000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE systems
      ADD COLUMN profile jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN profile_status varchar(24) NOT NULL DEFAULT 'draft',
      ADD COLUMN profile_confirmed_by uuid REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN profile_confirmed_at timestamptz
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE systems
      DROP COLUMN profile_confirmed_at,
      DROP COLUMN profile_confirmed_by,
      DROP COLUMN profile_status,
      DROP COLUMN profile
    `)
  }
}
