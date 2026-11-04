import type { Page } from '../../application/common/pagination'
import type { Category } from '../../domain/models/category'
import type { InventoryMovement } from '../../domain/models/inventory'
import type { VisitCart } from '../../application/shelf/shelf.use-cases'
import type { ShelfEvent } from '../../domain/models/shelf-event'
import { isLowStock, type Product } from '../../domain/models/product'
import { itemCount, type Sale } from '../../domain/models/sale'
import type { StoreSettings } from '../../domain/models/store-settings'
import type { User } from '../../domain/models/user'

// Modelos de dominio → forma exacta del contrato (fechas ISO, campos derivados, sin datos internos).

export const presentUser = (user: User) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt.toISOString(),
})

export const presentCategory = (category: Category) => ({
  id: category.id,
  name: category.name,
  color: category.color,
  icon: category.icon,
  sortOrder: category.sortOrder,
})

export const presentProduct = (product: Product) => ({
  id: product.id,
  barcode: product.barcode,
  name: product.name,
  description: product.description,
  category: presentCategory(product.category),
  price: product.price,
  purchaseCost: product.purchaseCost,
  taxRate: product.taxRate,
  stock: product.stock,
  minStockAlert: product.minStockAlert,
  status: product.status,
  imageUrl: product.imageUrl,
  isQuickAccess: product.isQuickAccess,
  isLowStock: isLowStock(product),
  createdAt: product.createdAt.toISOString(),
  updatedAt: product.updatedAt.toISOString(),
})

export const presentMovement = (movement: InventoryMovement) => ({
  id: movement.id,
  productId: movement.productId,
  type: movement.type,
  quantityDelta: movement.quantityDelta,
  stockAfter: movement.stockAfter,
  saleId: movement.saleId,
  userId: movement.userId,
  note: movement.note,
  createdAt: movement.createdAt.toISOString(),
})

export const presentSaleSummary = (sale: Sale) => ({
  id: sale.id,
  folio: sale.folio,
  dateTime: sale.dateTime.toISOString(),
  saleType: sale.saleType,
  paymentMethod: sale.paymentMethod,
  paymentStatus: sale.paymentStatus,
  status: sale.status,
  totalAmount: sale.totalAmount,
  itemCount: itemCount(sale),
  customer: sale.customer,
})

export const presentSale = (sale: Sale) => ({
  id: sale.id,
  folio: sale.folio,
  dateTime: sale.dateTime.toISOString(),
  saleType: sale.saleType,
  paymentMethod: sale.paymentMethod,
  paymentStatus: sale.paymentStatus,
  status: sale.status,
  totalAmount: sale.totalAmount,
  itemCount: itemCount(sale),
  customer: sale.customer,
  items: sale.items.map((item) => ({
    id: item.id,
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    taxRate: item.taxRate,
    subtotal: item.subtotal,
  })),
  subtotal: sale.subtotal,
  taxAmount: sale.taxAmount,
  cashReceived: sale.cashReceived,
  changeGiven: sale.changeGiven,
  paymentReference: sale.paymentReference,
  cashier: sale.cashier,
  cancelledAt: sale.cancelledAt?.toISOString() ?? null,
  cancelReason: sale.cancelReason,
})

export const presentPage =<T, R>(page: Page<T>, present: (item: T) => R) => ({
  data: page.data.map(present),
  meta: page.meta,
})

export const presentSettings = (settings: StoreSettings) => ({
  businessName: settings.businessName,
  legalName: settings.legalName,
  rfc: settings.rfc,
  address: settings.address,
  phone: settings.phone,
  logoUrl: settings.logoUrl,
  currency: 'MXN' as const,
  defaultTaxRate: settings.defaultTaxRate,
  pricesIncludeTax: true as const,
  ticketFooter: settings.ticketFooter,
  peripherals: settings.peripherals,
  ...(settings.updatedAt && { updatedAt: settings.updatedAt.toISOString() }),
})

export const presentShelfEvent = (event: ShelfEvent) => ({
  id: event.id,
  cameraId: event.cameraId,
  status: event.status,
  action: event.action,
  product: event.productId ? { id: event.productId, name: event.productName } : null,
  quantity: event.quantity,
  confidence: event.confidence,
  reviewReason: event.reviewReason,
  note: event.note,
  model: event.model,
  changeRatio: event.changeRatio,
  movementId: event.movementId,
  visitId: event.visitId,
  capturedAt: event.capturedAt.toISOString(),
  createdAt: event.createdAt.toISOString(),
  resolvedAt: event.resolvedAt?.toISOString() ?? null,
})

export const presentVisitCart = (cart: VisitCart) => ({ ...cart, enteredAt: cart.enteredAt.toISOString() })
