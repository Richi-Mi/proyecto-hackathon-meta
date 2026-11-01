import { CircleCheck, ScanEye, Sparkles } from 'lucide-react'
import { ShelfFrame } from './ShelfArt'
import { SectionIntro } from './primitives'

const SAMPLE_RESPONSE = `{
  "accion": "salida",
  "producto": "Refresco cola 600 ml",
  "cantidad": 2,
  "anaquel": 3,
  "confianza": 0.94
}`

function Frame({ variant, time, count }: { variant: 'before' | 'after'; time: string; count: number }) {
  return (
    <figure className="min-w-0 rounded-[14px] border border-(--sf-line) bg-(--sf-bg) p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="sf-label text-(--sf-muted)">
          {variant === 'before' ? 'Antes' : 'Después'} · {time}
        </p>
        <p className="sf-mono sf-num text-sm">
          SAM 3.1 · “botella” → <strong>{count}</strong>
        </p>
      </div>
      <ShelfFrame variant={variant} />
    </figure>
  )
}

export function CameraSection() {
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

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <Frame variant="before" time="14:31:58" count={6} />
          <Frame variant="after" time="14:32:07" count={4} />
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-[1.1fr_1fr]">
          <div className="min-w-0 rounded-[14px] border border-(--sf-line) bg-(--sf-bg) p-5">
            <p className="sf-label flex items-center gap-2 text-(--sf-muted)">
              <Sparkles className="size-4" strokeWidth={1.75} aria-hidden />
              Muse Spark · respuesta de ejemplo
            </p>
            <div className="mt-3 overflow-x-auto rounded-[10px] bg-(--sf-surface-2)">
              <pre className="sf-mono p-4 text-[0.85rem] leading-relaxed">
                <code>{SAMPLE_RESPONSE}</code>
              </pre>
            </div>
          </div>

          <div className="flex min-w-0 flex-col justify-between gap-5 rounded-[14px] border border-(--sf-line) bg-(--sf-bg) p-5">
            <div>
              <p className="sf-label text-(--sf-muted)">Conciliación</p>
              <ul className="mt-3 grid gap-2.5">
                <li className="flex items-start gap-3">
                  <ScanEye className="mt-1 size-4 shrink-0 text-(--sf-muted)" strokeWidth={1.75} aria-hidden />
                  <span>
                    SAM 3.1 contó 6 → 4 y siguió la mano hacia afuera: <strong>−2, salida</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Sparkles className="mt-1 size-4 shrink-0 text-(--sf-muted)" strokeWidth={1.75} aria-hidden />
                  <span>
                    Muse Spark identificó <strong>2 refrescos cola de 600 ml</strong>.
                  </span>
                </li>
              </ul>
            </div>
            <p className="flex items-center gap-2 rounded-[10px] border border-(--sf-line) bg-(--sf-surface) px-4 py-3 font-semibold text-(--sf-entry)">
              <CircleCheck className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
              Coinciden: el inventario se actualiza solo.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
