import type { MovementType } from '../enums'

export interface InventoryMovement {
  id: string
  productId: string
  type: MovementType
  quantityDelta: number
  stockAfter: number
  saleId: string | null
  userId: string | null
  note: string | null
  createdAt: Date
}

export interface InventorySummary {
  totalProducts: number
  totalUnits: number
  /** Σ stock × purchaseCost (stock negativo cuenta como 0) */
  totalCostValue: number
  /** Σ stock × price */
  totalRetailValue: number
  lowStockCount: number
  outOfStockCount: number
  byCategory: { categoryId: string; name: string; units: number; costValue: number }[]
}
