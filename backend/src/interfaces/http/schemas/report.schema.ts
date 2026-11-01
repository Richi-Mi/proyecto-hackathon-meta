import { t } from 'elysia'
import { GRANULARITIES, TOP_PRODUCT_METRICS } from '../../../domain/models/report'
import { DateTime, Money } from './common.schema'

const Range = {
  from: t.String({ format: 'date-time', description: 'Inicio (incluido)' }),
  to: t.String({ format: 'date-time', description: 'Fin (excluido)' }),
}

export const SummaryQuery = t.Object(Range)

export const TrendQuery = t.Object({
  ...Range,
  granularity: t.Optional(t.UnionEnum(GRANULARITIES, { default: 'day' })),
})

export const TopProductsQuery = t.Object({
  ...Range,
  by: t.Optional(t.UnionEnum(TOP_PRODUCT_METRICS, { default: 'quantity' })),
  limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 10 })),
})

const TypeTotals = t.Object({ revenue: Money, transactions: t.Integer() })

export const ReportSummarySchema = t.Object(
  {
    from: DateTime,
    to: DateTime,
    revenue: Money,
    taxCollected: Money,
    netProfit: t.Number({ description: 'Σ base − Σ unit_cost×qty' }),
    transactions: t.Integer(),
    averageTicket: Money,
    byType: t.Object({ AUTOMATED: TypeTotals, MANUAL: TypeTotals }),
    pendingPayments: Money,
  },
  { title: 'ReportSummary' },
)

export const TrendPointSchema = t.Object(
  { bucket: DateTime, revenue: Money, netProfit: t.Number(), transactions: t.Integer() },
  { title: 'TrendPoint' },
)

export const TopProductSchema = t.Object(
  { productId: t.String(), name: t.String(), quantity: t.Integer(), revenue: Money, netProfit: t.Number() },
  { title: 'TopProduct' },
)
