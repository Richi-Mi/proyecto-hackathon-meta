import { AnimatePresence, motion } from 'motion/react'
import { useLocation, useOutlet } from 'react-router'

/** Transición suave entre páginas hijas de un layout (respeta "reducir movimiento" vía MotionConfig). */
export function AnimatedOutlet({ className }: { className?: string }) {
  const location = useLocation()
  const outlet = useOutlet()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        className={className}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  )
}
