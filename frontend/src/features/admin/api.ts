import { adminApi } from '@/lib/api/client'
import type {
  Category,
  CheckoutResult,
  GateCheckoutRequest,
  CategoryInput,
  InventoryMovement,
  InventorySummary,
  ManualSaleRequest,
  Paginated,
  Product,
  ProductCreate,
  ProductUpdate,
  Receipt,
  ReportSummary,
  SaleDetail,
  SaleSummary,
  ShelfEvent,
  ShelfEventConfirmRequest,
  ShelfEventCreateRequest,
  ShelfEventDetail,
  ShelfEventStatus,
  ShelfVisionStatus,
  SimulatedVisit,
  CurrentVisit,
  ProductIdentification,
  VisitCheckout,
  StockAdjustmentRequest,
  StoreEntryResponse,
  StoreSettings,
  StoreSettingsUpdate,
  StoreVisit,
  VisitStatus,
  TopProduct,
  TrendPoint,
} from '@/lib/api/types'

/** Intervalo [from, to) */
export interface DateRange {
  from: Date
  to: Date
}

export type Granularity = 'hour' | 'day' | 'week' | 'month'
export type TopProductMetric = 'quantity' | 'revenue' | 'profit'

const rangeParams = ({ from, to }: DateRange) => ({ from: from.toISOString(), to: to.toISOString() })

export const fetchReportSummary = async (range: DateRange, signal?: AbortSignal) =>
  (await adminApi.get<ReportSummary>('/reports/summary', { params: rangeParams(range), signal })).data

export const fetchSalesTrend = async (range: DateRange, granularity: Granularity, signal?: AbortSignal) =>
  (await adminApi.get<TrendPoint[]>('/reports/sales-trend', { params: { ...rangeParams(range), granularity }, signal })).data

export const fetchTopProducts = async (range: DateRange, by: TopProductMetric, limit: number, signal?: AbortSignal) =>
  (await adminApi.get<TopProduct[]>('/reports/top-products', { params: { ...rangeParams(range), by, limit }, signal })).data

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

const productPath = (id: string) => `/products/${encodeURIComponent(id)}`

export const createProduct = async (product: ProductCreate) =>
  (await adminApi.post<Product>('/products', product)).data

export const updateProduct = async (id: string, changes: ProductUpdate) =>
  (await adminApi.patch<Product>(productPath(id), changes)).data

/** Baja lógica: el SKU queda reservado y el historial de ventas se conserva. */
export const deleteProduct = async (id: string) => {
  await adminApi.delete(productPath(id))
}

export const adjustStock = async (id: string, adjustment: StockAdjustmentRequest) =>
  (await adminApi.post<InventoryMovement>(`${productPath(id)}/stock-adjustments`, adjustment)).data

export const fetchMovements = async (query: { productId?: string; limit?: number }, signal?: AbortSignal) =>
  (await adminApi.get<Paginated<InventoryMovement>>('/inventory/movements', { params: query, signal })).data

export const fetchCategories = async (signal?: AbortSignal) =>
  (await adminApi.get<Category[]>('/categories', { signal })).data

export const createCategory = async (category: CategoryInput) =>
  (await adminApi.post<Category>('/categories', category)).data

export const fetchInventorySummary = async (signal?: AbortSignal) =>
  (await adminApi.get<InventorySummary>('/inventory/summary', { signal })).data

export interface SaleQuery {
  page: number
  limit: number
  from?: string
  to?: string
  type?: SaleSummary['saleType']
  status?: SaleSummary['status']
  paymentMethod?: SaleSummary['paymentMethod']
  folio?: number
}

export const fetchSales = async (query: SaleQuery, signal?: AbortSignal) =>
  (await adminApi.get<Paginated<SaleSummary>>('/sales', { params: query, signal })).data

export const fetchReceipt = async (saleId: string, signal?: AbortSignal) =>
  (await adminApi.get<Receipt>(`/sales/${saleId}/receipt`, { signal })).data

export const cancelSale = async (saleId: string, reason: string) =>
  (await adminApi.post<SaleDetail>(`/sales/${saleId}/cancel`, { reason })).data

/** Solo existe si el backend corre con NODE_ENV ≠ production */
export const simulateStoreVisit = async () => (await adminApi.post<SimulatedVisit>('/dev/simulate-visit')).data

export const createManualSale = async(sale: ManualSaleRequest, idempotencyKey: string) =>
  (await adminApi.post<SaleDetail>('/sales', sale, { headers: { 'Idempotency-Key': idempotencyKey } })).data

export const fetchSettings = async (signal?: AbortSignal) =>
  (await adminApi.get<StoreSettings>('/settings', { signal })).data

/** PATCH parcial; en `peripherals` solo se reemplazan los dispositivos enviados. */
export const updateSettings = async (changes: StoreSettingsUpdate) =>
  (await adminApi.patch<StoreSettings>('/settings', changes)).data

// ── ShelfSight: cámara de repisa ─────────────────────────────────────────────

export const fetchShelfVisionStatus = async (signal?: AbortSignal) =>
  (await adminApi.get<ShelfVisionStatus>('/shelf/vision', { signal })).data

/** El modelo de visión puede tardar: más margen que el timeout general */
export const createShelfEvent = async (event: ShelfEventCreateRequest) =>
  (await adminApi.post<ShelfEvent>('/shelf-events', event, { timeout: 90_000 })).data

export const fetchShelfEvents = async (query: { status?: ShelfEventStatus; page?: number; limit?: number }, signal?: AbortSignal) =>
  (await adminApi.get<Paginated<ShelfEvent>>('/shelf-events', { params: query, signal })).data

export const fetchShelfEvent = async (id: string, signal?: AbortSignal) =>
  (await adminApi.get<ShelfEventDetail>(`/shelf-events/${id}`, { signal })).data

export const confirmShelfEvent = async (id: string, confirmation: ShelfEventConfirmRequest) =>
  (await adminApi.post<ShelfEvent>(`/shelf-events/${id}/confirm`, confirmation)).data

export const rejectShelfEvent = async (id: string) => (await adminApi.post<ShelfEvent>(`/shelf-events/${id}/reject`)).data

/** Cliente dentro de la tienda y su carrito */
export const fetchCurrentVisit = async (signal?: AbortSignal) => (await adminApi.get<CurrentVisit>('/shelf/visit', { signal })).data

export const checkoutCurrentVisit = async () => (await adminApi.post<VisitCheckout>('/shelf/visit/checkout', undefined, { timeout: 30_000 })).data

/** Caja: reconoce un producto con una foto */
export const identifyProduct = async (image: string) =>
  (await adminApi.post<ProductIdentification>('/products/identify', { image }, { timeout: 90_000 })).data

// ── Puerta operada desde el teléfono del propietario ─────────────────────────

/** Contenido del QR del cliente → abre su visita. QR inválido o expirado = 422 `INVALID_ENTRY_TOKEN`. */
export const admitAtGate = async (token: string, gateId?: string) =>
  (await adminApi.post<StoreEntryResponse>('/store-visits', { token, ...(gateId && { gateId }) })).data

export const fetchStoreVisits = async (query: { status?: VisitStatus; limit?: number }, signal?: AbortSignal) =>
  (await adminApi.get<StoreVisit[]>('/store-visits', { params: query, signal })).data

/** `items` vacío = el cliente salió sin comprar */
export const checkoutAtGate = async (visitId: string, items: GateCheckoutRequest['items']) =>
  (await adminApi.post<CheckoutResult>(`/store-visits/${visitId}/checkout`, { items })).data
