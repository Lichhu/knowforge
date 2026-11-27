import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { System } from './system.entity'
import { User } from './user.entity'

@Entity('audit_logs')
@Index('ix_audit_system_created', ['systemId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'system_id', type: 'uuid', nullable: true })
  systemId!: string | null

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId!: string | null

  @Column({ type: 'varchar', length: 60 })
  action!: string

  @Column({ name: 'entity_type', type: 'varchar', length: 60 })
  entityType!: string

  @Column({ name: 'entity_id', type: 'varchar', length: 80, nullable: true })
  entityId!: string | null

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  details!: Record<string, unknown>

  @Column({ type: 'inet', nullable: true })
  ip!: string | null

  @Column({ name: 'user_agent', type: 'varchar', length: 500, nullable: true })
  userAgent!: string | null

  @ManyToOne(() => System, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'system_id' })
  system!: System | null

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_id' })
  actor!: User | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date
}
