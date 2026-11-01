/**
 * Redondeo decimal "half away from zero" sin errores de punto flotante
 * (18.555 → 18.56, mientras que Math.round(18.555 * 100) / 100 da 18.55).
 */
const roundTo = (value: number, decimals: number): number => {
  const [mantissa, exponent = '0'] = String(value).split('e')
  const shifted = Math.round(Number(`${mantissa}e${Number(exponent) + decimals}`))
  const [m, e = '0'] = String(shifted).split('e')
  return Number(`${m}e${Number(e) - decimals}`)
}

/** Montos en MXN: 2 decimales. */
export const roundMoney = (value: number) => roundTo(value, 2)

/** Tasas de impuesto (0.16 = 16 %): 4 decimales, como `numeric(5,4)`. */
export const roundRate = (value: number) => roundTo(value, 4)
