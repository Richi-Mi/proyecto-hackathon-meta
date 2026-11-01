// Misma fórmula que backend/src/domain/sales/pricing.ts. Solo para mostrar totales en vivo:
// el servidor recalcula todo con los precios de la base al registrar la venta.

const roundMoney = (value: number) => {
  const [mantissa, exponent = '0'] = String(value).split('e')
  const shifted = Math.round(Number(`${mantissa}e${Number(exponent) + 2}`))
  const [m, e = '0'] = String(shifted).split('e')
  return Number(`${m}e${Number(e) - 2}`)
}

export interface PriceableLine {
  quantity: number
  /** IVA incluido */
  unitPrice: number
  taxRate: number
}

export function priceLine({ quantity, unitPrice, taxRate }: PriceableLine) {
  const total = roundMoney(unitPrice * quantity)
  const base = roundMoney(total / (1 + taxRate))
  return { total, base, tax: roundMoney(total - base) }
}

/** Desglose de IVA por tasa a partir de las partidas del ticket (igual que GET /sales/{id}/receipt). */
export function taxBreakdown(items: { subtotal: number; taxRate: number }[]) {
  const byRate = new Map<number, { rate: number; base: number; tax: number }>()
  for (const { subtotal, taxRate } of items) {
    const base = roundMoney(subtotal / (1 + taxRate))
    const line = byRate.get(taxRate) ?? { rate: taxRate, base: 0, tax: 0 }
    line.base = roundMoney(line.base + base)
    line.tax = roundMoney(line.tax + subtotal - base)
    byRate.set(taxRate, line)
  }
  return [...byRate.values()].sort((a, b) => a.rate - b.rate)
}

export function priceSale(lines: PriceableLine[]) {
  const sums = lines.map(priceLine).reduce(
    (acc, line) => ({ subtotal: acc.subtotal + line.base, taxAmount: acc.taxAmount + line.tax, totalAmount: acc.totalAmount + line.total }),
    { subtotal: 0, taxAmount: 0, totalAmount: 0 },
  )
  return {
    subtotal: roundMoney(sums.subtotal),
    taxAmount: roundMoney(sums.taxAmount),
    totalAmount: roundMoney(sums.totalAmount),
  }
}
