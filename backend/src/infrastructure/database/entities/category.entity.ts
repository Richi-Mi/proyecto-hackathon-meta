import { Check, Column, Entity, OneToMany, PrimaryGeneratedColumn, type Relation } from 'typeorm'
import { ProductEntity } from './product.entity'

@Entity('categories')
@Check(`"color" ~ '^#[0-9A-Fa-f]{6}$'`)
export class CategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 60, unique: true })
  name!: string

  /** Color del botón en el grid del POS (#RRGGBB). */
  @Column({ type: 'varchar', length: 7 })
  color!: string

  @Column({ type: 'varchar', length: 60, nullable: true })
  icon!: string | null

  @Column({ type: 'int', default: 0 })
  sortOrder!: number

  @OneToMany(() => ProductEntity, (product) => product.category)
  products!: Relation<ProductEntity[]>
}
