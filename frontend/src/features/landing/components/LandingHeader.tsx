import { Link } from 'react-router'
import { LOGIN_PATH } from '@/app/paths'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { Button } from '@/components/ui/button'
import { PrimaryCta } from './LandingCtas'

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" aria-label="Smart Abarrotes, inicio">
          <BrandLogo />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex" aria-label="Secciones">
          <a href="#como-funciona" className="transition-colors hover:text-foreground">
            Cómo funciona
          </a>
          <a href="#mostrador" className="transition-colors hover:text-foreground">
            En mostrador
          </a>
          <a href="#para-tiendas" className="transition-colors hover:text-foreground">
            Para tiendas
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link to={LOGIN_PATH.admin}>Soy propietario</Link>
          </Button>
          <PrimaryCta size="default" />
        </div>
      </div>
    </header>
  )
}
