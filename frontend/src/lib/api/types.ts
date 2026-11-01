import type { components } from './schema'

/** Tipos generados de docs/specs/openapi.yaml (`bun run gen:api`). No editar schema.d.ts a mano. */
export type Schemas = components['schemas']

export type User = Schemas['User']
export type Role = Schemas['Role']
export type AuthResponse = Schemas['AuthResponse']
export type LoginRequest = Schemas['LoginRequest']
export type RegisterRequest = Schemas['RegisterRequest']
export type ApiErrorBody = Schemas['Error']['error']

export type EntryPass = Schemas['EntryPass']
export type Category = Schemas['Category']
export type CategoryInput = Schemas['CategoryInput']
export type Product = Schemas['Product']
export type ProductCreate = Schemas['ProductCreate']
export type ProductUpdate = Schemas['ProductUpdate']
export type ProductStatus = Schemas['ProductStatus']
export type StockAdjustmentRequest = Schemas['StockAdjustmentRequest']
export type InventoryMovement = Schemas['InventoryMovement']
export type InventorySummary = Schemas['InventorySummary']
export type SaleDetail = Schemas['SaleDetail']
export type SaleSummary = Schemas['SaleSummary']
export type PurchaseHistory = Schemas['PurchaseHistory']
export type Receipt = Schemas['Receipt']
export type BusinessProfile = Receipt['business']
export type ManualSaleRequest = Schemas['ManualSaleRequest']
export type PaginationMeta = Schemas['PaginationMeta']
export type ReportSummary = Schemas['ReportSummary']
export type TrendPoint = Schemas['TrendPoint']
export type TopProduct = Schemas['TopProduct']
export type SimulatedVisit = Schemas['SimulatedVisit']
export type StoreSettings = Schemas['StoreSettings']
export type StoreSettingsUpdate = Schemas['StoreSettingsUpdate']
export type Peripherals = Schemas['Peripherals']
export type PrinterSettings = NonNullable<Peripherals['printer']>

export interface Paginated<T> {
  data: T[]
  meta: PaginationMeta
}
