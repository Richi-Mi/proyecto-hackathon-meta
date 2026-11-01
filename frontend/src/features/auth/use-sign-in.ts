import { useLocation, useNavigate } from 'react-router'
import { HOME_PATH } from '@/app/paths'
import type { AuthResponse } from '@/lib/api/types'
import { useSessionStore, type Portal } from './session-store'

/** Guarda la sesión y regresa a la ruta protegida que el usuario intentaba abrir (o al inicio del portal). */
export function useSignIn(portal: Portal) {
  const signIn = useSessionStore((state) => state.signIn)
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from

  return (auth: AuthResponse) => {
    signIn(portal, auth)
    navigate(from ?? HOME_PATH[portal], { replace: true })
  }
}
