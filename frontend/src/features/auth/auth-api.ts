import { apiFor, customerApi } from '@/lib/api/client'
import type { AuthResponse, LoginRequest, RegisterRequest } from '@/lib/api/types'
import type { Portal } from './session-store'

export async function login(portal: Portal, credentials: LoginRequest) {
  const path = portal === 'admin' ? '/auth/admin/login' : '/auth/login'
  return (await apiFor(portal).post<AuthResponse>(path, credentials)).data
}

export async function registerCustomer(data: RegisterRequest) {
  return (await customerApi.post<AuthResponse>('/auth/register', data)).data
}
