import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { Requirement } from './requirement.entity'
import { User } from './user.entity'

@Entity('clarifications')
export class Clarification {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'requirement_id', type: 'uuid' })
  requirementId!: string

  @Column({ type: 'text' })
  question!: string

  @Column({ type: 'text', default: '' })
  rationale!: string

  @Column({ name: 'blocks_design', type: 'boolean', default: true })
  blocksDesign!: boolean

  @Column({ type: 'text', nullable: true })
  answer!: string | null

  @Column({ type: 'varchar', length: 24, default: 'open' })
  status!: string

  @Column({ name: 'confirmed_by', type: 'uuid', nullable: true })
  confirmedBy!: string | null

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt!: Date | null

  @ManyToOne(() => Requirement, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requirement_id' })
  requirement!: Requirement

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'confirmed_by' })
  confirmer!: User | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}
