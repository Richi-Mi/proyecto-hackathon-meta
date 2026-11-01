import type { Role } from '../enums'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase()
