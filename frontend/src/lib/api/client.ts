import axios, { isAxiosError } from 'axios'
import { getSession, useSessionStore, type Portal } from '@/features/auth/session-store'
import type { ApiErrorBody } from './types'

/** Error normalizado al formato del contrato: `{ error: { code, message, details?, traceId? } }`. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown
  readonly traceId?: string

  constructor(status: number, code: string, message: string, details?: unknown, traceId?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.traceId = traceId
  }
}

export const getErrorMessage = (error: unknown) =>
  error instanceof ApiError ? error.message : 'Ocurrió un error inesperado'

function toApiError(error: unknown, portal: Portal): ApiError {
  if (!isAxiosError<{ error?: ApiErrorBody }>(error)) return new ApiError(0, 'UNKNOWN', 'Ocurrió un error inesperado')
  if (!error.response) return new ApiError(0, 'NETWORK_ERROR', 'No se pudo conectar con el servidor')

  const { status, data } = error.response
  // Token vencido o revocado: se cierra la sesión del portal y los guards de ruta redirigen al login
  if (status === 401 && error.config?.headers?.Authorization) useSessionStore.getState().signOut(portal)

  const body = data?.error
  return new ApiError(status, body?.code ?? 'HTTP_ERROR', body?.message ?? `Error ${status}`, body?.details, body?.traceId)
}

function createApiClient(portal: Portal) {
  const client = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api/v1', timeout: 15_000 })
  client.interceptors.request.use((config) => {
    const session = getSession(portal)
    if (session) config.headers.Authorization = `Bearer ${session.accessToken}`
    return config
  })
  client.interceptors.response.use(undefined, (error: unknown) => Promise.reject(toApiError(error, portal)))
  return client
}

export const customerApi = createApiClient('customer')
export const adminApi = createApiClient('admin')
export const apiFor = (portal: Portal) => (portal === 'admin' ? adminApi : customerApi)
