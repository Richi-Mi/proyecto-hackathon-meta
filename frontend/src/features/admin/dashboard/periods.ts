import type { DateRange, Granularity } from '../api'

export type PeriodKey = 'today' | 'week' | 'month'

interface Period {
  key: PeriodKey
  label: string
  /** Texto para "vs. …" en los KPIs */
  previousLabel: string
  days: number
  granularity: Granularity
}

export const PERIODS: Period[] = [
  { key: 'today', label: 'Hoy', previousLabel: 'ayer', days: 1, granularity: 'hour' },
  { key: 'week', label: '7 días', previousLabel: 'los 7 días previos', days: 7, granularity: 'day' },
  { key: 'month', label: '30 días', previousLabel: 'los 30 días previos', days: 30, granularity: 'day' },
]

const addDays = (date: Date, days: number) => {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

/**
 * Rango del periodo (incluye hoy completo) y el periodo inmediato anterior de la misma duración.
 * Los días se cortan a medianoche en la hora local del navegador (la de la tienda).
 */
export function periodRanges(period: Period, today = new Date()): { current: DateRange; previous: DateRange } {
  const tomorrow = addDays(new Date(today.getFullYear(), today.getMonth(), today.getDate()), 1)
  const from = addDays(tomorrow, -period.days)
  return {
    current: { from, to: tomorrow },
    previous: { from: addDays(from, -period.days), to: from },
  }
}

/** +12.5 % / −3.0 % respecto al periodo anterior; null si no hay base de comparación. */
export function percentChange(current: number, previous: number) {
  if (previous === 0) return null
  return (current - previous) / Math.abs(previous)
}
