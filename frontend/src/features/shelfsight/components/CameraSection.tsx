import { CircleCheck, RotateCcw, ScanEye, Sparkles } from 'lucide-react'
import { motion, useInView, type Variants } from 'motion/react'
import { useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { EASE_OUT } from '../motion-presets'
import { useStepTimeline } from '../use-step-timeline'
import { TypedCode } from './animated'
import { ShelfFrame, type FrameState } from './ShelfArt'
import { SectionIntro } from './primitives'

const SAMPLE_RESPONSE = `{
  "accion": "salida",
  "producto": "Refresco cola 600 ml",
  "cantidad": 2,
  "anaquel": 3,
  "confianza": 0.94
}`

/**
 * Momento (ms) en que entra cada paso del evento:
 * 1–6 SAM 3.1 marca cada botella del cuadro de antes · 7 la mano saca dos botellas ·
 * 8 SAM 3.1 vuelve a contar · 9 Muse Spark responde · 10–11 conciliación · 12 inventario actualizado.
 */
const SCHEDULE = [200, 420, 640, 860, 1080, 1300, 1900, 2800, 3300, 4900, 5400, 6000] as const
const STEP = { counted: 6, taken: 7, recounted: 8, answer: 9, samCheck: 10, museCheck: 11, verdict: 12 } as const

function statusFor(step: number) {
  if (step === 0) return 'Esperando movimiento en el anaquel 3'
  if (step <= STEP.counted) return 'SAM 3.1 cuenta las botellas'
  if (step === STEP.taken) return 'Mano en el anaquel 3'
  if (step === STEP.recounted) return 'SAM 3.1 vuelve a contar'
  if (step === STEP.answer) return 'Muse Spark identifica el producto'
  if (step < STEP.verdict) return 'Conciliando las dos señales'
  return 'Inventario actualizado: quedan 4'
}

const appear: Variants = {
  hidden: { opacity: 0, x: -8, transition: { duration: 0.15 } },
  shown: { opacity: 1, x: 0, transition: { duration: 0.35, ease: EASE_OUT } },
}
const pop: Variants = {
  hidden: { opacity: 0, scale: 0.96, transition: { duration: 0.15 } },
  shown: { opacity: 1, scale: [0.96, 1.03, 1], transition: { duration: 0.45, ease: EASE_OUT } },
}

function Frame({ variant, time, count, state }: { variant: 'before' | 'after'; time: string; count: ReactNode; state: FrameState }) {
  return (
    <figure className="min-w-0 rounded-[14px] border border-(--sf-line) bg-(--sf-bg) p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="sf-label text-(--sf-muted)">
          {variant === 'before' ? 'Antes' : 'Después'} · {time}
        </p>
        <p className="sf-mono sf-num text-sm">
          SAM 3.1 · “botella” →{' '}
          <motion.strong
            key={String(count)}
            className="inline-block min-w-[1ch]"
            initial={{ opacity: 0.2, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {count}
          </motion.strong>
        </p>
      </div>
      <ShelfFrame variant={variant} {...state} />
    </figure>
  )
}

export function CameraSection() {
  const stageRef = useRef<HTMLDivElement>(null)
  const inView = useInView(stageRef, { once: true, amount: 0.45 })
  const { step, run, replay, reduced, done } = useStepTimeline(SCHEDULE, inView)

  const beforeCount = Math.min(step, STEP.counted)
  const recounted = step >= STEP.recounted
  const running = step > 0 && !done

  return (
    <section
      id="camara"
      className="border-b border-(--sf-line) bg-(--sf-surface) [--sf-tag-hole:var(--sf-surface)]"
    >
      <div className="sf-gutter mx-auto max-w-6xl py-20">
        <SectionIntro
          tag="Lo que ve la cámara"
          title="SAM 3.1 cuenta las piezas y Muse Spark dice cuáles son."
          lead="Cada vez que una mano entra al anaquel, el sistema compara un cuadro de antes y uno de después. Si las dos señales coinciden, el inventario cambia solo."
        />

        <div ref={stageRef}>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
            <p className="flex min-w-0 items-center gap-2.5 text-sm font-medium">
              {done ? (
                <CircleCheck className="size-4 shrink-0 text-(--sf-entry)" strokeWidth={2} aria-hidden />
              ) : (
                <span
                  className={cn('size-2.5 shrink-0 rounded-full bg-(--sf-accent)', running && 'sf-pulse')}
                  aria-hidden
                />
              )}
              <motion.span
                key={statusFor(step)}
                className={cn('sf-mono', done && 'text-(--sf-entry)')}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                {statusFor(step)}
              </motion.span>
            </p>
            {!reduced && (
              <button
                type="button"
                onClick={replay}
                className="inline-flex items-center gap-2 rounded-[8px] border border-(--sf-line) px-3 py-1.5 text-sm font-semibold hover:border-(--sf-accent)"
              >
                <RotateCcw className="size-4" strokeWidth={1.75} aria-hidden />
                Repetir
              </button>
            )}
          </div>

          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <Frame
              variant="before"
              time="14:31:58"
              count={beforeCount}
              state={{ masks: beforeCount, taken: false, marked: false }}
            />
            <Frame
              variant="after"
              time="14:32:07"
              count={recounted ? 4 : '…'}
              state={{ masks: recounted ? 4 : 0, taken: step >= STEP.taken, marked: recounted }}
            />
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-[1.1fr_1fr]">
            <div className="min-w-0 rounded-[14px] border border-(--sf-line) bg-(--sf-bg) p-5">
              <p className="sf-label flex items-center gap-2 text-(--sf-muted)">
                <Sparkles className="size-4" strokeWidth={1.75} aria-hidden />
                Muse Spark · respuesta de ejemplo
              </p>
              <div className="mt-3 overflow-x-auto rounded-[10px] bg-(--sf-surface-2)">
                <pre className="sf-mono p-4 text-[0.85rem] leading-relaxed">
                  <TypedCode key={run} text={SAMPLE_RESPONSE} play={step >= STEP.answer} instant={reduced} />
                </pre>
              </div>
            </div>

            <div className="flex min-w-0 flex-col justify-between gap-5 rounded-[14px] border border-(--sf-line) bg-(--sf-bg) p-5">
              <div>
                <p className="sf-label text-(--sf-muted)">Conciliación</p>
                <ul className="mt-3 grid gap-2.5">
                  <motion.li
                    className="flex items-start gap-3"
                    variants={appear}
                    initial={false}
                    animate={step >= STEP.samCheck ? 'shown' : 'hidden'}
                  >
                    <ScanEye className="mt-1 size-4 shrink-0 text-(--sf-muted)" strokeWidth={1.75} aria-hidden />
                    <span>
                      SAM 3.1 contó 6 → 4 y siguió la mano hacia afuera: <strong>−2, salida</strong>.
                    </span>
                  </motion.li>
                  <motion.li
                    className="flex items-start gap-3"
                    variants={appear}
                    initial={false}
                    animate={step >= STEP.museCheck ? 'shown' : 'hidden'}
                  >
                    <Sparkles className="mt-1 size-4 shrink-0 text-(--sf-muted)" strokeWidth={1.75} aria-hidden />
                    <span>
                      Muse Spark identificó <strong>2 refrescos cola de 600 ml</strong>.
                    </span>
                  </motion.li>
                </ul>
              </div>
              <motion.p
                className="flex items-center gap-2 rounded-[10px] border border-(--sf-line) bg-(--sf-surface) px-4 py-3 font-semibold text-(--sf-entry)"
                variants={pop}
                initial={false}
                animate={step >= STEP.verdict ? 'shown' : 'hidden'}
              >
                <CircleCheck className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
                Coinciden: el inventario se actualiza solo.
              </motion.p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
