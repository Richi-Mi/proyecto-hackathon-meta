import { cn } from '@/lib/utils'
import { GOALS, PLAN_DAYS, PLAN_ROWS } from '../content'
import { SectionIntro } from './primitives'

export function PlanSection() {
  return (
    <section id="plan">
      <div className="sf-gutter mx-auto max-w-6xl py-20">
        <SectionIntro
          tag="Plan de 10 días"
          title="Funciona de punta a punta el 31 de octubre."
          lead="El MVP cabe en diez días porque no se entrena ningún modelo. Los últimos cuatro días van al tablero, a medir precisión y al video demo. Entrega: 4 de noviembre, 9:00 p.m. hora del Este."
        />

        <div className="mt-10 rounded-[14px] border border-(--sf-line) bg-(--sf-surface) p-5 md:p-7">
          <div className="flex gap-4">
            <div className="hidden w-60 shrink-0 md:block" />
            <div className="sf-mono sf-num grid flex-1 grid-cols-10 text-center text-[0.7rem] text-(--sf-muted)">
              {PLAN_DAYS.map(({ short, long }) => (
                <span key={long}>
                  <span className="sm:hidden">{short}</span>
                  <span className="hidden sm:inline">{long}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="mt-3 divide-y divide-(--sf-line) border-t border-(--sf-line)">
            {PLAN_ROWS.map(({ label, dates, span, final }) => (
              <div key={label} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:gap-4">
                <p className={cn('text-sm md:w-60 md:shrink-0', final ? 'font-semibold' : 'font-medium')}>
                  {label} <span className="sf-mono text-xs text-(--sf-muted) md:hidden">· {dates}</span>
                </p>
                <div className="relative grid h-6 flex-1 grid-cols-10">
                  <div className={cn(span, final ? 'sf-bar-final' : 'sf-bar')} />
                  <span className="sf-milestone" aria-hidden />
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-4 pt-3">
            <div className="hidden w-60 shrink-0 md:block" />
            <div className="relative h-5 flex-1">
              <span className="sf-mono absolute left-[60%] -translate-x-1/2 text-xs font-semibold whitespace-nowrap">
                funciona de punta a punta
              </span>
            </div>
          </div>
        </div>

        <h3 className="sf-h3 mt-14">Metas</h3>
        <p className="mt-1 text-sm text-(--sf-muted)">
          Medidas con al menos 100 eventos grabados en un anaquel real de 10 a 15 productos.
        </p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {GOALS.map(({ value, text }) => (
            <div key={value} className="rounded-[14px] border border-(--sf-line) bg-(--sf-surface) p-5">
              <p className="sf-wide sf-num text-4xl">{value}</p>
              <p className="mt-2 text-sm text-(--sf-muted)">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
