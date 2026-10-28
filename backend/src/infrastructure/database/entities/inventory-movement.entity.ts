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
import { MovementType } from '../../../domain/enums'
import { ProductEntity } from './product.entity'
import { SaleEntity } from './sale.entity'
import { UserEntity } from './user.entity'

/** Kardex: cada cambio de stock queda registrado con su origen. */
@Entity('inventory_movements')
@Index(['productId', 'createdAt'])
@Check(`"quantity_delta" <> 0`)
export class InventoryMovementEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 64 })
  productId!: string

  @ManyToOne(() => ProductEntity, (product) => product.movements, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product!: Relation<ProductEntity>

  @Column({ type: 'enum', enum: MovementType, enumName: 'movement_type' })
  type!: MovementType

  @Column({ type: 'int' })
  quantityDelta!: number

  @Column({ type: 'int' })
  stockAfter!: number

  @Column({ type: 'uuid', nullable: true })
  saleId!: string | null

  @ManyToOne(() => SaleEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sale_id' })
  sale!: Relation<SaleEntity> | null

  @Column({ type: 'uuid', nullable: true })
  userId!: string | null

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<UserEntity> | null

  @Column({ type: 'text', nullable: true })
  note!: string | null

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date
}
