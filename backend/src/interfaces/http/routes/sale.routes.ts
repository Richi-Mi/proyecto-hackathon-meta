import { Elysia } from 'elysia'
import type { SaleUseCases } from '../../../application/sales/sale.use-cases'
import { Role } from '../../../domain/enums'
import type { AuthPlugin } from '../plugins/auth.plugin'
import { presentPage, presentSale, presentSaleSummary } from '../presenters'
import { errors, paginated } from '../schemas/common.schema'
import {
  CancelSaleRequest,
  IdempotencyHeaders,
  ManualSaleRequest,
  ReceiptSchema,
  SaleDetailSchema,
  SaleListQuery,
  SaleParams,
  SaleSummarySchema,
} from '../schemas/sale.schema'

export const saleRoutes = (auth: AuthPlugin, useCases: SaleUseCases) =>
  new Elysia({ prefix: '/sales' })
    .use(auth)
    .guard({ auth: [Role.OWNER], detail: { tags: ['Sales'] } }, (app) =>
      app
        .get(
          '',
          async ({ query: { page, limit, from, to, ...filters } }) =>
            presentPage(
              await useCases.list(
                { ...filters, from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined },
                { page, limit },
              ),
              presentSaleSummary,
            ),
          {
            query: SaleListQuery,
            response: { 200: paginated(SaleSummarySchema), ...errors(400, 401, 403) },
            detail: { summary: 'Historial cronológico de tickets', operationId: 'listSales' },
          },
        )
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
        })
        .get(
          '/:id/receipt',
          async ({ params }) => {
            const receipt = await useCases.getReceipt(params.id)
            return { ...receipt, sale: presentSale(receipt.sale), printedAt: receipt.printedAt.toISOString() }
          },
          {
            params: SaleParams,
            response: { 200: ReceiptSchema, ...errors(401, 403, 404) },
            detail: { summary: 'Datos del ticket para (re)impresión', operationId: 'getSaleReceipt' },
          },
        )
        .post(
          '/:id/cancel',
          async ({ params, body, auth }) => presentSale(await useCases.cancel(params.id, auth.userId, body.reason)),
          {
            params: SaleParams,
            body: CancelSaleRequest,
            response: { 200: SaleDetailSchema, ...errors(400, 401, 403, 404, 409, 422) },
            detail: {
              summary: 'Cancela la venta completa, repone stock y reembolsa (CARD_ON_FILE vía gateway)',
              operationId: 'cancelSale',
            },
          },
        ),
    )
