import { CupSoda, Milk, Popcorn, ShieldCheck, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { buildHero } from '../animations/hero'
import { useAnimeScope } from '../use-anime-scope'
import { OwnerCta, PrimaryCta } from './LandingCtas'

const CHIPS: { icon: LucideIcon; label: string; detail: string; className: string }[] = [
  { icon: CupSoda, label: 'Refresco 600 ml', detail: '$20.00', className: 'left-0 top-6 sm:-left-6' },
  { icon: Milk, label: 'Leche 1 L', detail: '$28.50', className: 'right-0 top-20 sm:-right-8' },
  { icon: Popcorn, label: 'Papas 45 g', detail: '$19.00', className: 'bottom-16 left-2 sm:-left-10' },
  { icon: ShieldCheck, label: 'QR válido', detail: 'Puerta abierta', className: 'bottom-4 right-4 sm:-right-4' },
]

export function Hero() {
  const rootRef = useAnimeScope<HTMLElement>(buildHero)

  return (
    <section ref={rootRef} className="relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-b from-primary/10 via-background to-background" />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-24">
        <div className="grid gap-6">
          <Badge variant="secondary" className="w-fit">
            Tienda inteligente · Compra sin filas
          </Badge>
          <h1 data-hero="title" className="font-heading text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">
            Entra, toma lo que necesitas y vete.
          </h1>
          <p data-hero="lead" className="max-w-xl text-lg text-pretty text-muted-foreground">
            Smart Abarrotes cobra solo: las cámaras saben qué te llevas y el pago se hace al salir. Y si prefieres pagar en
            mostrador, también.
          </p>
          <div data-hero="cta" className="flex flex-wrap items-center gap-3">
            <PrimaryCta />
            <OwnerCta />
          </div>
          <p data-hero="cta" className="text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{' '}
            <Link to="/app/login" className="font-medium text-primary underline-offset-4 hover:underline">
              Inicia sesión
            </Link>
          </p>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-sm">
          <div aria-hidden className="absolute inset-8 rounded-[3rem] bg-primary/10 blur-2xl" />
          <svg viewBox="0 0 512 512" className="relative size-full drop-shadow-xl" aria-hidden>
            <rect width="512" height="512" rx="112" className="fill-primary" />
            <g fill="none" className="stroke-white" strokeWidth="32" strokeLinecap="round" strokeLinejoin="round">
              <path data-hero="logo-stroke" d="M128 224h256l-28 146a32 32 0 0 1-31.4 26H187.4a32 32 0 0 1-31.4-26z" />
              <path data-hero="logo-stroke" d="M200 224l40-88M312 224l-40-88" />
              <path data-hero="logo-stroke" d="M216 288v48M296 288v48" />
            </g>
            <circle data-hero="logo-dot" cx="384" cy="136" r="30" className="origin-center fill-amber-400 [transform-box:fill-box]" />
          </svg>
          {CHIPS.map(({ icon: Icon, label, detail, className }) => (
            <div key={label} data-hero="chip" className={cn('absolute', className)}>
              <div
                data-hero="chip-float"
                className="flex items-center gap-2 rounded-2xl border bg-background/95 px-3 py-2 shadow-lg backdrop-blur"
              >
                <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                <span className="grid leading-tight">
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-xs text-muted-foreground">{detail}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
