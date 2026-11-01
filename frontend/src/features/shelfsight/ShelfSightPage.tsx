import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-600.css'
import './shelfsight.css'
import { useEffect } from 'react'
import { CameraSection } from './components/CameraSection'
import { ModelsSection, PipelineSection, PrivacySection, ProblemSection } from './components/InfoSections'
import { OwnerSection } from './components/OwnerSection'
import { PlanSection } from './components/PlanSection'
import { BrandMark } from './components/primitives'
import { ShelfSymbols } from './components/ShelfArt'
import { ShelfSightHero } from './components/ShelfSightHero'
import { SOURCES } from './content'

const FOOTER_SOURCES = [
  { href: SOURCES.hackathon, label: 'Página del hackathon' },
  { href: SOURCES.metaModels, label: 'Meta Model API: modelos' },
  { href: SOURCES.milenio, label: 'Milenio: tiendas de abarrotes en México' },
] as const

/** Landing del proyecto ShelfSight para el Meta Global AI Developer Hackathon 2026. */
export function ShelfSightPage() {
  useEffect(() => {
    const previous = document.title
    document.title = 'ShelfSight · Inventario automático con cámaras'
    return () => {
      document.title = previous
    }
  }, [])

  return (
    <div className="sf min-h-dvh">
      <ShelfSymbols />
      <ShelfSightHero />
      <main>
        <ProblemSection />
        <CameraSection />
        <PipelineSection />
        <ModelsSection />
        <OwnerSection />
        <PrivacySection />
        <PlanSection />
      </main>

      <footer className="bg-(--sf-hero-bg) text-(--sf-hero-ink)">
        <div className="sf-gutter mx-auto max-w-6xl py-12">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div className="max-w-md min-w-0">
              <BrandMark />
              <p className="mt-4 text-sm text-(--sf-hero-muted)">
                Proyecto de José Ricardo Mendoza Castañeda, ESCOM, Instituto Politécnico Nacional, para el Meta Global
                AI Developer Hackathon 2026 (26 oct – 4 nov). Track Indie developer, tema Build for Your World.
              </p>
              <p className="mt-3 text-xs text-(--sf-hero-muted)">Las ilustraciones son escenas de ejemplo, no capturas reales.</p>
            </div>
            <div className="min-w-0">
              <p className="sf-label text-(--sf-hero-muted)">Fuentes</p>
              <ul className="mt-3 grid gap-2 text-sm">
                {FOOTER_SOURCES.map(({ href, label }) => (
                  <li key={href}>
                    <a
                      className="underline underline-offset-2 hover:text-(--sf-accent)"
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
