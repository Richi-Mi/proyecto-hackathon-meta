import type { SaleDetail } from '@/lib/api/types'

export const PAYMENT_METHOD_LABEL: Record<SaleDetail['paymentMethod'], string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  CARD_ON_FILE: 'Cobro automático',
}

export const SALE_TYPE_LABEL: Record<SaleDetail['saleType'], string> = {
  AUTOMATED: 'Automática',
  MANUAL: 'Mostrador',
}

export const PAYMENT_STATUS_LABEL: Record<SaleDetail['paymentStatus'], string> = {
  PAID: 'Pagada',
  PENDING: 'Cobro pendiente',
  FAILED: 'Cobro fallido',
  REFUNDED: 'Reembolsada',
}
