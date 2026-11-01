import type { Role } from '../enums'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  isActive: boolean
  /** Referencia del cliente en la pasarela de pago (token, nunca datos de tarjeta) */
  paymentCustomerRef: string | null
  createdAt: Date
  updatedAt: Date
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase()
