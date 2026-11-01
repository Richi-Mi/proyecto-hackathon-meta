import type { ProductStatus } from '../../domain/enums'
import type { Product } from '../../domain/models/product'
import type { Page, PageRequest } from '../common/pagination'

export const PRODUCT_SORTS = ['name', '-name', 'stock', '-stock', 'price', '-price', 'updatedAt', '-updatedAt'] as const
export type ProductSort = (typeof PRODUCT_SORTS)[number]

export interface ProductFilters {
  /** Coincidencia parcial en nombre o SKU, o exacta en código de barras. */
  search?: string
  categoryId?: string
  status?: ProductStatus
  lowStock?: boolean
  quickAccess?: boolean
  sort: ProductSort
}

export type NewProduct = Omit<Product, 'category' | 'stock' | 'createdAt' | 'updatedAt'>
export type ProductChanges = Partial<Omit<NewProduct, 'id'>>

export interface InitialStock {
  quantity: number
  userId: string
}

export interface ProductRepository {
  list(filters: ProductFilters, page: PageRequest): Promise<Page<Product>>
  findById(id: string): Promise<Product | null>
  /** Busca por código de barras o SKU exactos. */
  findByCode(code: string): Promise<Product | null>
  /** Incluye productos dados de baja (el SKU sigue ocupado). */
  existsById(id: string): Promise<boolean>
  /**
   * Crea el producto y, si hay stock inicial, su movimiento RESTOCK en la misma transacción.
   * @throws ConflictError `PRODUCT_ALREADY_EXISTS` | `BARCODE_ALREADY_EXISTS`
   */
  create(data: NewProduct, initialStock: InitialStock | null): Promise<Product>
  /** @throws ConflictError `BARCODE_ALREADY_EXISTS` */
  update(id: string, changes: ProductChanges): Promise<Product | null>
  softDelete(id: string): Promise<boolean>
}
