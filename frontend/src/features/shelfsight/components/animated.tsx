import { animate, useInView, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { EASE_OUT } from '../motion-presets'

/** Cuenta de 0 al valor cuando entra en pantalla. El valor final queda disponible para lectores de pantalla. */
export function CountUp({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (!inView || reduced) return
    const controls = animate(0, value, {
      duration: 1.1,
      ease: EASE_OUT,
      onUpdate: (latest) => setShown(Math.round(latest)),
    })
    return () => controls.stop()
  }, [inView, reduced, value])

  return (
    <>
      <span ref={ref} aria-hidden>
        {prefix}
        {reduced ? value : shown}
        {suffix}
      </span>
      <span className="sr-only">
        {prefix}
        {value}
        {suffix}
      </span>
    </>
  )
}

const TYPE_MS = 1300

/**
 * Escribe `text` carácter por carácter cuando `play` es true. El resto del texto ocupa su lugar sin verse,
 * así el bloque no cambia de tamaño. Remontar con otra `key` reinicia la escritura.
 */
export function TypedCode({ text, play, instant }: { text: string; play: boolean; instant: boolean }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!play || instant) return
    const started = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const next = Math.min(text.length, Math.round(((now - started) / TYPE_MS) * text.length))
      setCount(next)
      if (next < text.length) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [play, instant, text])

  const shown = instant ? text.length : play ? count : 0
  const typing = play && shown < text.length

  return (
    <code>
      {text.slice(0, shown)}
      {typing && <span className="sf-caret" aria-hidden />}
      <span className="opacity-0">{text.slice(shown)}</span>
    </code>
  )
}
