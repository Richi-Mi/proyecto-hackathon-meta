import { motion, useInView } from 'motion/react'
import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { GOALS, PLAN_DAYS, PLAN_ROWS } from '../content'
import { EASE_OUT, revealProps } from '../motion-presets'
import { CountUp } from './animated'
import { SectionIntro } from './primitives'

/** Las barras crecen en orden; al terminar la tercera (31 oct) se traza la línea de "funciona de punta a punta". */
const BAR_START = 0.3
const BAR_GAP = 0.32
const BAR_DURATION = 0.45
const MILESTONE_ROW = 2
const LINE_START = BAR_START + MILESTONE_ROW * BAR_GAP + BAR_DURATION
const LINE_SEGMENT = 0.07

export function PlanSection() {
  const chartRef = useRef<HTMLDivElement>(null)
  const inView = useInView(chartRef, { once: true, amount: 0.35 })

  return (
    <section id="plan">
      <div className="sf-gutter mx-auto max-w-6xl py-20">
        <SectionIntro
          tag="Plan de 10 días"
          title="Funciona de punta a punta el 31 de octubre."
          lead="El MVP cabe en diez días porque no se entrena ningún modelo. Los últimos cuatro días van al tablero, a medir precisión y al video demo. Entrega: 4 de noviembre, 9:00 p.m. hora del Este."
        />

        <div ref={chartRef} className="mt-10 rounded-[14px] border border-(--sf-line) bg-(--sf-surface) p-5 md:p-7">
          <div className="flex gap-4">
            <div className="hidden w-60 shrink-0 md:block" />
            <div className="sf-mono sf-num grid flex-1 grid-cols-10 text-center text-[0.7rem] text-(--sf-muted)">
              {PLAN_DAYS.map(({ short, long }, index) => (
                <motion.span
                  key={long}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: inView ? 1 : 0 }}
                  transition={{ delay: index * 0.03, duration: 0.3 }}
                >
                  <span className="sm:hidden">{short}</span>
                  <span className="hidden sm:inline">{long}</span>
                </motion.span>
              ))}
            </div>
          </div>

          <div className="mt-3 divide-y divide-(--sf-line) border-t border-(--sf-line)">
            {PLAN_ROWS.map(({ label, dates, span, final }, index) => (
              <div key={label} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:gap-4">
                <p className={cn('text-sm md:w-60 md:shrink-0', final ? 'font-semibold' : 'font-medium')}>
                  {label} <span className="sf-mono text-xs text-(--sf-muted) md:hidden">· {dates}</span>
                </p>
                <div className="relative grid h-6 flex-1 grid-cols-10">
                  <motion.div
                    className={cn(span, final ? 'sf-bar-final' : 'sf-bar')}
                    style={{ originX: 0 }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: inView ? 1 : 0 }}
                    transition={{ delay: BAR_START + index * BAR_GAP, duration: BAR_DURATION, ease: EASE_OUT }}
                  />
                  <motion.span
                    className="sf-milestone"
                    style={{ originY: 0 }}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: inView ? 1 : 0 }}
                    transition={{ delay: LINE_START + index * LINE_SEGMENT, duration: LINE_SEGMENT, ease: 'linear' }}
                    aria-hidden
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-4 pt-3">
            <div className="hidden w-60 shrink-0 md:block" />
            <div className="relative h-5 flex-1">
              <motion.span
                className="sf-mono absolute left-[60%] -translate-x-1/2 text-xs font-semibold whitespace-nowrap"
                initial={{ opacity: 0 }}
                animate={{ opacity: inView ? 1 : 0 }}
                transition={{ delay: LINE_START + PLAN_ROWS.length * LINE_SEGMENT + 0.1, duration: 0.35 }}
              >
                funciona de punta a punta
              </motion.span>
            </div>
          </div>
        </div>

        <h3 className="sf-h3 mt-14">Metas</h3>
        <p className="mt-1 text-sm text-(--sf-muted)">
          Medidas con al menos 100 eventos grabados en un anaquel real de 10 a 15 productos.
        </p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {GOALS.map(({ prefix, value, suffix, text }, index) => (
            <motion.div
              key={text}
              {...revealProps(index)}
              className="rounded-[14px] border border-(--sf-line) bg-(--sf-surface) p-5"
            >
              <p className="sf-wide sf-num text-4xl">
                <CountUp prefix={prefix} value={value} suffix={suffix} />
              </p>
              <p className="mt-2 text-sm text-(--sf-muted)">{text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
