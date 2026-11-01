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
export type Product = Schemas['Product']
export type InventorySummary = Schemas['InventorySummary']
export type SaleDetail = Schemas['SaleDetail']
export type ManualSaleRequest = Schemas['ManualSaleRequest']
export type PaginationMeta = Schemas['PaginationMeta']

export interface Paginated<T> {
  data: T[]
  meta: PaginationMeta
}
