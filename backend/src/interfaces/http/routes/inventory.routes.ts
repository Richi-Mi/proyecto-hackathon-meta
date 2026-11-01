import { Elysia } from 'elysia'
import type { InventoryUseCases } from '../../../application/inventory/inventory.use-cases'
import { Role } from '../../../domain/enums'
import type { AuthPlugin } from '../plugins/auth.plugin'
import { presentMovement, presentPage } from '../presenters'
import { errors, paginated } from '../schemas/common.schema'
import {
  InventoryMovementSchema,
  InventorySummarySchema,
  MovementListQuery,
  StockAdjustmentRequest,
} from '../schemas/inventory.schema'
import { ProductParams } from '../schemas/product.schema'

export const inventoryRoutes = (auth: AuthPlugin, useCases: InventoryUseCases) =>
  new Elysia()
    .use(auth)
    .guard({ auth: [Role.OWNER], detail: { tags: ['Inventory'] } }, (app) =>
      app
        .post(
          '/products/:id/stock-adjustments',
          async ({ params, body, auth, status }) =>
            status(201, presentMovement(await useCases.adjustStock(params.id, body, auth.userId))),
          {
            params: ProductParams,
            body: StockAdjustmentRequest,
            response: { 201: InventoryMovementSchema, ...errors(400, 401, 403, 404, 409) },
            detail: { summary: 'Entrada de mercancía o ajuste manual de stock', operationId: 'createStockAdjustment' },
          },
        )
        .get('/inventory/summary', () => useCases.summary(), {
          response: { 200: InventorySummarySchema, ...errors(401, 403) },
          detail: { summary: 'KPIs del dashboard de inventario', operationId: 'getInventorySummary' },
        })
        .get(
          '/inventory/movements',
          async ({ query: { page, limit, from, to, ...filters } }) =>
            presentPage(
              await useCases.listMovements(
                { ...filters, from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined },
                { page, limit },
              ),
              presentMovement,
            ),
          {
            query: MovementListQuery,
            response: { 200: paginated(InventoryMovementSchema), ...errors(400, 401, 403) },
            detail: { summary: 'Kardex / auditoría de movimientos', operationId: 'listInventoryMovements' },
          },
        ),
    )
