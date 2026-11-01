import { useEffect } from 'react'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { Hero } from './components/Hero'
import { OwnerCta, PrimaryCta } from './components/LandingCtas'
import { LandingHeader } from './components/LandingHeader'
import { OwnerFeatures } from './components/OwnerFeatures'
import { PosDemo } from './components/PosDemo'
import { StorySection } from './components/StorySection'

const CURRENT_YEAR = new Date().getFullYear()

export function LandingPage() {
  useEffect(() => {
    document.title = 'Smart Abarrotes · Compra sin filas'
  }, [])

  return (
    <div className="min-h-dvh bg-background">
      <LandingHeader />
      <main>
        <Hero />
        <StorySection />
        <PosDemo />
        <OwnerFeatures />

        <section className="px-4 pb-20 sm:px-6">
          <div className="mx-auto grid max-w-6xl justify-items-center gap-6 rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground">
            <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Tu próxima compra, sin fila.
            </h2>
            <p className="max-w-xl text-primary-foreground/80">
              Crea tu cuenta en un minuto e instala la app en tu teléfono para tener tu pase siempre a la mano.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <PrimaryCta className="bg-background text-foreground hover:bg-background/90" />
              <OwnerCta
                variant="ghost"
                className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              />
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <BrandLogo />
          <span>© {CURRENT_YEAR} Smart Abarrotes</span>
        </div>
      </footer>
    </div>
  )
}
