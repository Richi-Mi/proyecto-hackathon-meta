/** Ilustraciones del anaquel en SVG. Son escenas de ejemplo, no capturas reales. */
import { Hand } from 'lucide-react'
import { motion, useReducedMotion, type Variants } from 'motion/react'
import type { ReactNode } from 'react'
import { EASE_OUT } from '../motion-presets'

const color = (token: string) => ({ color: `var(${token})` })

/** Formas de producto reutilizadas con <use>. Se monta una sola vez por página. */
export function ShelfSymbols() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
      <defs>
        <symbol id="sf-bottle" viewBox="0 0 34 118">
          <rect x="10" y="0" width="14" height="8" rx="2" style={{ fill: 'var(--sf-cap)' }} />
          <path
            fill="currentColor"
            d="M11 8h12v10c0 6 9 8 9 16v76a8 8 0 0 1-8 8H10a8 8 0 0 1-8-8V34c0-8 9-10 9-16z"
          />
          <rect x="2" y="58" width="30" height="26" style={{ fill: 'var(--sf-prod-label)' }} />
          <rect x="6" y="38" width="4" height="16" rx="2" style={{ fill: 'var(--sf-prod-label)', opacity: 0.4 }} />
        </symbol>
        <symbol id="sf-can" viewBox="0 0 30 56">
          <rect x="2" y="0" width="26" height="6" rx="2" style={{ fill: 'var(--sf-metal)' }} />
          <rect x="0" y="4" width="30" height="52" rx="4" fill="currentColor" />
          <rect x="0" y="22" width="30" height="14" style={{ fill: 'var(--sf-prod-label)' }} />
        </symbol>
        <symbol id="sf-bag" viewBox="0 0 56 82">
          <path d="M3 8h50l-2 74H5z" fill="currentColor" />
          <path d="M1 0h54v9H1z" style={{ fill: 'var(--sf-crimp)' }} />
          <circle cx="28" cy="45" r="13" style={{ fill: 'var(--sf-prod-label)' }} />
        </symbol>
        <symbol id="sf-box" viewBox="0 0 60 110">
          <rect x="0" y="0" width="60" height="110" rx="3" fill="currentColor" />
          <rect x="8" y="14" width="44" height="40" rx="3" style={{ fill: 'var(--sf-prod-label)' }} />
          <rect x="8" y="64" width="30" height="6" rx="2" style={{ fill: 'var(--sf-prod-label)' }} />
        </symbol>
      </defs>
    </svg>
  )
}

/** Cada recuadro de detección aparece en orden, como si SAM 3.1 fuera encontrando productos. */
const detection: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  shown: (order: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: 0.35 + order * 0.22, duration: 0.35, ease: EASE_OUT },
  }),
}

function Detection({ order, children }: { order: number; children: ReactNode }) {
  return (
    <motion.g variants={detection} initial="hidden" animate="shown" custom={order}>
      {children}
    </motion.g>
  )
}

/** Anaquel completo visto por la cámara, con los recuadros de detección de SAM 3.1. */
export function HeroShelf() {
  const reduced = useReducedMotion()

  return (
    <svg
      viewBox="0 0 560 452"
      className="block h-auto w-full"
      role="img"
      aria-label="Ilustración de un anaquel visto por la cámara. SAM 3.1 marca refrescos, latas, papas y galletas, y señala dos refrescos que salieron del anaquel."
    >
      <rect x="0" y="0" width="560" height="452" className="sf-s-back" />
      <rect x="0" y="0" width="14" height="392" className="sf-s-upright" />
      <rect x="546" y="0" width="14" height="392" className="sf-s-upright" />
      <rect x="0" y="196" width="560" height="10" className="sf-s-board" />
      <rect x="0" y="380" width="560" height="12" className="sf-s-board" />
      <rect x="0" y="392" width="560" height="60" className="sf-s-floor" />

      {[36, 80, 124, 168].map((x) => (
        <use key={`b${x}`} href="#sf-bottle" x={x} y="78" width="34" height="118" style={color('--sf-p1')} />
      ))}
      {[318, 354, 390, 426, 462].map((x, i) => (
        <use
          key={`c${x}`}
          href="#sf-can"
          x={x}
          y="140"
          width="30"
          height="56"
          style={color(i % 2 ? '--sf-p3' : '--sf-p2')}
        />
      ))}
      {[36, 100, 164, 228].map((x, i) => (
        <use
          key={`g${x}`}
          href="#sf-bag"
          x={x}
          y="298"
          width="56"
          height="82"
          style={color(i % 2 ? '--sf-p1' : '--sf-p4')}
        />
      ))}
      {[320, 390, 460].map((x, i) => (
        <use
          key={`x${x}`}
          href="#sf-box"
          x={x}
          y="270"
          width="60"
          height="110"
          style={color(i === 1 ? '--sf-p2' : '--sf-p3')}
        />
      ))}

      <Detection order={0}>
        <rect x="30" y="72" width="176" height="130" rx="6" className="sf-det" />
        <rect x="30" y="52" width="176" height="18" rx="3" className="sf-det-chip" />
        <text x="36" y="65" className="sf-det-text">
          refresco 600 ml ×4 · 0.97
        </text>
      </Detection>

      <Detection order={1}>
        <rect x="312" y="134" width="186" height="68" rx="6" className="sf-det" />
        <rect x="312" y="114" width="154" height="18" rx="3" className="sf-det-chip" />
        <text x="318" y="127" className="sf-det-text">
          lata 355 ml ×5 · 0.95
        </text>
      </Detection>

      <Detection order={2}>
        <rect x="30" y="292" width="260" height="94" rx="6" className="sf-det" />
        <rect x="30" y="272" width="146" height="18" rx="3" className="sf-det-chip" />
        <text x="36" y="285" className="sf-det-text">
          papas 45 g ×4 · 0.93
        </text>
      </Detection>

      <Detection order={3}>
        <rect x="314" y="264" width="212" height="122" rx="6" className="sf-det" />
        <rect x="314" y="244" width="133" height="18" rx="3" className="sf-det-chip" />
        <text x="320" y="257" className="sf-det-text">
          galletas ×3 · 0.91
        </text>
      </Detection>

      {/* El hueco de los refrescos que salieron: el borde punteado avanza para marcar el movimiento */}
      <Detection order={4}>
        <motion.rect
          x="210"
          y="72"
          width="86"
          height="130"
          rx="6"
          className="sf-ghost"
          animate={reduced ? undefined : { strokeDashoffset: [0, -22] }}
          transition={{ duration: 1.2, ease: 'linear', repeat: Infinity }}
        />
        <rect x="210" y="52" width="76" height="18" rx="3" className="sf-ghost-chip" />
        <text x="216" y="65" className="sf-ghost-text">
          salida −2
        </text>
      </Detection>

      <circle cx="30" cy="27" r="4" className="sf-cam-rec sf-rec-blink" />
      <text x="40" y="31" className="sf-cam-text">
        CAM 01 · ANAQUEL 3
      </text>
      <text x="532" y="31" textAnchor="end" className="sf-cam-text">
        14:32:07
      </text>
      <path d="M12 44V12h32" className="sf-finder" />
      <path d="M516 12h32v32" className="sf-finder" />
      <path d="M12 408v32h32" className="sf-finder" />
      <path d="M548 408v32h-32" className="sf-finder" />
    </svg>
  )
}

const SLOTS = [20, 64, 108, 152, 196, 240] as const
/** Lugares que se vacían en el cuadro de "después". */
const TAKEN_FROM = 4

const reveal: Variants = {
  hidden: { opacity: 0, scale: 0.9, transition: { duration: 0.15 } },
  shown: { opacity: 1, scale: 1, transition: { duration: 0.28, ease: EASE_OUT } },
}

/** Las botellas suben y salen del cuadro; la mano las acompaña. */
const leaving: Variants = {
  rest: { y: 0, opacity: 1, transition: { duration: 0 } },
  gone: { y: [0, -6, -70], opacity: [1, 1, 0], transition: { duration: 1, times: [0, 0.35, 1], ease: 'easeIn' } },
}
const hand: Variants = {
  rest: { y: 12, opacity: 0, transition: { duration: 0 } },
  gone: { y: [12, 0, -6, -70], opacity: [0, 1, 1, 0], transition: { duration: 1, times: [0, 0.25, 0.45, 1] } },
}

export type FrameState = {
  /** Cuántas máscaras de SAM 3.1 se ven, de izquierda a derecha. */
  masks: number
  /** Las dos botellas de la derecha ya salieron del anaquel. */
  taken: boolean
  /** Los lugares vacíos ya están marcados como salida. */
  marked: boolean
}

/** Cuadro de antes o después de un evento: seis lugares para botella. */
export function ShelfFrame({ variant, masks, taken, marked }: { variant: 'before' | 'after' } & FrameState) {
  const label =
    variant === 'before'
      ? 'Cuadro de antes: seis botellas de refresco, cada una con su máscara de SAM 3.1.'
      : 'Cuadro de después: quedan cuatro botellas con máscara y dos lugares vacíos marcados como salida.'

  return (
    <svg viewBox="0 0 300 170" className="mt-3 block h-auto w-full rounded-[10px]" role="img" aria-label={label}>
      <rect x="0" y="0" width="300" height="170" className="sf-s-back" />
      <rect x="0" y="150" width="300" height="12" className="sf-s-board" />
      <rect x="0" y="162" width="300" height="8" className="sf-s-floor" />

      {SLOTS.map((x, i) => {
        const leaves = variant === 'after' && i >= TAKEN_FROM
        const masked = i < masks && !leaves
        const bottle = <use href="#sf-bottle" x={x} y="32" width="34" height="118" style={color('--sf-p1')} />

        return (
          <g key={x}>
            {leaves ? (
              <motion.g variants={leaving} initial={false} animate={taken ? 'gone' : 'rest'}>
                {bottle}
              </motion.g>
            ) : (
              bottle
            )}

            <motion.rect
              x={x - 3}
              y="29"
              width="40"
              height="124"
              rx="6"
              className="sf-mask"
              variants={reveal}
              initial={false}
              animate={masked ? 'shown' : 'hidden'}
            />
            <motion.g variants={reveal} initial={false} animate={masked ? 'shown' : 'hidden'}>
              <rect x={x + 8} y="8" width="18" height="16" rx="3" className="sf-det-chip" />
              <text x={x + 17} y="20" textAnchor="middle" className="sf-det-text">
                {i + 1}
              </text>
            </motion.g>

            {leaves && (
              <>
                <motion.rect
                  x={x - 3}
                  y="29"
                  width="40"
                  height="124"
                  rx="6"
                  className="sf-ghost"
                  variants={reveal}
                  initial={false}
                  animate={marked ? 'shown' : 'hidden'}
                />
                <motion.g variants={reveal} initial={false} animate={marked ? 'shown' : 'hidden'}>
                  <rect x={x + 2} y="8" width="30" height="16" rx="3" className="sf-ghost-chip" />
                  <text x={x + 17} y="20" textAnchor="middle" className="sf-ghost-text">
                    −1
                  </text>
                </motion.g>
              </>
            )}
          </g>
        )
      })}

      {variant === 'after' && (
        <motion.g variants={hand} initial={false} animate={taken ? 'gone' : 'rest'} aria-hidden>
          <Hand x={219} y={60} size={36} strokeWidth={1.75} className="text-(--sf-cap)" />
        </motion.g>
      )}
    </svg>
  )
}
