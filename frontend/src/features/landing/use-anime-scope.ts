import { createScope } from 'animejs'
import { useLayoutEffect, useRef } from 'react'

/**
 * Construye animaciones de Anime.js acotadas a un elemento raíz.
 * - Los selectores dentro de `build` solo buscan dentro de la raíz.
 * - Con "reducir movimiento" no se construye nada: el markup ya es el estado final.
 * - Al desmontar (o en el doble montaje de StrictMode) `revert()` deshace estilos y listeners.
 *
 * `build` debe ser estable (definida a nivel de módulo).
 */
export function useAnimeScope<T extends HTMLElement>(build: (root: T) => (() => void) | void) {
  const rootRef = useRef<T>(null)

  // Layout effect: los estados iniciales se aplican antes del primer pintado (sin parpadeo del cuadro final)
  useLayoutEffect(() => {
    const scope = createScope({
      root: rootRef,
      mediaQueries: { reduceMotion: '(prefers-reduced-motion: reduce)' },
    }).add((self) => {
      if (!rootRef.current || self?.matches.reduceMotion) return
      return build(rootRef.current) ?? undefined
    })
    return () => {
      scope.revert()
    }
  }, [build])

  return rootRef
}
