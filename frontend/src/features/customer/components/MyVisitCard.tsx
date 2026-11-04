import { LoaderCircle, LogOut, ShoppingBag } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getErrorMessage } from '@/lib/api/client'
import { useApiQuery } from '@/lib/api/use-api-query'
import { formatMoney } from '@/lib/format'
import { PAYMENT_STATUS_LABEL } from '@/lib/sale-labels'
import { checkoutMyVisit, fetchMyVisit } from '../api'

const POLL_MS = 3000

/** Dentro de la tienda: lo que la cámara de la repisa me vio tomar, en vivo, y el botón para salir y pagar. */
export function MyVisitCard() {
  const visit = useApiQuery(fetchMyVisit, [])
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const timer = window.setInterval(visit.reload, POLL_MS)
    return () => window.clearInterval(timer)
  })

  const cart = visit.data?.visit
  if (!cart) return null

  async function leave() {
    setLeaving(true)
    try {
      const result = await checkoutMyVisit()
      if (!result.saleId) toast.info('¡Gracias por tu visita!', { description: 'No te llevaste productos, no se cobró nada' })
      else if (result.paymentStatus === 'PAID')
        toast.success(`Pagaste ${formatMoney(result.totalAmount)}`, { description: `Ticket #${result.folio} · lo ves en Mis compras` })
      else
        toast.warning(`Ticket #${result.folio} por ${formatMoney(result.totalAmount)}`, {
          description: result.paymentStatus ? PAYMENT_STATUS_LABEL[result.paymentStatus] : undefined,
        })
      visit.reload()
    } catch (error) {
      toast.error('No se pudo cerrar tu visita', { description: getErrorMessage(error) })
    } finally {
      setLeaving(false)
    }
  }

  return (
    <Card className="gap-4 border-primary/40 bg-primary/5 px-5 py-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
          <ShoppingBag className="size-5" />
        </span>
        <div>
          <div className="font-heading text-lg font-semibold">Estás en la tienda</div>
          <div className="text-xs text-muted-foreground">Toma lo que quieras: la cámara lo agrega a tu cuenta</div>
        </div>
      </div>

      {cart.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tu carrito está vacío.</p>
      ) : (
        <ul className="grid gap-1.5 text-sm">
          {cart.items.map((line) => (
            <li key={line.productId} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">
                <span className="font-medium tabular-nums">{line.quantity}×</span> {line.name}
              </span>
              <span className="tabular-nums">{formatMoney(line.subtotal)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between border-t pt-3">
        <span className="text-sm text-muted-foreground">
          {cart.itemCount} pieza{cart.itemCount === 1 ? '' : 's'}
        </span>
        <span className="font-heading text-xl font-semibold tabular-nums">{formatMoney(cart.total)}</span>
      </div>

      <Button size="lg" onClick={() => void leave()} disabled={leaving}>
        {leaving ? <LoaderCircle className="animate-spin" /> : <LogOut />}
        {cart.items.length === 0 ? 'Salir de la tienda' : `Salir y pagar ${formatMoney(cart.total)}`}
      </Button>
    </Card>
  )
}
