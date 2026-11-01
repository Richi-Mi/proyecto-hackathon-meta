import { motion } from 'motion/react'
import { Outlet } from 'react-router'
import { BrandLogo } from '@/components/brand/BrandLogo'

/**
 * Pantallas de acceso.
 * - customer: una columna mobile-first (PWA).
 * - admin: panel de marca + formulario en desktop/tablet.
 */
export function AuthLayout({ variant }: { variant: 'customer' | 'admin' }) {
  const form = (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="w-full max-w-sm"
    >
      <Outlet />
    </motion.div>
  )

  if (variant === 'customer') {
    return (
      <div className="flex min-h-dvh flex-col bg-linear-to-b from-primary/10 via-background to-background px-6 pt-[max(env(safe-area-inset-top),2.5rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        <BrandLogo className="mx-auto mb-10" subtitle="Compra sin filas" />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">{form}</div>
      </div>
    )
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <BrandLogo subtitle="Panel del propietario" className="[&_span:last-child]:text-primary-foreground/70" />
        <div className="grid max-w-md gap-3">
          <p className="font-heading text-3xl font-semibold leading-tight">Tu tienda, en piloto automático.</p>
          <p className="text-primary-foreground/80">
            Ventas por cámaras y en mostrador, inventario en tiempo real y reportes en un solo lugar.
          </p>
        </div>
        <div aria-hidden className="absolute -right-24 -bottom-24 size-96 rounded-full bg-primary-foreground/10" />
      </aside>
      <main className="flex flex-col items-center justify-center gap-8 p-6">
        <BrandLogo className="lg:hidden" subtitle="Panel del propietario" />
        {form}
      </main>
    </div>
  )
}
