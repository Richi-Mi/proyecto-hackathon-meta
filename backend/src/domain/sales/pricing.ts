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
