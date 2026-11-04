/**
 * Detector de interacciones con la repisa, sin dependencias: compara cuadros chicos en escala de grises.
 *
 *   QUIETO ──(movimiento)──▶ MOVIMIENTO ──(quieto ~1.5 s)──▶ ¿la repisa cambió respecto a "antes"?
 *     ▲                                                          │ sí → evento (foto antes + foto después)
 *     └──────────────────────────────────────────────────────────┘ no → se descarta (solo pasó una mano)
 *
 * La foto "antes" es la última imagen estable antes del movimiento, así que la mano nunca sale en ella.
 */

export const SAMPLE_WIDTH = 64
export const SAMPLE_HEIGHT = 48

export interface MotionSettings {
  /** Diferencia mínima de brillo (0–255) para contar un píxel como cambiado */
  pixelThreshold: number
  /** Fracción de píxeles que cambian entre dos cuadros seguidos para decir "hay movimiento" */
  motionRatio: number
  /** Fracción de píxeles distintos entre antes y después para considerar que la repisa cambió */
  changeRatio: number
  /** Tiempo sin movimiento para dar la interacción por terminada */
  settleMs: number
  /** Una interacción más larga que esto se reinicia (alguien se quedó parado enfrente) */
  maxActiveMs: number
}

export const DEFAULT_MOTION_SETTINGS: MotionSettings = {
  pixelThreshold: 28,
  motionRatio: 0.015,
  changeRatio: 0.008,
  settleMs: 1500,
  maxActiveMs: 25_000,
}

export type MotionPhase = 'idle' | 'active'

export interface Snapshot<T> {
  gray: Uint8Array
  /** Foto completa, la que se manda al servidor */
  frame: T
}

export type MotionResult<T> =
  | { kind: 'none' }
  | { kind: 'started' }
  | { kind: 'discarded'; change: number }
  | { kind: 'event'; before: T; after: T; change: number }

/** Fracción de píxeles cuyo brillo cambió más que `threshold`. */
export function diffRatio(a: Uint8Array, b: Uint8Array, threshold: number): number {
  let changed = 0
  for (let index = 0; index < a.length; index++) {
    if (Math.abs(a[index]! - b[index]!) > threshold) changed++
  }
  return changed / a.length
}

/** RGBA → escala de grises (luma aproximada). */
export function toGray(rgba: Uint8ClampedArray): Uint8Array {
  const gray = new Uint8Array(rgba.length / 4)
  for (let index = 0; index < gray.length; index++) {
    const offset = index * 4
    gray[index] = (rgba[offset]! * 77 + rgba[offset + 1]! * 150 + rgba[offset + 2]! * 29) >> 8
  }
  return gray
}

export class MotionDetector<T> {
  phase: MotionPhase = 'idle'
  private baseline: Snapshot<T> | null = null
  private previous: Uint8Array | null = null
  private activeSince = 0
  private lastMotionAt = 0

  settings: MotionSettings

  constructor(settings: MotionSettings = DEFAULT_MOTION_SETTINGS) {
    this.settings = settings
  }

  reset() {
    this.phase = 'idle'
    this.baseline = null
    this.previous = null
  }

  /**
   * Procesa un cuadro. `capture` solo se llama cuando hace falta la foto completa
   * (nueva línea base o foto "después"), para no codificar JPEG en cada cuadro.
   */
  push(gray: Uint8Array, now: number, capture: () => T): MotionResult<T> {
    const previous = this.previous
    this.previous = gray
    if (!previous) {
      this.baseline = { gray, frame: capture() }
      return { kind: 'none' }
    }
    const moving = diffRatio(gray, previous, this.settings.pixelThreshold) > this.settings.motionRatio

    if (this.phase === 'idle') {
      if (moving) {
        this.phase = 'active'
        this.activeSince = now
        this.lastMotionAt = now
        return { kind: 'started' }
      }
      // Repisa quieta: se actualiza "antes" si cambió poco a poco (luz del día, enfoque)
      if (this.baseline && diffRatio(gray, this.baseline.gray, this.settings.pixelThreshold) > this.settings.changeRatio / 2) {
        this.baseline = { gray, frame: capture() }
      }
      return { kind: 'none' }
    }

    if (moving) this.lastMotionAt = now
    if (now - this.activeSince > this.settings.maxActiveMs) {
      this.phase = 'idle'
      this.baseline = { gray, frame: capture() }
      return { kind: 'discarded', change: 0 }
    }
    if (now - this.lastMotionAt < this.settings.settleMs) return { kind: 'none' }

    // Terminó la interacción: ¿la repisa quedó distinta?
    this.phase = 'idle'
    const before = this.baseline
    const after = { gray, frame: capture() }
    this.baseline = after
    if (!before) return { kind: 'discarded', change: 0 }
    const change = diffRatio(gray, before.gray, this.settings.pixelThreshold)
    if (change < this.settings.changeRatio) return { kind: 'discarded', change }
    return { kind: 'event', before: before.frame, after: after.frame, change }
  }
}
