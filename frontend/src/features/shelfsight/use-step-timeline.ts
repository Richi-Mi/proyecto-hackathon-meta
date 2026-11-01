import { useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

/**
 * Avanza un contador de pasos según `schedule` (ms desde el inicio) mientras `active` sea true.
 * Con movimiento reducido devuelve directo el último paso, así la escena se ve completa sin animar.
 * `schedule` debe ser una constante del módulo para no reiniciar la secuencia en cada render.
 */
export function useStepTimeline(schedule: readonly number[], active: boolean) {
  const reduced = useReducedMotion() ?? false
  const [step, setStep] = useState(0)
  const [run, setRun] = useState(0)
  const last = schedule.length

  useEffect(() => {
    if (!active || reduced) return
    const timers = schedule.map((at, index) => window.setTimeout(() => setStep(index + 1), at))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [active, reduced, run, schedule])

  const replay = () => {
    setStep(0)
    setRun((value) => value + 1)
  }

  const current = reduced ? last : step
  return { step: current, run, replay, reduced, done: current >= last }
}
