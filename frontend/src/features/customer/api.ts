import { customerApi } from '@/lib/api/client'
import type { PurchaseHistory } from '@/lib/api/types'

export const fetchPurchases = async (limit: number, signal?: AbortSignal) =>
  (await customerApi.get<PurchaseHistory>('/me/purchases', { params: { page: 1, limit }, signal })).data
