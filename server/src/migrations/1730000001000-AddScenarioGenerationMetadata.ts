import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddScenarioGenerationMetadata1730000001000 implements MigrationInterface {
  name = 'AddScenarioGenerationMetadata1730000001000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE test_scenarios
      ADD COLUMN generation_metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE test_scenarios DROP COLUMN generation_metadata`)
  }
}
