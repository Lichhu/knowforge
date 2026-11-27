import { MigrationInterface, QueryRunner } from 'typeorm'

export class InitialSchema1730000000000 implements MigrationInterface {
  name = 'InitialSchema1730000000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`)
    await queryRunner.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email varchar(254) NOT NULL UNIQUE,
        name varchar(100) NOT NULL,
        password_hash varchar(100) NOT NULL,
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`
      CREATE TABLE systems (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(160) NOT NULL,
        type varchar(32) NOT NULL DEFAULT 'web',
        description text NOT NULL DEFAULT '',
        status varchar(32) NOT NULL DEFAULT 'initializing',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`
      CREATE TABLE system_memberships (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        system_id uuid NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
        role varchar(32) NOT NULL CHECK (role IN ('admin', 'system_owner', 'tester', 'auditor')),
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_system_membership_user_system UNIQUE (user_id, system_id)
      )
    `)
    await queryRunner.query(`CREATE INDEX ix_system_membership_system_role ON system_memberships(system_id, role)`)
    await queryRunner.query(`
      CREATE TABLE requirements (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        system_id uuid NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
        created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        title varchar(240) NOT NULL,
        source_name varchar(240),
        source_text text NOT NULL DEFAULT '',
        status varchar(32) NOT NULL DEFAULT 'needs_clarification',
        module varchar(80) NOT NULL DEFAULT '测试用例管理',
        ai_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX ix_requirements_system_updated ON requirements(system_id, updated_at DESC)`)
    await queryRunner.query(`
      CREATE TABLE clarifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        requirement_id uuid NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
        question text NOT NULL,
        rationale text NOT NULL DEFAULT '',
        blocks_design boolean NOT NULL DEFAULT true,
        answer text,
        status varchar(24) NOT NULL DEFAULT 'open',
        confirmed_by uuid REFERENCES users(id) ON DELETE SET NULL,
        confirmed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX ix_clarifications_requirement_status ON clarifications(requirement_id, status)`)
    await queryRunner.query(`
      CREATE TABLE test_scenarios (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        requirement_id uuid NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
        title varchar(240) NOT NULL,
        objective text NOT NULL DEFAULT '',
        steps jsonb NOT NULL DEFAULT '[]'::jsonb,
        expected_result text NOT NULL DEFAULT '',
        status varchar(24) NOT NULL DEFAULT 'draft',
        created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
        citations jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX ix_test_scenarios_requirement_status ON test_scenarios(requirement_id, status)`)
    await queryRunner.query(`
      CREATE TABLE knowledge_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        system_id uuid NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
        title varchar(240) NOT NULL,
        content text NOT NULL,
        status varchar(32) NOT NULL DEFAULT 'draft',
        module varchar(120) NOT NULL DEFAULT '测试用例管理',
        source_reference jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX ix_knowledge_system_status ON knowledge_entries(system_id, status)`)
    await queryRunner.query(`
      CREATE TABLE audit_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        system_id uuid REFERENCES systems(id) ON DELETE SET NULL,
        actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
        action varchar(60) NOT NULL,
        entity_type varchar(60) NOT NULL,
        entity_id varchar(80),
        details jsonb NOT NULL DEFAULT '{}'::jsonb,
        ip inet,
        user_agent varchar(500),
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX ix_audit_system_created ON audit_logs(system_id, created_at DESC)`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs`)
    await queryRunner.query(`DROP TABLE IF EXISTS knowledge_entries`)
    await queryRunner.query(`DROP TABLE IF EXISTS test_scenarios`)
    await queryRunner.query(`DROP TABLE IF EXISTS clarifications`)
    await queryRunner.query(`DROP TABLE IF EXISTS requirements`)
    await queryRunner.query(`DROP TABLE IF EXISTS system_memberships`)
    await queryRunner.query(`DROP TABLE IF EXISTS systems`)
    await queryRunner.query(`DROP TABLE IF EXISTS users`)
  }
}
