import type { Portal } from '@/features/auth/session-store'

export const LOGIN_PATH: Record<Portal, string> = { customer: '/app/login', admin: '/admin/login' }
export const HOME_PATH: Record<Portal, string> = { customer: '/app', admin: '/admin' }
