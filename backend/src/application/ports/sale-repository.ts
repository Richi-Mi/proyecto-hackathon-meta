import type { PaymentMethod, PaymentStatus, ProductStatus, SaleType } from '../../domain/enums'
import type { Sale, SaleItem } from '../../domain/models/sale'

/** Producto bloqueado (FOR UPDATE) durante el registro de la venta */
export interface LockedProduct {
  id: string
  name: string
  price: number
  purchaseCost: number
  taxRate: number
  stock: number
  status: ProductStatus
}

export interface SaleDraft {
  saleType: SaleType
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  /** Por defecto, ahora */
  dateTime?: Date
  customerId: string | null
  cashierId: string | null
  externalEventId: string | null
  paymentReference: string | null
  subtotal: number
  taxAmount: number
  totalAmount: number
  cashReceived: number | null
  changeGiven: number | null
  items: Omit<SaleItem, 'id'>[]
}

export interface SaleRepository {
  /**
   * En una transacción: bloquea los productos (orden por id, sin deadlocks), ejecuta `build`
   * —que aplica las reglas de negocio y puede lanzar errores— y persiste la venta, sus partidas,
   * el descuento de stock y los movimientos SALE del kardex. Los productos inexistentes o dados
   * de baja no aparecen en el mapa.
   * @throws ConflictError `DUPLICATE_SALE_EVENT` si `externalEventId` ya existe
   */
  recordSale(productIds: string[], build: (products: Map<string, LockedProduct>) => SaleDraft): Promise<Sale>
  findById(id: string): Promise<Sale | null>
  findByExternalEventId(externalEventId: string): Promise<Sale | null>
  count(): Promise<number>
}
