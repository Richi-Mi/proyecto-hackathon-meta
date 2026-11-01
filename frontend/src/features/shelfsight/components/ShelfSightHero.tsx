import { ArrowDown, CircleCheck, ScanEye, Sparkles } from 'lucide-react'
import { motion } from 'motion/react'
import { NAV_LINKS, SOURCES } from '../content'
import { EASE_OUT } from '../motion-presets'
import { HeroShelf } from './ShelfArt'
import { EntryLinks } from './EntryLinks'
import { BrandMark, Tag } from './primitives'

export function ShelfSightHero() {
  return (
    <header className="bg-(--sf-hero-bg) text-(--sf-hero-ink) [--sf-tag-hole:var(--sf-hero-bg)]">
      <div className="sf-gutter mx-auto max-w-6xl">
        <nav className="flex items-center justify-between gap-4 py-5" aria-label="Secciones de ShelfSight">
          <a href="#inicio" aria-label="ShelfSight, inicio">
            <BrandMark />
          </a>
          <ul className="hidden items-center gap-6 text-[0.95rem] text-(--sf-hero-muted) xl:flex">
            {NAV_LINKS.map(({ href, label }) => (
              <li key={href}>
                <a className="transition-colors hover:text-(--sf-hero-ink)" href={href}>
                  {label}
                </a>
              </li>
            ))}
          </ul>
          <EntryLinks />
        </nav>

        <div id="inicio" className="grid items-center gap-12 pt-8 pb-20 md:grid-cols-[1fr_1.05fr] md:pt-12">
          <div className="min-w-0">
            <Tag>Meta Global AI Developer Hackathon 2026</Tag>
            <h1 className="sf-wide sf-h1 mt-6">Una cámara que sabe qué salió de tu anaquel.</h1>
            <p className="sf-lead mt-6 text-(--sf-hero-muted)">
              ShelfSight convierte una cámara común en un inventario automático para tienditas. Detecta cada producto
              que sale o se resurte y actualiza tus existencias sin códigos de barras, sin etiquetas y sin entrenar
              modelos.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#como-funciona"
                className="inline-flex items-center gap-2 rounded-[8px] bg-(--sf-accent) px-5 py-3 font-semibold text-(--sf-accent-ink) hover:brightness-95"
              >
                Ver cómo funciona
                <ArrowDown className="size-4" strokeWidth={1.75} aria-hidden />
              </a>
              <a
                href="#camara"
                className="inline-flex items-center gap-2 rounded-[8px] border border-(--sf-hero-line) px-5 py-3 font-semibold hover:border-(--sf-accent)"
              >
                <ScanEye className="size-4" strokeWidth={1.75} aria-hidden />
                Lo que ve la cámara
              </a>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-2 gap-6 border-t border-(--sf-hero-line) pt-6">
              <div>
                <dt className="sf-label text-(--sf-hero-muted)">Tienditas en México</dt>
                <dd className="sf-wide sf-num mt-1 text-3xl">1.05 M</dd>
              </div>
              <div>
                <dt className="sf-label text-(--sf-hero-muted)">Demanda que atienden</dt>
                <dd className="sf-wide sf-num mt-1 text-3xl">52%</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-(--sf-hero-muted)">
              Fuente:{' '}
              <a
                className="underline underline-offset-2 hover:text-(--sf-hero-ink)"
                href={SOURCES.milenio}
                target="_blank"
                rel="noreferrer"
              >
                Milenio, agosto 2024
              </a>
              , con datos de Bit by Teamcore.
            </p>
          </div>

          <figure className="min-w-0">
            <div className="relative overflow-hidden rounded-[18px] border border-(--sf-hero-line)">
              <HeroShelf />
              <div className="sf-scan" aria-hidden />
            </div>

            <motion.div
              className="sf-lift relative z-10 mx-3 mt-3 rounded-[12px] border border-(--sf-line) bg-(--sf-surface) p-4 text-(--sf-ink) sm:mr-5 sm:-mt-8 sm:ml-auto sm:w-[20rem]"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.6, duration: 0.5, ease: EASE_OUT }}
            >
              <p className="sf-label text-(--sf-muted)">Evento · 14:32 · anaquel 3</p>
              <p className="sf-wide mt-1.5 text-xl">
                <span className="text-(--sf-exit)">−2</span> Refresco cola 600 ml
              </p>
              <ul className="mt-3 grid gap-1.5 text-sm">
                <li className="flex items-center gap-2">
                  <ScanEye className="size-4 shrink-0 text-(--sf-muted)" strokeWidth={1.75} aria-hidden />
                  SAM 3.1: 6 → 4 piezas, salida
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="size-4 shrink-0 text-(--sf-muted)" strokeWidth={1.75} aria-hidden />
                  Muse Spark: refresco cola 600 ml ×2
                </li>
              </ul>
              <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-(--sf-entry)">
                <CircleCheck className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
                Inventario actualizado: quedan 4
              </p>
            </motion.div>
            <figcaption className="mt-4 text-xs text-(--sf-hero-muted)">
              Ilustración de ejemplo: así marca SAM 3.1 los productos que ve en un anaquel.
            </figcaption>
          </figure>
        </div>
      </div>
    </header>
  )
}
