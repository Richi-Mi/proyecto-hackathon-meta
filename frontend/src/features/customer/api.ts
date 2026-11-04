import { customerApi } from '@/lib/api/client'
import type { CurrentVisit, PurchaseHistory, VisitCheckout } from '@/lib/api/types'

export const fetchPurchases = async (limit: number, signal?: AbortSignal) =>
  (await customerApi.get<PurchaseHistory>('/me/purchases', { params: { page: 1, limit }, signal })).data

/** Mi visita activa y lo que la cámara me ha visto tomar */
export const fetchMyVisit = async (signal?: AbortSignal) => (await customerApi.get<CurrentVisit>('/me/visit', { signal })).data

/** Salir de la tienda: se cobra el carrito con el método guardado */
export const checkoutMyVisit = async () => (await customerApi.post<VisitCheckout>('/me/visit/checkout', undefined, { timeout: 30_000 })).data
