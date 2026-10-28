import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm'
import { ProductStatus } from '../../../domain/enums'
import { money, rate } from '../transformers'
import { CategoryEntity } from './category.entity'
import { InventoryMovementEntity } from './inventory-movement.entity'
import { SaleItemEntity } from './sale-item.entity'

@Entity('products')
@Check(`"price" >= 0`)
@Check(`"purchase_cost" >= 0`)
@Check(`"tax_rate" BETWEEN 0 AND 1`)
@Check(`"min_stock_alert" >= 0`)
// Índice GIN trigram para búsqueda por nombre; se crea en una migración manual (TypeORM no lo modela).
@Index('IDX_products_name_trgm', { synchronize: false })
export class ProductEntity {
  /** SKU */
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string

  /** EAN/UPC leído por el escáner del POS. */
  @Column({ type: 'varchar', length: 64, unique: true, nullable: true })
  barcode!: string | null

  @Column({ type: 'varchar', length: 150 })
  name!: string

  @Column({ type: 'text', nullable: true })
  description!: string | null

  @Index()
  @Column({ type: 'uuid' })
  categoryId!: string

  @ManyToOne(() => CategoryEntity, (category) => category.products, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category!: Relation<CategoryEntity>

  /** Precio al público, IVA incluido. */
  @Column(money)
  price!: number

  /** Costo de compra sin IVA. */
  @Column(money)
  purchaseCost!: number

  @Column({ ...rate, default: () => '0.16' })
  taxRate!: number

  /** Solo puede quedar negativo por una venta AUTOMATED (la mercancía ya salió de la tienda). */
  @Column({ type: 'int', default: 0 })
  stock!: number

  @Column({ type: 'int', default: 5 })
  minStockAlert!: number

  @Column({ type: 'enum', enum: ProductStatus, enumName: 'product_status', default: ProductStatus.ACTIVE })
  status!: ProductStatus

  @Column({ type: 'varchar', length: 500, nullable: true })
  imageUrl!: string | null

  /** Aparece en el grid de acceso rápido del POS. */
  @Column({ type: 'boolean', default: false })
  isQuickAccess!: boolean

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null

  @OneToMany(() => SaleItemEntity, (item) => item.product)
  saleItems!: Relation<SaleItemEntity[]>

  @OneToMany(() => InventoryMovementEntity, (movement) => movement.product)
  movements!: Relation<InventoryMovementEntity[]>
}
