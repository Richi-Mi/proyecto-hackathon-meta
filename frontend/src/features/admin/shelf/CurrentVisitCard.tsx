import { LoaderCircle, ReceiptText, ShoppingBag } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getErrorMessage } from '@/lib/api/client'
import { useApiQuery } from '@/lib/api/use-api-query'
import { formatMoney } from '@/lib/format'
import { PAYMENT_STATUS_LABEL } from '@/lib/sale-labels'
import { checkoutCurrentVisit, fetchCurrentVisit } from '../api'

const POLL_MS = 3000

/** Panel del dueño: quién está en la tienda y qué lleva (lo que la cámara le vio tomar). */
export function CurrentVisitCard({ onCheckout }: { onCheckout?: () => void }) {
  const visit = useApiQuery(fetchCurrentVisit, [])
  const [charging, setCharging] = useState(false)

  useEffect(() => {
    const timer = window.setInterval(visit.reload, POLL_MS)
    return () => window.clearInterval(timer)
  })

  const cart = visit.data?.visit

  async function charge() {
    setCharging(true)
    try {
      const result = await checkoutCurrentVisit()
      if (!result.saleId) toast.info('Visita cerrada sin productos')
      else
        toast.success(`Ticket #${result.folio} por ${formatMoney(result.totalAmount)}`, {
          description: result.paymentStatus ? PAYMENT_STATUS_LABEL[result.paymentStatus] : undefined,
        })
      visit.reload()
      onCheckout?.()
    } catch (error) {
      toast.error('No se pudo cobrar la salida', { description: getErrorMessage(error) })
    } finally {
      setCharging(false)
    }
  }

  if (!cart) {
    return (
      <Card className="py-4">
        <CardContent className="flex items-center gap-3 text-sm text-muted-foreground">
          <ShoppingBag className="size-5" />
          No hay clientes en la tienda. Lo que la cámara detecte ahora se registra como movimiento de inventario.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-primary/40 bg-primary/5 py-4">
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShoppingBag className="size-5 text-primary" />
            <div>
              <div className="font-medium">{cart.customer.name} está en la tienda</div>
              <div className="text-xs text-muted-foreground">Lo que tome de la repisa se carga a su cuenta</div>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => void charge()} disabled={charging}>
            {charging ? <LoaderCircle className="animate-spin" /> : <ReceiptText />} Cobrar salida · {formatMoney(cart.total)}
          </Button>
        </div>
        {cart.items.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {cart.items.map((line) => (
              <span key={line.productId} className="rounded-md bg-background px-2 py-1 text-xs ring-1 ring-border">
                {line.quantity}× {line.name}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
