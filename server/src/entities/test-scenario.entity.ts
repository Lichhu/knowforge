import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { Requirement } from './requirement.entity'
import { User } from './user.entity'

@Entity('test_scenarios')
export class TestScenario {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'requirement_id', type: 'uuid' })
  requirementId!: string

  @Column({ type: 'varchar', length: 240 })
  title!: string

  @Column({ type: 'text', default: '' })
  objective!: string

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  steps!: string[]

  @Column({ name: 'expected_result', type: 'text', default: '' })
  expectedResult!: string

  @Column({ type: 'varchar', length: 24, default: 'draft' })
  status!: string

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy!: string | null

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  citations!: Array<Record<string, unknown>>

  @Column({ name: 'generation_metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  generationMetadata!: Record<string, unknown>

  @ManyToOne(() => Requirement, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requirement_id' })
  requirement!: Requirement

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  creator!: User

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by' })
  reviewer!: User | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}
