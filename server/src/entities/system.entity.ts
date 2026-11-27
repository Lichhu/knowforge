import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { User } from './user.entity'

export type SystemProfileData = {
  businessLine: string
  ownerName: string
  version: string
  aliases: string[]
  modules: string[]
  roles: string[]
  workflows: string[]
  dependencies: string[]
  testEnvironments: string[]
  securityNotes: string
  sourceReferences: string[]
}

@Entity('systems')
export class System {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 160 })
  name!: string

  @Column({ type: 'varchar', length: 32, default: 'web' })
  type!: string

  @Column({ type: 'text', default: '' })
  description!: string

  @Column({ type: 'varchar', length: 32, default: 'initializing' })
  status!: string

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  profile!: Partial<SystemProfileData>

  @Column({ name: 'profile_status', type: 'varchar', length: 24, default: 'draft' })
  profileStatus!: string

  @Column({ name: 'profile_confirmed_by', type: 'uuid', nullable: true })
  profileConfirmedBy!: string | null

  @Column({ name: 'profile_confirmed_at', type: 'timestamptz', nullable: true })
  profileConfirmedAt!: Date | null

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'profile_confirmed_by' })
  profileConfirmer!: User | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}
