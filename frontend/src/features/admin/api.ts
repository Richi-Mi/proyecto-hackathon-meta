import { adminApi } from '@/lib/api/client'
import type { Category, InventorySummary, ManualSaleRequest, Paginated, Product, SaleDetail } from '@/lib/api/types'

export interface ProductQuery {
  page?: number
  limit?: number
  search?: string
  categoryId?: string
  status?: Product['status']
  lowStock?: boolean
  quickAccess?: boolean
  sort?: string
}

export const fetchProducts = async (query: ProductQuery, signal?: AbortSignal) =>
  (await adminApi.get<Paginated<Product>>('/products', { params: query, signal })).data

export const lookupProduct = async (code: string) =>
  (await adminApi.get<Product>('/products/lookup', { params: { code } })).data

export const fetchCategories = async (signal?: AbortSignal) =>
  (await adminApi.get<Category[]>('/categories', { signal })).data

export const fetchInventorySummary = async (signal?: AbortSignal) =>
  (await adminApi.get<InventorySummary>('/inventory/summary', { signal })).data

export const createManualSale = async (sale: ManualSaleRequest, idempotencyKey: string) =>
  (await adminApi.post<SaleDetail>('/sales', sale, { headers: { 'Idempotency-Key': idempotencyKey } })).data
