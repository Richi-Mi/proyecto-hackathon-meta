/** "Ana María López" → "AL" */
export function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const first = words[0]?.[0] ?? ''
  const last = words.length > 1 ? (words.at(-1)?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const compactMoney = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  notation: 'compact',
  maximumFractionDigits: 1,
})
const dateTime = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' })

/** 1234.5 → "$1,234.50" */
export const formatMoney = (value: number) => money.format(value)

/** 12345 → "$12.3 mil" (ejes de gráficas) */
export const formatCompactMoney = (value: number) => compactMoney.format(value)

/** 0.16 → "16 %" */
export const formatRate = (rate: number) => `${Math.round(rate * 100)} %`

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))
