import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { System } from './system.entity'
import { User } from './user.entity'

@Entity('knowledge_entries')
export class KnowledgeEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'system_id', type: 'uuid' })
  systemId!: string

  @Column({ type: 'varchar', length: 240 })
  title!: string

  @Column({ type: 'text' })
  content!: string

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status!: string

  @Column({ type: 'varchar', length: 120, default: '测试用例管理' })
  module!: string

  @Column({ name: 'source_reference', type: 'jsonb', default: () => "'{}'::jsonb" })
  sourceReference!: Record<string, unknown>

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy!: string | null

  @ManyToOne(() => System, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'system_id' })
  system!: System

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
