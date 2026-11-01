import type { ProductStatus } from '../enums'
import type { Category } from './category'

export interface Product {
  /** SKU */
  id: string
  barcode: string | null
  name: string
  description: string | null
  categoryId: string
  category: Category
  /** IVA incluido */
  price: number
  /** Sin IVA */
  purchaseCost: number
  taxRate: number
  stock: number
  minStockAlert: number
  status: ProductStatus
  imageUrl: string | null
  isQuickAccess: boolean
  createdAt: Date
  updatedAt: Date
}

export const DEFAULT_TAX_RATE = 0.16
export const DEFAULT_MIN_STOCK_ALERT = 5

export const isLowStock = (product: Pick<Product, 'stock' | 'minStockAlert'>) => product.stock <= product.minStockAlert
