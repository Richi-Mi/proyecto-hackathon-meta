import { Navigate, Outlet, useLocation } from 'react-router'
import { HOME_PATH, LOGIN_PATH } from '@/app/paths'
import { useSession, type Portal } from '../session-store'

/** Solo con sesión vigente del portal; si no, al login recordando a dónde quería ir. */
export function RequireSession({ portal }: { portal: Portal }) {
  const session = useSession(portal)
  const location = useLocation()
  if (!session) return <Navigate to={LOGIN_PATH[portal]} replace state={{ from: location.pathname }} />
  return <Outlet />
}

/** Login/registro: si ya hay sesión, directo al inicio del portal. */
export function GuestOnly({ portal }: { portal: Portal }) {
  const session = useSession(portal)
  if (session) return <Navigate to={HOME_PATH[portal]} replace />
  return <Outlet />
}
