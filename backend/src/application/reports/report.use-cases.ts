import { InvalidInputError } from '../../domain/errors'
import type {
  Granularity,
  ReportRange,
  ReportSummary,
  TopProduct,
  TopProductMetric,
  TrendPoint,
} from '../../domain/models/report'
import type { ReportRepository } from '../ports/report-repository'

const DAY_MS = 86_400_000
/** Rango máximo de cualquier reporte (un año con margen) */
const MAX_RANGE_DAYS = 400
/** Puntos máximos de una serie (p. ej. horas en ~41 días) */
const MAX_BUCKETS = 1000
const APPROX_BUCKET_MS: Record<Granularity, number> = {
  hour: 3_600_000,
  day: DAY_MS,
  week: 7 * DAY_MS,
  month: 28 * DAY_MS,
}

export class ReportUseCases {
  constructor(private readonly reports: ReportRepository) {}

  summary(range: ReportRange): Promise<ReportSummary> {
    assertValidRange(range)
    return this.reports.summary(range)
  }

  salesTrend(range: ReportRange, granularity: Granularity): Promise<TrendPoint[]> {
    assertValidRange(range)
    const buckets = Math.ceil((range.to.getTime() - range.from.getTime()) / APPROX_BUCKET_MS[granularity])
    if (buckets > MAX_BUCKETS) {
      throw new InvalidInputError(
        'RANGE_TOO_LARGE',
        `El rango genera ~${buckets} puntos por ${granularity}; usa una granularidad mayor (máximo ${MAX_BUCKETS})`,
      )
    }
    return this.reports.salesTrend(range, granularity)
  }

  topProducts(range: ReportRange, metric: TopProductMetric, limit: number): Promise<TopProduct[]> {
    assertValidRange(range)
    return this.reports.topProducts(range, metric, limit)
  }
}

function assertValidRange({ from, to }: ReportRange) {
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
    throw new InvalidInputError('INVALID_RANGE', '`from` debe ser anterior a `to`')
  }
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY_MS) {
    throw new InvalidInputError('RANGE_TOO_LARGE', `El rango máximo es de ${MAX_RANGE_DAYS} días`)
  }
}
