import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm'
import { ShelfAction, ShelfEventStatus } from '../../../domain/enums'
import { numericTransformer } from '../transformers'
import { InventoryMovementEntity } from './inventory-movement.entity'
import { ProductEntity } from './product.entity'
import { StoreVisitEntity } from './store-visit.entity'
import { UserEntity } from './user.entity'

/** ShelfSight: cada interacción con la repisa vista por la cámara (fotos antes/después + interpretación). */
@Entity('shelf_events')
@Index(['status', 'createdAt'])
@Check(`"quantity" >= 0`)
export class ShelfEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 64 })
  cameraId!: string

  @Column({ type: 'enum', enum: ShelfEventStatus, enumName: 'shelf_event_status' })
  status!: ShelfEventStatus

  @Column({ type: 'enum', enum: ShelfAction, enumName: 'shelf_action', default: ShelfAction.NONE })
  action!: ShelfAction

  @Column({ type: 'varchar', length: 64, nullable: true })
  productId!: string | null

  @ManyToOne(() => ProductEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product!: Relation<ProductEntity> | null

  @Column({ type: 'int', default: 0 })
  quantity!: number

  @Column({ type: 'numeric', precision: 4, scale: 3, nullable: true, transformer: numericTransformer })
  confidence!: number | null

  @Column({ type: 'varchar', length: 32, nullable: true })
  reviewReason!: string | null

  @Column({ type: 'text', nullable: true })
  note!: string | null

  @Column({ type: 'varchar', length: 100, nullable: true })
  model!: string | null

  @Column({ type: 'numeric', precision: 5, scale: 4, nullable: true, transformer: numericTransformer })
  changeRatio!: number | null

  @Column({ type: 'uuid', nullable: true })
  movementId!: string | null

  @ManyToOne(() => InventoryMovementEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'movement_id' })
  movement!: Relation<InventoryMovementEntity> | null

  @Index()
  @Column({ type: 'uuid', nullable: true })
  visitId!: string | null

  @ManyToOne(() => StoreVisitEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'visit_id' })
  visit!: Relation<StoreVisitEntity> | null

  /** Las fotos solo se leen en el detalle del evento */
  @Column({ type: 'varchar', length: 16, select: false })
  imageMimeType!: string

  @Column({ type: 'bytea', select: false })
  beforeImage!: Buffer

  @Column({ type: 'bytea', select: false })
  afterImage!: Buffer

  @Column({ type: 'timestamptz' })
  capturedAt!: Date

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null

  @Column({ type: 'uuid', nullable: true })
  resolvedBy!: string | null

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'resolved_by' })
  resolver!: Relation<UserEntity> | null
}
