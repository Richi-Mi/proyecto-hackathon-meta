import type { DataSource } from 'typeorm'
import type { ReportRepository } from '../../../application/ports/report-repository'
import { roundMoney } from '../../../domain/money'
import type {
  Granularity,
  ReportRange,
  ReportSummary,
  TopProduct,
  TopProductMetric,
  TrendPoint,
} from '../../../domain/models/report'

// `pg` devuelve numeric/bigint como texto
type Numeric = string | number

/**
 * Ventas COMPLETED del rango con su costo (snapshot de las partidas).
 * Ganancia de la venta = subtotal (base sin IVA) − costo.
 */
const SALES_WITH_COST = `
  SELECT s.id, s.date_time, s.sale_type, s.payment_status, s.total_amount, s.tax_amount,
         s.subtotal - coalesce((SELECT sum(si.unit_cost * si.quantity) FROM sale_items si WHERE si.sale_id = s.id), 0) AS profit
  FROM sales s
  WHERE s.status = 'COMPLETED' AND s.date_time >= $1 AND s.date_time < $2`

const ORDER_BY_METRIC: Record<TopProductMetric, string> = {
  quantity: 'quantity',
  revenue: 'revenue',
  profit: 'profit',
}

export class TypeOrmReportRepository implements ReportRepository {
  constructor(
    private readonly dataSource: DataSource,
    /** Zona IANA de la tienda, p. ej. America/Mexico_City */
    private readonly timeZone: string,
  ) {}

  async summary({ from, to }: ReportRange): Promise<ReportSummary> {
    const [row] = await this.dataSource.query<Record<string, Numeric>[]>(
      `WITH sales_in_range AS (${SALES_WITH_COST})
       SELECT count(*) AS transactions,
              coalesce(sum(total_amount), 0) AS revenue,
              coalesce(sum(tax_amount), 0) AS tax,
              coalesce(sum(profit), 0) AS profit,
              count(*) FILTER (WHERE sale_type = 'AUTOMATED') AS automated_transactions,
              coalesce(sum(total_amount) FILTER (WHERE sale_type = 'AUTOMATED'), 0) AS automated_revenue,
              count(*) FILTER (WHERE sale_type = 'MANUAL') AS manual_transactions,
              coalesce(sum(total_amount) FILTER (WHERE sale_type = 'MANUAL'), 0) AS manual_revenue,
              coalesce(sum(total_amount) FILTER (WHERE payment_status IN ('FAILED', 'PENDING')), 0) AS pending
       FROM sales_in_range`,
      [from, to],
    )
    const value = (key: string) => Number(row?.[key] ?? 0)
    const transactions = value('transactions')
    const revenue = value('revenue')

    return {
      from,
      to,
      revenue,
      taxCollected: value('tax'),
      netProfit: value('profit'),
      transactions,
      averageTicket: transactions > 0 ? roundMoney(revenue / transactions) : 0,
      byType: {
        AUTOMATED: { revenue: value('automated_revenue'), transactions: value('automated_transactions') },
        MANUAL: { revenue: value('manual_revenue'), transactions: value('manual_transactions') },
      },
      pendingPayments: value('pending'),
    }
  }

  async salesTrend({ from, to }: ReportRange, granularity: Granularity): Promise<TrendPoint[]> {
    // Los periodos se truncan en hora local y se devuelven como instantes (timestamptz)
    const rows = await this.dataSource.query<{ bucket: Date; transactions: Numeric; revenue: Numeric; profit: Numeric }[]>(
      `WITH buckets AS (
         SELECT generate_series(
           date_trunc($3::text, $1::timestamptz AT TIME ZONE $4::text),
           date_trunc($3::text, ($2::timestamptz - interval '1 microsecond') AT TIME ZONE $4::text),
           ('1 ' || $3::text)::interval
         ) AS local_bucket
       ),
       sales_in_range AS (${SALES_WITH_COST})
       SELECT b.local_bucket AT TIME ZONE $4::text AS bucket,
              count(s.id) AS transactions,
              coalesce(sum(s.total_amount), 0) AS revenue,
              coalesce(sum(s.profit), 0) AS profit
       FROM buckets b
       LEFT JOIN sales_in_range s ON date_trunc($3::text, s.date_time AT TIME ZONE $4::text) = b.local_bucket
       GROUP BY b.local_bucket
       ORDER BY b.local_bucket`,
      [from, to, granularity, this.timeZone],
    )
    return rows.map((row) => ({
      bucket: row.bucket,
      transactions: Number(row.transactions),
      revenue: Number(row.revenue),
      netProfit: Number(row.profit),
    }))
  }

  async topProducts({ from, to }: ReportRange, metric: TopProductMetric, limit: number): Promise<TopProduct[]> {
    // La base por partida se redondea igual que al vender (domain/sales/pricing.ts)
    const rows = await this.dataSource.query<{ productId: string; name: string; quantity: Numeric; revenue: Numeric; profit: Numeric }[]>(
      `SELECT si.product_id AS "productId",
              coalesce(p.name, max(si.product_name)) AS name,
              sum(si.quantity) AS quantity,
              sum(si.subtotal) AS revenue,
              sum(round(si.subtotal / (1 + si.tax_rate), 2) - si.unit_cost * si.quantity) AS profit
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       LEFT JOIN products p ON p.id = si.product_id
       WHERE s.status = 'COMPLETED' AND s.date_time >= $1 AND s.date_time < $2
       GROUP BY si.product_id, p.name
       ORDER BY ${ORDER_BY_METRIC[metric]} DESC, name ASC
       LIMIT $3`,
      [from, to, limit],
    )
    return rows.map((row) => ({
      productId: row.productId,
      name: row.name,
      quantity: Number(row.quantity),
      revenue: Number(row.revenue),
      netProfit: Number(row.profit),
    }))
  }
}
