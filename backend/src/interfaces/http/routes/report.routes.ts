import { Elysia, t } from 'elysia'
import type { ReportUseCases } from '../../../application/reports/report.use-cases'
import { Role } from '../../../domain/enums'
import type { AuthPlugin } from '../plugins/auth.plugin'
import { errors } from '../schemas/common.schema'
import {
  ReportSummarySchema,
  SummaryQuery,
  TopProductSchema,
  TopProductsQuery,
  TrendPointSchema,
  TrendQuery,
} from '../schemas/report.schema'

const toRange = ({ from, to }: { from: string; to: string }) => ({ from: new Date(from), to: new Date(to) })

export const reportRoutes = (auth: AuthPlugin, useCases: ReportUseCases) =>
  new Elysia({ prefix: '/reports' })
    .use(auth)
    .guard({ auth: [Role.OWNER], detail: { tags: ['Reports'] } }, (app) =>
      app
        .get(
          '/summary',
          async ({ query }) => {
            const summary = await useCases.summary(toRange(query))
            return { ...summary, from: summary.from.toISOString(), to: summary.to.toISOString() }
          },
          {
            query: SummaryQuery,
            response: { 200: ReportSummarySchema, ...errors(400, 401, 403) },
            detail: { summary: 'Métricas clave en un rango (el dashboard pide hoy y semana)', operationId: 'getReportSummary' },
          },
        )
        .get(
          '/sales-trend',
          async ({ query }) =>
            (await useCases.salesTrend(toRange(query), query.granularity ?? 'day')).map((point) => ({
              ...point,
              bucket: point.bucket.toISOString(),
            })),
          {
            query: TrendQuery,
            response: { 200: t.Array(TrendPointSchema), ...errors(400, 401, 403) },
            detail: { summary: 'Serie temporal de ventas y ganancia', operationId: 'getSalesTrend' },
          },
        )
        .get('/top-products', ({ query }) => useCases.topProducts(toRange(query), query.by ?? 'quantity', query.limit ?? 10), {
          query: TopProductsQuery,
          response: { 200: t.Array(TopProductSchema), ...errors(400, 401, 403) },
          detail: { summary: 'Productos de mayor rotación', operationId: 'getTopProducts' },
        }),
    )
