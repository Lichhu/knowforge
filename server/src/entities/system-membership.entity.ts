import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm'
import { System } from './system.entity'
import { User } from './user.entity'

export enum SystemRole {
  ADMIN = 'admin',
  OWNER = 'system_owner',
  TESTER = 'tester',
  AUDITOR = 'auditor',
}

@Entity('system_memberships')
@Unique('uq_system_membership_user_system', ['userId', 'systemId'])
@Index('ix_system_membership_system_role', ['systemId', 'role'])
export class SystemMembership {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string

  @Column({ name: 'system_id', type: 'uuid' })
  systemId!: string

  @Column({ type: 'varchar', length: 32 })
  role!: SystemRole

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User

  @ManyToOne(() => System, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'system_id' })
  system!: System

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date
}
