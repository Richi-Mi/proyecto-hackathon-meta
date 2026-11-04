import { Check, LoaderCircle, Minus, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage } from '@/lib/api/client'
import type { ShelfEventDetail } from '@/lib/api/types'
import { useApiQuery } from '@/lib/api/use-api-query'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { confirmShelfEvent, fetchProducts, fetchShelfEvent, rejectShelfEvent } from '../api'
import { describeShelfEvent, SHELF_REVIEW_REASON, SHELF_STATUS } from './shelf-labels'

interface ShelfEventDialogProps {
  eventId: string | null
  onClose: () => void
  onResolved: () => void
}

export function ShelfEventDialog({ eventId, onClose, onResolved }: ShelfEventDialogProps) {
  return (
    <Dialog open={eventId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        {eventId && <EventDetail key={eventId} eventId={eventId} onClose={onClose} onResolved={onResolved} />}
      </DialogContent>
    </Dialog>
  )
}

function EventDetail({ eventId, onClose, onResolved }: { eventId: string; onClose: () => void; onResolved: () => void }) {
  const detail = useApiQuery((signal) => fetchShelfEvent(eventId, signal), [eventId])
  const event = detail.data

  return (
    <>
      <DialogHeader>
        <DialogTitle>{event ? describeShelfEvent(event) : 'Evento de repisa'}</DialogTitle>
        <DialogDescription>
          {event ? (
            <>
              {event.cameraId} · {formatDateTime(event.capturedAt)} ·{' '}
              <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', SHELF_STATUS[event.status].className)}>
                {SHELF_STATUS[event.status].label}
              </span>
            </>
          ) : (
            'Cargando…'
          )}
        </DialogDescription>
      </DialogHeader>

      {detail.error && <p className="text-sm text-destructive">{getErrorMessage(detail.error)}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {(['beforeImage', 'afterImage'] as const).map((key) => (
          <figure key={key} className="grid gap-1">
            <figcaption className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {key === 'beforeImage' ? 'Antes' : 'Después'}
            </figcaption>
            {event ? (
              <img src={event[key]} alt={key === 'beforeImage' ? 'Repisa antes' : 'Repisa después'} className="w-full rounded-lg border" />
            ) : (
              <Skeleton className="aspect-video w-full rounded-lg" />
            )}
          </figure>
        ))}
      </div>

      {event && (
        <div className="grid gap-1 rounded-lg bg-muted px-3 py-2 text-sm">
          {event.note && <p>{event.note}</p>}
          <p className="text-xs text-muted-foreground">
            {event.confidence !== null && `Confianza ${Math.round(event.confidence * 100)} % · `}
            {event.reviewReason && `${SHELF_REVIEW_REASON[event.reviewReason]} · `}
            {event.model ?? 'sin modelo'}
          </p>
        </div>
      )}

      {event && (event.status === 'PENDING_REVIEW' || event.status === 'NO_CHANGE') ? (
        <ReviewForm event={event} onClose={onClose} onResolved={onResolved} />
      ) : (
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      )}
    </>
  )
}

function ReviewForm({ event, onClose, onResolved }: { event: ShelfEventDetail; onClose: () => void; onResolved: () => void }) {
  const [action, setAction] = useState<'REMOVED' | 'ADDED'>(event.action === 'ADDED' ? 'ADDED' : 'REMOVED')
  const [productId, setProductId] = useState(event.product?.id ?? '')
  const [quantity, setQuantity] = useState(String(Math.max(1, event.quantity)))
  const [busy, setBusy] = useState<'confirm' | 'reject' | null>(null)
  const products = useApiQuery((signal) => fetchProducts({ status: 'ACTIVE', limit: 100, sort: 'name' }, signal), [])

  const amount = /^\d+$/.test(quantity) ? Number(quantity) : 0

  async function confirm() {
    if (!productId || amount < 1) {
      toast.error('Elige el producto y una cantidad mayor a 0')
      return
    }
    setBusy('confirm')
    try {
      const updated = await confirmShelfEvent(event.id, { action, productId, quantity: amount })
      toast.success(describeShelfEvent(updated), { description: 'Inventario actualizado' })
      onResolved()
      onClose()
    } catch (error) {
      toast.error('No se pudo aplicar', { description: getErrorMessage(error) })
    } finally {
      setBusy(null)
    }
  }

  async function reject() {
    setBusy('reject')
    try {
      await rejectShelfEvent(event.id)
      toast.info('Evento descartado; el stock no cambió')
      onResolved()
      onClose()
    } catch (error) {
      toast.error('No se pudo descartar', { description: getErrorMessage(error) })
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Qué pasó">
          {([
            ['REMOVED', 'Salió de la repisa', Minus],
            ['ADDED', 'Entró (resurtido)', Plus],
          ] as const).map(([value, label, Icon]) => (
            <Button
              key={value}
              type="button"
              role="radio"
              aria-checked={action === value}
              variant={action === value ? 'default' : 'outline'}
              onClick={() => setAction(value)}
            >
              <Icon /> {label}
            </Button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
          <div className="grid gap-1.5">
            <Label>Producto</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={products.loading ? 'Cargando…' : 'Elige el producto'} />
              </SelectTrigger>
              <SelectContent>
                {products.data?.data.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name} · stock {product.stock}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="shelf-quantity">Piezas</Label>
            <Input
              id="shelf-quantity"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={quantity}
              onChange={(change) => setQuantity(change.target.value)}
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => void reject()} disabled={busy !== null}>
          {busy === 'reject' ? <LoaderCircle className="animate-spin" /> : <X />} Descartar
        </Button>
        <Button onClick={() => void confirm()} disabled={busy !== null}>
          {busy === 'confirm' ? <LoaderCircle className="animate-spin" /> : <Check />} Confirmar y aplicar
        </Button>
      </DialogFooter>
    </>
  )
}
