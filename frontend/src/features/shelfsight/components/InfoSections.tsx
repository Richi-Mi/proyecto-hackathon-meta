import { CircleCheck, Hand, Smartphone } from 'lucide-react'
import { MODELS, PIPELINE_STEPS, PRIVACY, PROBLEMS, SUPPORT_TOOLS } from '../content'
import { IconTile, SectionIntro, Tag } from './primitives'

const card = 'rounded-[14px] border border-(--sf-line) bg-(--sf-surface)'

export function ProblemSection() {
  return (
    <section id="problema" className="border-b border-(--sf-line)">
      <div className="sf-gutter mx-auto max-w-6xl py-20">
        <SectionIntro
          tag="El problema"
          title="En una tiendita, el inventario se cuenta a mano."
          lead="Las tienditas atienden a medio país, pero casi ninguna sabe en este momento cuántas piezas le quedan de cada producto."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PROBLEMS.map(({ icon, title, text }) => (
            <article key={title} className={`${card} p-6`}>
              <IconTile icon={icon} />
              <h3 className="sf-h3 mt-5">{title}</h3>
              <p className="mt-2 text-(--sf-muted)">{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export function PipelineSection() {
  return (
    <section id="como-funciona" className="border-b border-(--sf-line)">
      <div className="sf-gutter mx-auto max-w-6xl py-20">
        <SectionIntro tag="Cómo funciona" title="De la cámara al inventario en seis pasos." />

        <div className={`${card} mt-8 flex flex-col gap-4 p-5 sm:flex-row sm:items-center`}>
          <IconTile icon={Smartphone} accent />
          <p className="min-w-0">
            <strong>Configuración en minutos.</strong> Tomas una foto de cada anaquel. Muse Spark arma el catálogo y
            SAM 3.1 cuenta las piezas iniciales; tú solo confirmas nombres y precios.
          </p>
        </div>

        <ol className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PIPELINE_STEPS.map(({ icon, title, text }, index) => (
            <li key={title} className={`${card} p-6`}>
              <div className="flex items-center justify-between">
                <IconTile icon={icon} />
                <span className="sf-mono sf-num text-sm text-(--sf-muted)">{index + 1}</span>
              </div>
              <h3 className="sf-h3 mt-5">{title}</h3>
              <p className="mt-2 text-(--sf-muted)">{text}</p>
            </li>
          ))}
        </ol>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div className={`${card} flex gap-4 p-6`}>
            <CircleCheck className="mt-0.5 size-6 shrink-0 text-(--sf-entry)" strokeWidth={1.75} aria-hidden />
            <div className="min-w-0">
              <h3 className="sf-h3">Si coinciden</h3>
              <p className="mt-1 text-(--sf-muted)">El inventario se actualiza solo y el movimiento queda en el historial.</p>
            </div>
          </div>
          <div className={`${card} flex gap-4 p-6`}>
            <Hand className="mt-0.5 size-6 shrink-0 text-(--sf-exit)" strokeWidth={1.75} aria-hidden />
            <div className="min-w-0">
              <h3 className="sf-h3">Si no coinciden o hay duda</h3>
              <p className="mt-1 text-(--sf-muted)">
                El evento pasa a una cola de revisión. El dueño lo confirma con un toque y la corrección se agrega al
                catálogo como foto de referencia.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function ModelsSection() {
  return (
    <section
      id="modelos"
      className="border-b border-(--sf-line) bg-(--sf-surface) [--sf-tag-hole:var(--sf-surface)]"
    >
      <div className="sf-gutter mx-auto max-w-6xl py-20">
        <SectionIntro
          tag="Modelos de Meta"
          title="Dos modelos que se revisan entre sí."
          lead="SAM 3.1 responde cuántos y hacia dónde. Muse Spark responde qué producto. El inventario solo cambia cuando ambos coinciden."
        />

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {MODELS.map(({ icon, name, role, points }) => (
            <article key={name} className="rounded-[14px] border border-(--sf-line) bg-(--sf-bg) p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <IconTile icon={icon} accent />
                <span className="sf-label rounded-[4px] border border-(--sf-line) px-2 py-1 text-(--sf-muted)">
                  Meta Model API
                </span>
              </div>
              <h3 className="sf-wide mt-6 text-2xl">{name}</h3>
              <p className="mt-1 font-semibold">{role}</p>
              <ul className="mt-4 grid gap-2 text-(--sf-muted)">
                {points.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex gap-2.5">
                    <Icon className="mt-1 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {SUPPORT_TOOLS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-4 rounded-[14px] border border-(--sf-line) bg-(--sf-bg) p-6">
              <Icon className="mt-0.5 size-6 shrink-0 text-(--sf-muted)" strokeWidth={1.75} aria-hidden />
              <div className="min-w-0">
                <h3 className="sf-h3">{title}</h3>
                <p className="mt-1 text-(--sf-muted)">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function PrivacySection() {
  return (
    <section
      id="privacidad"
      className="border-b border-(--sf-line) bg-(--sf-surface-2) [--sf-tag-hole:var(--sf-surface-2)]"
    >
      <div className="sf-gutter mx-auto max-w-6xl py-16">
        <div className="grid gap-10 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)] md:items-center">
          <div className="min-w-0">
            <Tag>Privacidad</Tag>
            <h2 className="sf-wide sf-h2 mt-5">Cuenta productos, no personas.</h2>
          </div>
          <ul className="grid min-w-0 gap-5 sm:grid-cols-3">
            {PRIVACY.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-[14px] bg-(--sf-bg) p-5">
                <Icon className="size-6" strokeWidth={1.75} aria-hidden />
                <p className="mt-3 font-semibold">{title}</p>
                <p className="mt-1 text-sm text-(--sf-muted)">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
