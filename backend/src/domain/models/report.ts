import type { SaleType } from '../enums'

/** Intervalo semiabierto [from, to) */
export interface ReportRange {
  from: Date
  to: Date
}

export const GRANULARITIES = ['hour', 'day', 'week', 'month'] as const
export type Granularity = (typeof GRANULARITIES)[number]

export const TOP_PRODUCT_METRICS = ['quantity', 'revenue', 'profit'] as const
export type TopProductMetric = (typeof TOP_PRODUCT_METRICS)[number]

export interface ReportSummary extends ReportRange {
  /** Σ total (IVA incluido) de ventas COMPLETED */
  revenue: number
  taxCollected: number
  /** Σ base sin IVA − Σ costo (snapshot de cada partida) */
  netProfit: number
  transactions: number
  averageTicket: number
  byType: Record<SaleType, { revenue: number; transactions: number }>
  /** Ventas registradas cuyo cobro falló o sigue pendiente */
  pendingPayments: number
}

export interface TrendPoint {
  /** Inicio del periodo (medianoche, hora, lunes o día 1 en la zona horaria de la tienda) */
  bucket: Date
  revenue: number
  netProfit: number
  transactions: number
}

export interface TopProduct {
  productId: string
  name: string
  quantity: number
  revenue: number
  netProfit: number
}
