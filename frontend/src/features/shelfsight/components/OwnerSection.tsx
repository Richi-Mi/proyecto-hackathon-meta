import { motion, useInView } from 'motion/react'
import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { OWNER_FEATURES, SAMPLE_MOVES, SAMPLE_STOCK } from '../content'
import { EASE_OUT, revealProps } from '../motion-presets'
import { IconTile, Tag } from './primitives'

const MOVE_TONE = {
  exit: 'text-(--sf-exit)',
  entry: 'text-(--sf-entry)',
  review: 'text-(--sf-ink)',
} as const

function LowBadge() {
  return <span className="rounded-[4px] bg-(--sf-accent-soft) px-1.5 py-0.5 text-xs font-semibold">Bajo</span>
}

/** Vista previa de la app del dueño con datos de ejemplo. Los movimientos y el chat llegan en orden. */
function PhonePreview() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.5 })
  const arrive = (delay: number, x = 0) => ({
    initial: { opacity: 0, x, y: x ? 0 : 8 },
    animate: inView ? { opacity: 1, x: 0, y: 0 } : undefined,
    transition: { delay, duration: 0.4, ease: EASE_OUT },
  })

  return (
    <div
      ref={ref}
      className="sf-lift mx-auto w-full max-w-[330px] rounded-[30px] border border-(--sf-line) bg-(--sf-surface) p-3"
    >
      <div className="rounded-[22px] bg-(--sf-bg) p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="sf-wide text-lg">Mi tienda</p>
          <span className="sf-label rounded-[4px] bg-(--sf-surface-2) px-2 py-0.5 text-(--sf-muted)">Ejemplo</span>
        </div>
        <p className="sf-mono text-xs text-(--sf-muted)">Actualizado 14:32 · 1 cámara</p>

        <p className="sf-label mt-4 text-(--sf-muted)">Existencias</p>
        <ul className="mt-2 divide-y divide-(--sf-line) rounded-[12px] border border-(--sf-line) bg-(--sf-surface) text-sm">
          {SAMPLE_STOCK.map(({ name, qty, low }) => (
            <li key={name} className="flex items-center justify-between gap-2 px-3 py-2.5">
              <span className="min-w-0">{name}</span>
              <span className="flex items-center gap-2">
                {low && <LowBadge />}
                <span className="sf-num font-semibold">{qty}</span>
              </span>
            </li>
          ))}
        </ul>

        <p className="sf-label mt-4 text-(--sf-muted)">Movimientos</p>
        <ul className="sf-mono sf-num mt-2 grid gap-1.5 text-xs">
          {SAMPLE_MOVES.map(({ time, delta, kind, text }, index) => (
            <motion.li key={time} className="flex gap-2" {...arrive(0.2 + index * 0.18, -10)}>
              <span className="text-(--sf-muted)">{time}</span>
              <span className={cn('font-semibold', MOVE_TONE[kind])}>{delta}</span>
              <span className="min-w-0">{text}</span>
            </motion.li>
          ))}
        </ul>

        <div className="mt-4 grid gap-2 text-sm">
          <motion.p
            className="ml-8 rounded-[12px] rounded-br-[4px] bg-(--sf-accent-soft) px-3 py-2"
            {...arrive(0.9)}
          >
            ¿Cuántos refrescos de 600 me quedan?
          </motion.p>
          <motion.p
            className="mr-8 rounded-[12px] rounded-bl-[4px] bg-(--sf-surface-2) px-3 py-2"
            {...arrive(1.7)}
          >
            Te quedan 4 en el anaquel 3. Hoy salieron 8.
          </motion.p>
        </div>
      </div>
    </div>
  )
}

export function OwnerSection() {
  return (
    <section id="tablero" className="border-b border-(--sf-line)">
      <div className="sf-gutter mx-auto max-w-6xl py-20">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div className="order-2 min-w-0 md:order-1">
            <PhonePreview />
          </div>
          <div className="order-1 min-w-0 md:order-2">
            <Tag>Lo que ve el dueño</Tag>
            <h2 className="sf-wide sf-h2 mt-5">Existencias al día sin contar nada.</h2>
            <ul className="mt-8 grid gap-6">
              {OWNER_FEATURES.map(({ icon, title, text }, index) => (
                <motion.li key={title} className="flex gap-4" {...revealProps(index)}>
                  <IconTile icon={icon} />
                  <div className="min-w-0">
                    <h3 className="sf-h3">{title}</h3>
                    <p className="mt-1 text-(--sf-muted)">{text}</p>
                  </div>
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
