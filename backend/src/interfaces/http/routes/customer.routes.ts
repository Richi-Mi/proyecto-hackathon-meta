import { Elysia } from 'elysia'
import type { CustomerUseCases } from '../../../application/customers/customer.use-cases'
import { Role } from '../../../domain/enums'
import type { AuthPlugin } from '../plugins/auth.plugin'
import { presentSale } from '../presenters'
import { errors } from '../schemas/common.schema'
import { EntryPassSchema, PurchaseHistorySchema, PurchaseParams, PurchasesQuery } from '../schemas/customer.schema'
import { SaleDetailSchema } from '../schemas/sale.schema'

export const customerRoutes = (auth: AuthPlugin, useCases: CustomerUseCases) =>
  new Elysia({ prefix: '/me' })
    .use(auth)
    .get(
      '/entry-pass',
      async ({ auth }) => {
        const pass = await useCases.issueEntryPass(auth.userId)
        return { ...pass, expiresAt: pass.expiresAt.toISOString() }
      },
      {
        auth: [Role.CUSTOMER],
        response: { 200: EntryPassSchema, ...errors(401, 403) },
        detail: {
          tags: ['Customer'],
          summary: 'Genera el JWT de pase de entrada para el QR (TTL 60 s, un solo uso)',
          operationId: 'getEntryPass',
        },
      },
    )
    .get(
      '/purchases',
      async ({ auth, query: { page, limit, from, to } }) => {
        const history = await useCases.listPurchases(
          auth.userId,
          { from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined },
          { page, limit },
        )
        return {
          groups: history.groups.map((group) => ({ ...group, sales: group.sales.map(presentSale) })),
          meta: history.meta,
        }
      },
      {
        auth: [Role.CUSTOMER],
        query: PurchasesQuery,
        response: { 200: PurchaseHistorySchema, ...errors(400, 401, 403) },
        detail: { tags: ['Customer'], summary: 'Historial de compras agrupado por fecha', operationId: 'listMyPurchases' },
      },
    )
    .get('/purchases/:saleId', async ({ auth, params }) => presentSale(await useCases.getPurchase(auth.userId, params.saleId)), {
      auth: [Role.CUSTOMER],
      params: PurchaseParams,
      response: { 200: SaleDetailSchema, ...errors(401, 403, 404) },
      detail: { tags: ['Customer'], summary: 'Detalle de una compra propia', operationId: 'getMyPurchase' },
    })
