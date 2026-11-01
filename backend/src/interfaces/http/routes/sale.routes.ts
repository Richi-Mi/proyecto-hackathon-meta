import { Elysia } from 'elysia'
import type { SaleUseCases } from '../../../application/sales/sale.use-cases'
import { Role } from '../../../domain/enums'
import type { AuthPlugin } from '../plugins/auth.plugin'
import { presentSale } from '../presenters'
import { errors } from '../schemas/common.schema'
import { IdempotencyHeaders, ManualSaleRequest, SaleDetailSchema, SaleParams } from '../schemas/sale.schema'

export const saleRoutes = (auth: AuthPlugin, useCases: SaleUseCases) =>
  new Elysia({ prefix: '/sales' })
    .use(auth)
    .guard({ auth: [Role.OWNER], detail: { tags: ['Sales'] } }, (app) =>
      app
        .post(
          '',
          async ({ body, headers, auth, status }) =>
            status(
              201,
              presentSale(
                await useCases.createManualSale(body, auth.userId, { idempotencyKey: headers['idempotency-key'] }),
              ),
            ),
          {
            body: ManualSaleRequest,
            headers: IdempotencyHeaders,
            response: { 201: SaleDetailSchema, ...errors(400, 401, 403, 404, 409, 422) },
            detail: {
              summary: 'Venta MANUAL desde el POS (precios e impuestos recalculados en servidor)',
              operationId: 'createManualSale',
            },
          },
        )
        .get('/:id', async ({ params }) => presentSale(await useCases.getById(params.id)), {
          params: SaleParams,
          response: { 200: SaleDetailSchema, ...errors(401, 403, 404) },
          detail: { summary: 'Detalle de venta', operationId: 'getSale' },
        }),
    )
