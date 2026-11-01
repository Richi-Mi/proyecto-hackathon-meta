import { t } from 'elysia'
import { DateTime, Money, PaginationQuery, Uuid } from './common.schema'
import { SaleDetailSchema } from './sale.schema'

export const EntryPassSchema = t.Object(
  {
    token: t.String({ description: 'JWT {sub, typ:"entry", jti, iat, exp}' }),
    expiresAt: DateTime,
    refreshInSeconds: t.Integer({ examples: [45] }),
  },
  { title: 'EntryPass' },
)

export const PurchasesQuery = t.Object({
  from: t.Optional(DateTime),
  to: t.Optional(DateTime),
  ...PaginationQuery,
})

export const PurchaseParams = t.Object({ saleId: Uuid })

export const PurchaseHistorySchema = t.Object(
  {
    groups: t.Array(
      t.Object({
        date: t.String({ format: 'date', description: 'Día en la zona horaria de la tienda' }),
        totalAmount: t.Number({ ...Money, description: 'Σ de compras no canceladas del día' }),
        sales: t.Array(SaleDetailSchema),
      }),
    ),
    meta: t.Object({ page: t.Integer(), limit: t.Integer(), total: t.Integer() }),
  },
  { title: 'PurchaseHistory' },
)
