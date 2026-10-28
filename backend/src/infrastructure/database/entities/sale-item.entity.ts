import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm'
import { money, rate } from '../transformers'
import { ProductEntity } from './product.entity'
import { SaleEntity } from './sale.entity'

/**
 * Partida de una venta. Nombre, precio, costo y tasa se copian (snapshot) al momento de vender
 * para que tickets y reportes de ganancia no cambien si después se edita el producto.
 */
@Entity('sale_items')
@Check(`"quantity" > 0`)
export class SaleItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Index()
  @Column({ type: 'uuid' })
  saleId!: string

  @ManyToOne(() => SaleEntity, (sale) => sale.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale!: Relation<SaleEntity>

  @Index()
  @Column({ type: 'varchar', length: 64 })
  productId!: string

  @ManyToOne(() => ProductEntity, (product) => product.saleItems, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product!: Relation<ProductEntity>

  @Column({ type: 'varchar', length: 150 })
  productName!: string

  @Column({ type: 'int' })
  quantity!: number

  /** IVA incluido. */
  @Column(money)
  unitPrice!: number

  @Column(money)
  unitCost!: number

  @Column(rate)
  taxRate!: number

  /** unitPrice × quantity */
  @Column(money)
  subtotal!: number
}
