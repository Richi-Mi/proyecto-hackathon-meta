import { t } from 'elysia'
import { MovementType } from '../../../domain/enums'
import { DateTime, Money, PaginationQuery, Uuid } from './common.schema'

export const StockAdjustmentRequest = t.Object({
  type: t.UnionEnum([MovementType.RESTOCK, MovementType.ADJUSTMENT]),
  quantity: t.Integer({ description: 'RESTOCK > 0; ADJUSTMENT ≠ 0 (negativo = merma)' }),
  unitCost: t.Optional(t.Number({ ...Money, description: 'Opcional en RESTOCK: actualiza purchaseCost' })),
  note: t.Optional(t.String({ maxLength: 255 })),
})

export const InventoryMovementSchema = t.Object(
  {
    id: Uuid,
    productId: t.String(),
    type: t.Enum(MovementType),
    quantityDelta: t.Integer(),
    stockAfter: t.Integer(),
    saleId: t.Nullable(Uuid),
    userId: t.Nullable(Uuid),
    note: t.Nullable(t.String()),
    createdAt: DateTime,
  },
  { title: 'InventoryMovement' },
)

export const InventorySummarySchema = t.Object(
  {
    totalProducts: t.Integer(),
    totalUnits: t.Integer(),
    totalCostValue: t.Number({ ...Money, description: 'Σ stock × purchaseCost' }),
    totalRetailValue: t.Number({ ...Money, description: 'Σ stock × price' }),
    lowStockCount: t.Integer(),
    outOfStockCount: t.Integer({ description: 'stock <= 0' }),
    byCategory: t.Array(
      t.Object({ categoryId: Uuid, name: t.String(), units: t.Integer(), costValue: Money }),
    ),
  },
  { title: 'InventorySummary' },
)

export const MovementListQuery = t.Object({
  productId: t.Optional(t.String({ maxLength: 64 })),
  type: t.Optional(t.Enum(MovementType)),
  from: t.Optional(DateTime),
  to: t.Optional(DateTime),
  ...PaginationQuery,
})
