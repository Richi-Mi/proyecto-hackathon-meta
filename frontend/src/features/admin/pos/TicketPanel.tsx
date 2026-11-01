import { Banknote, CreditCard, Landmark, LoaderCircle, Minus, Plus, ShoppingBasket, Trash2, type LucideIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { ManualSaleRequest } from '@/lib/api/types'
import { formatMoney } from '@/lib/format'
import { priceLine } from '@/lib/pricing'
import { cn } from '@/lib/utils'
import { cartTotals, cartUnits, usePosCart } from './pos-cart-store'

export type PaymentMethod = ManualSaleRequest['paymentMethod']

const PAYMENT_BUTTONS: { method: PaymentMethod; label: string; icon: LucideIcon }[] = [
  { method: 'CASH', label: 'Efectivo', icon: Banknote },
  { method: 'CARD', label: 'Tarjeta', icon: CreditCard },
  { method: 'TRANSFER', label: 'Transferencia', icon: Landmark },
]

interface TicketPanelProps {
  onPay: (method: PaymentMethod) => void
  charging: PaymentMethod | null
}

export function TicketPanel({ onPay, charging }: TicketPanelProps) {
  const { lines, setQuantity, remove, clear } = usePosCart()
  const totals = cartTotals(lines)
  const units = cartUnits(lines)
  const hasStockIssue = lines.some((line) => line.quantity > line.product.stock)

  return (
    <aside className="grid min-h-0 grid-rows-[auto_1fr_auto] rounded-2xl border bg-card" aria-label="Ticket de venta">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="font-heading font-semibold">
          Ticket <span className="text-sm font-normal text-muted-foreground">· {units} pieza{units === 1 ? '' : 's'}</span>
        </h2>
        <Button variant="ghost" size="sm" disabled={lines.length === 0 || charging !== null} onClick={clear}>
          <Trash2 /> Vaciar
        </Button>
      </header>

      <ul className="min-h-0 overflow-y-auto px-2 py-2">
        {lines.length === 0 && (
          <li className="grid h-full min-h-40 place-items-center content-center gap-2 text-center text-sm text-muted-foreground">
            <ShoppingBasket className="size-8" />
            Escanea o toca un producto para empezar.
          </li>
        )}
        <AnimatePresence initial={false}>
          {lines.map(({ product, quantity }) => {
            const overStock = quantity > product.stock
            return (
              <motion.li
                key={product.id}
                layout
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.18 }}
                className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 rounded-xl px-2 py-2.5 hover:bg-muted/50"
              >
                <span className="text-sm leading-tight font-medium">{product.name}</span>
                <span className="text-right text-sm font-semibold tabular-nums">
                  {formatMoney(priceLine({ quantity, unitPrice: product.price, taxRate: product.taxRate }).total)}
                </span>
                <span className="flex items-center gap-1">
                  <Button variant="outline" size="icon-xs" aria-label={`Quitar una pieza de ${product.name}`} onClick={() => setQuantity(product.id, quantity - 1)}>
                    <Minus />
                  </Button>
                  <span className={cn('w-7 text-center text-sm tabular-nums', overStock && 'font-semibold text-destructive')}>{quantity}</span>
                  <Button variant="outline" size="icon-xs" aria-label={`Agregar una pieza de ${product.name}`} onClick={() => setQuantity(product.id, quantity + 1)}>
                    <Plus />
                  </Button>
                  <span className="ml-1 text-xs text-muted-foreground tabular-nums">× {formatMoney(product.price)}</span>
                </span>
                <span className="flex items-center justify-end gap-2">
                  {overStock && <span className="text-xs text-destructive">Solo hay {product.stock}</span>}
                  <Button variant="ghost" size="icon-xs" aria-label={`Eliminar ${product.name}`} onClick={() => remove(product.id)}>
                    <Trash2 />
                  </Button>
                </span>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>

      <footer className="grid gap-3 border-t p-4">
        <dl className="grid gap-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <dt>Subtotal (sin IVA)</dt>
            <dd className="tabular-nums">{formatMoney(totals.subtotal)}</dd>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <dt>IVA</dt>
            <dd className="tabular-nums">{formatMoney(totals.taxAmount)}</dd>
          </div>
          <Separator className="my-1" />
          <div className="flex items-baseline justify-between">
            <dt className="font-medium">Total</dt>
            <dd className="font-heading text-3xl font-semibold tracking-tight tabular-nums">{formatMoney(totals.totalAmount)}</dd>
          </div>
        </dl>
        <div className="grid grid-cols-3 gap-2">
          {PAYMENT_BUTTONS.map(({ method, label, icon: Icon }) => (
            <Button
              key={method}
              size="lg"
              variant={method === 'CASH' ? 'default' : 'secondary'}
              className="h-16 flex-col gap-1 text-xs"
              disabled={lines.length === 0 || hasStockIssue || charging !== null}
              onClick={() => onPay(method)}
            >
              {charging === method ? <LoaderCircle className="size-5 animate-spin" /> : <Icon className="size-5" />}
              {label}
            </Button>
          ))}
        </div>
        {hasStockIssue && <p className="text-center text-xs text-destructive">Ajusta las cantidades que superan el stock.</p>}
      </footer>
    </aside>
  )
}
