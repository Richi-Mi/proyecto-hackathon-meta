import type {
  Granularity,
  ReportRange,
  ReportSummary,
  TopProduct,
  TopProductMetric,
  TrendPoint,
} from '../../domain/models/report'

/** Agregados de ventas COMPLETED; los periodos se calculan en la zona horaria de la tienda. */
export interface ReportRepository {
  summary(range: ReportRange): Promise<ReportSummary>
  /** Incluye los periodos sin ventas (en cero) para que la serie no tenga huecos. */
  salesTrend(range: ReportRange, granularity: Granularity): Promise<TrendPoint[]>
  topProducts(range: ReportRange, metric: TopProductMetric, limit: number): Promise<TopProduct[]>
}
