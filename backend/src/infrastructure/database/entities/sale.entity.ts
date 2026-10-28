import {
  Check,
  Column,
  Entity,
  Generated,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm'
import { PaymentMethod, PaymentStatus, SaleStatus, SaleType } from '../../../domain/enums'
import { money } from '../transformers'
import { SaleItemEntity } from './sale-item.entity'
import { StoreVisitEntity } from './store-visit.entity'
import { UserEntity } from './user.entity'

@Entity('sales')
@Index(['userId', 'dateTime'])
@Check(`"subtotal" >= 0 AND "tax_amount" >= 0 AND "total_amount" >= 0`)
export class SaleEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  /** Número de ticket legible (SERIAL). */
  @Column({ type: 'int', unique: true })
  @Generated('increment')
  folio!: number

  /** Momento de la venta; en AUTOMATED es la hora de salida que reporta el webhook. */
  @Index()
  @Column({ type: 'timestamptz', default: () => 'now()' })
  dateTime!: Date

  /** Cliente; null para el cliente casual de mostrador. */
  @Column({ type: 'uuid', nullable: true })
  userId!: string | null

  @ManyToOne(() => UserEntity, (user) => user.purchases, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  customer!: Relation<UserEntity> | null

  /** Propietario que cobró (solo MANUAL). */
  @Column({ type: 'uuid', nullable: true })
  cashierId!: string | null

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cashier_id' })
  cashier!: Relation<UserEntity> | null

  /** Visita que originó la venta (solo AUTOMATED). Única por la relación 1:1. */
  @Column({ type: 'uuid', nullable: true })
  visitId!: string | null

  @OneToOne(() => StoreVisitEntity, (visit) => visit.sale, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'visit_id' })
  visit!: Relation<StoreVisitEntity> | null

  /** `eventId` del webhook de cámaras: idempotencia ante reintentos. */
  @Column({ type: 'varchar', length: 128, unique: true, nullable: true })
  externalEventId!: string | null

  @Column({ type: 'enum', enum: SaleType, enumName: 'sale_type' })
  saleType!: SaleType

  @Column({ type: 'enum', enum: PaymentMethod, enumName: 'payment_method' })
  paymentMethod!: PaymentMethod

  @Column({ type: 'enum', enum: PaymentStatus, enumName: 'payment_status' })
  paymentStatus!: PaymentStatus

  @Column({ type: 'varchar', length: 128, nullable: true })
  paymentReference!: string | null

  @Column({ type: 'enum', enum: SaleStatus, enumName: 'sale_status', default: SaleStatus.COMPLETED })
  status!: SaleStatus

  /** Σ base sin IVA. */
  @Column(money)
  subtotal!: number

  @Column(money)
  taxAmount!: number

  /** Σ subtotales de las partidas (IVA incluido). */
  @Column(money)
  totalAmount!: number

  @Column({ ...money, nullable: true })
  cashReceived!: number | null

  @Column({ ...money, nullable: true })
  changeGiven!: number | null

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt!: Date | null

  @Column({ name: 'cancelled_by', type: 'uuid', nullable: true })
  cancelledById!: string | null

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cancelled_by' })
  cancelledBy!: Relation<UserEntity> | null

  @Column({ type: 'text', nullable: true })
  cancelReason!: string | null

  @OneToMany(() => SaleItemEntity, (item) => item.sale, { cascade: ['insert'] })
  items!: Relation<SaleItemEntity[]>
}
