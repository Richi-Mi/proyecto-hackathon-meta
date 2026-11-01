import type { MovementType } from '../../domain/enums'
import type { InventoryMovement, InventorySummary } from '../../domain/models/inventory'
import type { Page, PageRequest } from '../common/pagination'

export interface StockChange {
  productId: string
  type: MovementType
  quantityDelta: number
  userId: string | null
  note: string | null
  /** Si viene, también actualiza `purchaseCost` del producto. */
  newPurchaseCost?: number
}

export interface MovementFilters {
  productId?: string
  type?: MovementType
  from?: Date
  to?: Date
}

export interface InventoryRepository {
  /**
   * Bloquea la fila del producto, ejecuta `guard` con el stock actual (puede lanzar un error de negocio),
   * aplica el cambio y registra el movimiento, todo en una transacción.
   * Devuelve null si el producto no existe.
   */
  applyStockChange(change: StockChange, guard?: (currentStock: number) => void): Promise<InventoryMovement | null>
  summary(): Promise<InventorySummary>
  listMovements(filters: MovementFilters, page: PageRequest): Promise<Page<InventoryMovement>>
}
