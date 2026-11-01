import type { SaleDetail } from '@/lib/api/types'
import { priceSale } from '@/lib/pricing'

const ITEMS = [
  { id: 'muestra-1', productId: 'REF-COLA-600', productName: 'Refresco de cola 600 ml', quantity: 2, unitPrice: 20, taxRate: 0.16, subtotal: 40 },
  { id: 'muestra-2', productId: 'LECHE-ENT-1L', productName: 'Leche entera 1 L', quantity: 1, unitPrice: 28.5, taxRate: 0, subtotal: 28.5 },
]

/** Venta de ejemplo para la vista previa del ticket en Configuración (no existe en la base de datos). */
export function sampleSale(): SaleDetail {
  const totals = priceSale(ITEMS)
  return {
    id: 'vista-previa',
    folio: 1024,
    dateTime: new Date().toISOString(),
    saleType: 'MANUAL',
    paymentMethod: 'CASH',
    paymentStatus: 'PAID',
    status: 'COMPLETED',
    itemCount: 3,
    items: ITEMS,
    ...totals,
    cashReceived: 100,
    changeGiven: 100 - totals.totalAmount,
  }
}
