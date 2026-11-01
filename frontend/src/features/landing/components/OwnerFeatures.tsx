import { LayoutDashboard, Package, ReceiptText, ScanBarcode, type LucideIcon } from 'lucide-react'
import { motion } from 'motion/react'

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard en vivo',
    text: 'Ingresos del día y la semana, ganancia neta real (con el costo de cada venta) y productos de mayor rotación.',
  },
  {
    icon: Package,
    title: 'Inventario con alertas',
    text: 'Stock que se descuenta solo, alertas de stock mínimo y kardex de cada entrada, ajuste y venta.',
  },
  {
    icon: ScanBarcode,
    title: 'Caja para mostrador',
    text: 'Lector de código de barras, catálogo rápido por categorías y cobro en efectivo, tarjeta o transferencia.',
  },
  {
    icon: ReceiptText,
    title: 'Historial y cancelaciones',
    text: 'Cada ticket, automático o manual, con reimpresión y cancelación que regresa el stock.',
  },
]

export function OwnerFeatures() {
  return (
    <section id="para-tiendas" className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6">
      <div className="grid max-w-2xl gap-2">
        <p className="text-sm font-semibold text-primary">Para tiendas</p>
        <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Todo el negocio en un solo panel.
        </h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, text }, index) => (
          <motion.article
            key={title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.4, delay: index * 0.08, ease: 'easeOut' }}
            className="grid content-start gap-3 rounded-2xl border bg-card p-5"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Icon className="size-5" />
            </span>
            <h3 className="font-heading font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{text}</p>
          </motion.article>
        ))}
      </div>
    </section>
  )
}
