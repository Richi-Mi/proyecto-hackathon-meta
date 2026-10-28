import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm'
import { Role } from '../../../domain/enums'
import { SaleEntity } from './sale.entity'
import { StoreVisitEntity } from './store-visit.entity'

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 120 })
  name!: string

  /** citext: unicidad sin distinguir mayúsculas/minúsculas. */
  @Column({ type: 'citext', unique: true })
  email!: string

  /** Hash de bun:password (argon2id). Excluido de los SELECT por defecto. */
  @Column({ type: 'text', select: false })
  passwordHash!: string

  @Column({ type: 'enum', enum: Role, enumName: 'user_role', default: Role.CUSTOMER })
  role!: Role

  /** Referencia del cliente en la pasarela de pago (token, nunca datos de tarjeta). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  paymentCustomerRef!: string | null

  @Column({ type: 'boolean', default: true })
  isActive!: boolean

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date

  @OneToMany(() => SaleEntity, (sale) => sale.customer)
  purchases!: Relation<SaleEntity[]>

  @OneToMany(() => StoreVisitEntity, (visit) => visit.user)
  visits!: Relation<StoreVisitEntity[]>
}
