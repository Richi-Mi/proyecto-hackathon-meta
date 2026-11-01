/** Curva compartida por las animaciones de la landing: arranca rápido y frena suave. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const

/** Entrada al hacer scroll para tarjetas en lista; `index` escalona la aparición. */
export const revealProps = (index = 0) =>
  ({
    initial: { opacity: 0, y: 16 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-80px' },
    transition: { duration: 0.45, delay: index * 0.07, ease: EASE_OUT },
  }) as const
