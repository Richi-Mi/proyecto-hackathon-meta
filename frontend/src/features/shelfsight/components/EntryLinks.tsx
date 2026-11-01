import { ArrowRight, LayoutDashboard, QrCode, Store } from 'lucide-react'
import { Link } from 'react-router'
import { HOME_PATH, LOGIN_PATH } from '@/app/paths'
import { useSession } from '@/features/auth/session-store'

const BASE = 'inline-flex items-center gap-2 rounded-[8px] px-3.5 py-2 text-sm font-semibold whitespace-nowrap'

/**
 * Accesos a la app desde la landing: cliente (PWA) y propietario (panel).
 * Con sesión activa llevan directo al pase o al panel, sin pasar por el login.
 */
export function EntryLinks() {
  const customer = Boolean(useSession('customer'))
  const owner = Boolean(useSession('admin'))

  return (
    <div className="flex items-center gap-2">
      <Link
        to={owner ? HOME_PATH.admin : LOGIN_PATH.admin}
        className={`${BASE} hidden border border-(--sf-hero-line) hover:border-(--sf-accent) sm:inline-flex`}
      >
        {owner ? <LayoutDashboard className="size-4" strokeWidth={1.75} aria-hidden /> : <Store className="size-4" strokeWidth={1.75} aria-hidden />}
        {owner ? 'Ir al panel' : 'Soy propietario'}
      </Link>
      <Link
        to={customer ? HOME_PATH.customer : '/app/register'}
        className={`${BASE} bg-(--sf-accent) text-(--sf-accent-ink) hover:brightness-95`}
      >
        {customer && <QrCode className="size-4" strokeWidth={1.75} aria-hidden />}
        {customer ? 'Ir a mi pase' : 'Crear mi cuenta'}
        {!customer && <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />}
      </Link>
    </div>
  )
}
