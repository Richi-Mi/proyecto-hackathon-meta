import { Banknote, CreditCard, Landmark } from 'lucide-react'
import { buildPosDemo } from '../animations/pos-demo'
import { useAnimeScope } from '../use-anime-scope'

// Markup = estado final (ticket lleno y cobrado con tarjeta); la animación lo reconstruye en loop.
const ITEMS = [
  ['Huevo 12 piezas', '$42.00'],
  ['Pan de caja 680 g', '$52.00'],
  ['Tortilla 1 kg', '$22.00'],
] as const

const PAYMENTS = [
  { label: 'Efectivo', icon: Banknote },
  { label: 'Tarjeta', icon: CreditCard },
  { label: 'Transferencia', icon: Landmark },
]

const box = '[transform-box:fill-box]'

export function PosDemo() {
  const rootRef = useAnimeScope<HTMLElement>(buildPosDemo)

  return (
    <section id="mostrador" ref={rootRef} className="border-y bg-muted/40">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
        <div className="grid gap-4">
          <p className="text-sm font-semibold text-primary">¿Sin la app?</p>
          <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            También se cobra en mostrador.
          </h2>
          <p className="text-pretty text-muted-foreground">
            El propietario escanea códigos de barras o toca el catálogo rápido, el ticket se arma en tiempo real con IVA
            desglosado y se cobra en efectivo, tarjeta o transferencia. El inventario se descuenta igual que en el flujo
            automático.
          </p>
        </div>

        <div className="rounded-3xl border bg-card p-4 shadow-sm sm:p-6">
          <div className="grid gap-4 sm:grid-cols-[1fr_1.2fr]">
            <svg viewBox="0 0 180 180" className="mx-auto w-40 sm:w-full" aria-hidden>
              <g data-pos="product" className={box}>
                <rect x="30" y="40" width="120" height="100" rx="14" className="fill-chart-2" />
                <rect x="48" y="62" width="84" height="56" rx="6" className="fill-white" />
                {[0, 6, 10, 18, 22, 30, 36, 40, 48, 54, 60, 66, 70].map((x, i) => (
                  <rect key={x} x={56 + x} y="70" width={i % 3 === 0 ? 3 : 1.6} height="34" className="fill-foreground" />
                ))}
              </g>
              <rect data-pos="laser" x="40" y="88" width="100" height="3" rx="1.5" className={`${box} fill-red-500`} />
            </svg>

            <div className="grid content-between gap-4 rounded-2xl bg-muted/60 p-4">
              <ul className="grid gap-2 text-sm">
                {ITEMS.map(([name, price], i) => (
                  <li key={name} data-pos={`line-${i}`} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{name}</span>
                    <span className="font-medium tabular-nums">{price}</span>
                  </li>
                ))}
                <li data-pos="total" className="mt-1 flex justify-between border-t border-dashed pt-2 font-semibold">
                  <span>Total</span>
                  <span className="text-primary tabular-nums">$116.00</span>
                </li>
              </ul>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENTS.map(({ label, icon: Icon }, i) => (
                  <span
                    key={label}
                    data-pos={`pay-${i}`}
                    className={
                      i === 1
                        ? 'grid justify-items-center gap-1 rounded-xl bg-primary px-1 py-2 text-[11px] font-medium text-primary-foreground'
                        : 'grid justify-items-center gap-1 rounded-xl bg-background px-1 py-2 text-[11px] font-medium text-muted-foreground'
                    }
                  >
                    <Icon className="size-4" />
                    {label}
                  </span>
                ))}
              </div>
              <p data-pos="done" className="text-center text-sm font-medium text-primary">
                ✓ Cobrado · ticket listo para imprimir
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
