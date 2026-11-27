import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { System } from './system.entity'
import { User } from './user.entity'

@Entity('requirements')
@Index('ix_requirements_system_updated', ['systemId', 'updatedAt'])
export class Requirement {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'system_id', type: 'uuid' })
  systemId!: string

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string

  @Column({ type: 'varchar', length: 240 })
  title!: string

  @Column({ name: 'source_name', type: 'varchar', length: 240, nullable: true })
  sourceName!: string | null

  @Column({ name: 'source_text', type: 'text', default: '' })
  sourceText!: string

  @Column({ type: 'varchar', length: 32, default: 'needs_clarification' })
  status!: string

  @Column({ type: 'varchar', length: 80, default: '测试用例管理' })
  module!: string

  @Column({ name: 'ai_summary', type: 'jsonb', default: () => "'{}'::jsonb" })
  aiSummary!: Record<string, unknown>

  @ManyToOne(() => System, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'system_id' })
  system!: System

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  creator!: User

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}
