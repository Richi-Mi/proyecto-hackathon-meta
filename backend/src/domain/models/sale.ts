import type { PaymentMethod, PaymentStatus, SaleStatus, SaleType } from '../enums'

export interface SaleItem {
  id: string
  productId: string
  /** Snapshot al momento de la venta */
  productName: string
  quantity: number
  /** IVA incluido */
  unitPrice: number
  unitCost: number
  taxRate: number
  /** unitPrice × quantity */
  subtotal: number
}

export interface SaleParty {
  id: string
  name: string
}

export interface Sale {
  id: string
  folio: number
  dateTime: Date
  saleType: SaleType
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  status: SaleStatus
  /** Σ base sin IVA */
  subtotal: number
  taxAmount: number
  totalAmount: number
  cashReceived: number | null
  changeGiven: number | null
  paymentReference: string | null
  customer: SaleParty | null
  cashier: SaleParty | null
  cancelledAt: Date | null
  cancelReason: string | null
  items: SaleItem[]
}

/** Piezas totales del ticket */
export const itemCount = (sale: Pick<Sale, 'items'>) => sale.items.reduce((sum, item) => sum + item.quantity, 0)
