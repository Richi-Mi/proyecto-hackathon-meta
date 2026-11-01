import { roundMoney } from '../money'

export interface PriceableLine {
  quantity: number
  /** IVA incluido */
  unitPrice: number
  taxRate: number
}

export interface LinePrice {
  /** unitPrice × quantity (IVA incluido) */
  total: number
  base: number
  tax: number
}

/** Precio con IVA incluido → total de la partida y su desglose base/IVA. */
export function priceLine({ quantity, unitPrice, taxRate }: PriceableLine): LinePrice {
  const total = roundMoney(unitPrice * quantity)
  const base = roundMoney(total / (1 + taxRate))
  return { total, base, tax: roundMoney(total - base) }
}

export interface TaxBreakdownLine {
  rate: number
  base: number
  tax: number
}

/** Desglose de IVA por tasa para el ticket (misma base redondeada por partida que al vender). */
export function taxBreakdown(items: { subtotal: number; taxRate: number }[]): TaxBreakdownLine[] {
  const byRate = new Map<number, TaxBreakdownLine>()
  for (const { subtotal, taxRate } of items) {
    const base = roundMoney(subtotal / (1 + taxRate))
    const line = byRate.get(taxRate) ?? { rate: taxRate, base: 0, tax: 0 }
    line.base = roundMoney(line.base + base)
    line.tax = roundMoney(line.tax + subtotal - base)
    byRate.set(taxRate, line)
  }
  return [...byRate.values()].sort((a, b) => a.rate - b.rate)
}

export interface SaleTotals {
  /** Σ base sin IVA */
  subtotal: number
  taxAmount: number
  totalAmount: number
}

/** Totales del ticket: suma del desglose de cada partida (redondeo por partida, como en el ticket impreso). */
export function priceSale(lines: PriceableLine[]): SaleTotals {
  const totals = lines.map(priceLine).reduce(
    (acc, line) => ({
      subtotal: acc.subtotal + line.base,
      taxAmount: acc.taxAmount + line.tax,
      totalAmount: acc.totalAmount + line.total,
    }),
    { subtotal: 0, taxAmount: 0, totalAmount: 0 },
  )
  return {
    subtotal: roundMoney(totals.subtotal),
    taxAmount: roundMoney(totals.taxAmount),
    totalAmount: roundMoney(totals.totalAmount),
  }
}
