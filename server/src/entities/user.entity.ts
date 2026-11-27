import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 254, unique: true })
  email!: string

  @Column({ type: 'varchar', length: 100 })
  name!: string

  @Column({ name: 'password_hash', type: 'varchar', length: 100 })
  passwordHash!: string

  @Column({ type: 'boolean', default: true })
  active!: boolean

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}
