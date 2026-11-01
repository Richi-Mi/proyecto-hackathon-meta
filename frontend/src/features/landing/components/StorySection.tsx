import { useReducedMotion } from 'motion/react'
import { buildStoreStory } from '../animations/store-story'
import { STORY_STEPS } from '../story-steps'
import { useAnimeScope } from '../use-anime-scope'
import { StoreScene } from './StoreScene'

/**
 * "Cómo funciona": la sección mide 400vh y su contenido queda fijo (sticky) mientras
 * el scroll avanza la línea de tiempo de la escena y los 4 pasos.
 * Con "reducir movimiento" se muestra la escena final y los pasos como lista.
 */
export function StorySection() {
  const reduceMotion = useReducedMotion()
  const rootRef = useAnimeScope<HTMLElement>(buildStoreStory)

  const heading = (
    <div className="grid gap-2">
      <p className="text-sm font-semibold text-primary">Cómo funciona</p>
      <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        De la puerta a tu ticket, sin cajas.
      </h2>
    </div>
  )

  if (reduceMotion) {
    return (
      <section id="como-funciona" className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6">
        {heading}
        <StoreScene className="mx-auto max-w-3xl" />
        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STORY_STEPS.map((item, index) => (
            <li key={item.title} className="grid gap-1.5">
              <span className="text-sm font-semibold text-primary">Paso {index + 1}</span>
              <h3 className="font-heading text-lg font-semibold">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.text}</p>
            </li>
          ))}
        </ol>
      </section>
    )
  }

  return (
    <section id="como-funciona" ref={rootRef} className="relative h-[400vh]">
      <div className="sticky top-16 mx-auto flex h-[calc(100dvh-4rem)] max-w-6xl flex-col justify-center gap-6 px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[1.5fr_1fr] lg:items-center lg:gap-12">
        <div className="grid gap-4 lg:order-2">
          {heading}
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div data-story-progress className="h-full origin-left rounded-full bg-primary" />
          </div>
          {/* Pasos superpuestos: la línea de tiempo cruza su opacidad */}
          <ol className="grid">
            {STORY_STEPS.map((item, index) => (
              <li key={item.title} data-story-step={index} className="col-start-1 row-start-1 grid content-start gap-1.5">
                <span className="text-sm font-semibold text-primary">
                  Paso {index + 1} de {STORY_STEPS.length}
                </span>
                <h3 className="font-heading text-2xl font-semibold">{item.title}</h3>
                <p className="text-pretty text-muted-foreground">{item.text}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="min-h-0 lg:order-1">
          <StoreScene className="mx-auto max-h-[52dvh] lg:max-h-[75dvh]" />
        </div>
      </div>
    </section>
  )
}
