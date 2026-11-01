import { ArrowRight, QrCode, Store } from 'lucide-react'
import { Link } from 'react-router'
import { HOME_PATH, LOGIN_PATH } from '@/app/paths'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-store'
import { cn } from '@/lib/utils'

/** CTA principal: si el cliente ya tiene sesión, lo lleva directo a su pase. */
export function PrimaryCta({ className, size = 'lg' }: { className?: string; size?: 'default' | 'lg' }) {
  const hasSession = Boolean(useSession('customer'))
  return (
    <Button asChild size={size} className={cn(size === 'lg' && 'h-12 px-6 text-base', className)}>
      <Link to={hasSession ? HOME_PATH.customer : '/app/register'}>
        {hasSession ? <QrCode /> : null}
        {hasSession ? 'Ir a mi pase' : 'Crear mi cuenta'}
        {!hasSession && <ArrowRight />}
      </Link>
    </Button>
  )
}

export function OwnerCta({ className, variant = 'outline' }: { className?: string; variant?: 'outline' | 'ghost' | 'secondary' }) {
  return (
    <Button asChild variant={variant} size="lg" className={cn('h-12 px-6 text-base', className)}>
      <Link to={LOGIN_PATH.admin}>
        <Store /> Soy propietario
      </Link>
    </Button>
  )
}
