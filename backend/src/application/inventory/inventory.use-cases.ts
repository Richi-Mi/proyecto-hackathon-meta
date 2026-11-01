import { MovementType } from '../../domain/enums'
import { ConflictError, InvalidInputError, NotFoundError } from '../../domain/errors'
import { roundMoney } from '../../domain/money'
import type { InventoryMovement, InventorySummary } from '../../domain/models/inventory'
import type { Page, PageRequest } from '../common/pagination'
import type { InventoryRepository, MovementFilters } from '../ports/inventory-repository'

export interface StockAdjustmentInput {
  type: MovementType.RESTOCK | MovementType.ADJUSTMENT
  /** RESTOCK > 0; ADJUSTMENT ≠ 0 (negativo = merma) */
  quantity: number
  /** Solo RESTOCK: actualiza el costo de compra del producto. */
  unitCost?: number
  note?: string
}

export class InventoryUseCases {
  constructor(private readonly inventory: InventoryRepository) {}

  async adjustStock(productId: string, input: StockAdjustmentInput, actorId: string): Promise<InventoryMovement> {
    if (input.quantity === 0) throw new InvalidInputError('INVALID_QUANTITY', 'La cantidad no puede ser 0')
    if (input.type === MovementType.RESTOCK && input.quantity < 0) {
      throw new InvalidInputError('INVALID_QUANTITY', 'Una entrada de mercancía (RESTOCK) debe ser positiva')
    }
    if (input.type === MovementType.ADJUSTMENT && input.unitCost !== undefined) {
      throw new InvalidInputError('INVALID_UNIT_COST', 'unitCost solo aplica a entradas de mercancía (RESTOCK)')
    }

    const movement = await this.inventory.applyStockChange(
      {
        productId,
        type: input.type,
        quantityDelta: input.quantity,
        userId: actorId,
        note: input.note?.trim() || null,
        ...(input.unitCost !== undefined && { newPurchaseCost: roundMoney(input.unitCost) }),
      },
      (currentStock) => {
        // Solo las ventas AUTOMATED pueden dejar el stock en negativo; un ajuste manual no.
        if (currentStock + input.quantity < 0) {
          throw new ConflictError(
            'INSUFFICIENT_STOCK',
            `El ajuste dejaría el stock en ${currentStock + input.quantity} (actual: ${currentStock})`,
          )
        }
      },
    )
    if (!movement) throw new NotFoundError('PRODUCT_NOT_FOUND', `No existe el producto ${productId}`)
    return movement
  }

  summary(): Promise<InventorySummary> {
    return this.inventory.summary()
  }

  listMovements(filters: MovementFilters, page: PageRequest): Promise<Page<InventoryMovement>> {
    return this.inventory.listMovements(filters, page)
  }
}
