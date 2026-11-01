import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { getErrorMessage } from '@/lib/api/client'
import type { SaleDetail } from '@/lib/api/types'
import { formatMoney } from '@/lib/format'
import { cancelSale } from '../api'

const REFUND_HINT: Record<SaleDetail['paymentMethod'], string> = {
  CASH: 'Devuelve el efectivo al cliente.',
  CARD: 'Haz la devolución en la terminal bancaria.',
  TRANSFER: 'Regresa la transferencia al cliente.',
  CARD_ON_FILE: 'El cobro automático se marca como reembolsado.',
}

interface CancelSaleDialogProps {
  sale: SaleDetail | null
  onClose: () => void
  onCancelled: (sale: SaleDetail) => void
}

export function CancelSaleDialog({ sale, onClose, onCancelled }: CancelSaleDialogProps) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const pieces = sale?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0

  const close = () => {
    setReason('')
    setError(undefined)
    onClose()
  }

  async function confirm() {
    if (!sale) return
    if (reason.trim().length < 3) {
      setError('Escribe el motivo (mínimo 3 caracteres)')
      return
    }
    setSaving(true)
    try {
      const cancelled = await cancelSale(sale.id, reason.trim())
      toast.success(`Ticket #${cancelled.folio} cancelado; el stock ya se repuso`)
      onCancelled(cancelled)
      close()
    } catch (cause) {
      toast.error(getErrorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AlertDialog open={sale !== null} onOpenChange={(open) => !open && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Cancelar el ticket #{sale?.folio}?</AlertDialogTitle>
          <AlertDialogDescription>
            Se cancela la venta completa por {sale && formatMoney(sale.totalAmount)}: regresan {pieces} pieza{pieces === 1 ? '' : 's'} al
            inventario y el pago se marca como reembolsado. {sale && REFUND_HINT[sale.paymentMethod]} No se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Field data-invalid={Boolean(error)}>
          <FieldLabel htmlFor="cancel-reason">Motivo</FieldLabel>
          <Textarea
            id="cancel-reason"
            rows={2}
            maxLength={255}
            value={reason}
            aria-invalid={Boolean(error)}
            placeholder="Ej. el cliente devolvió los productos"
            onChange={(event) => {
              setReason(event.target.value)
              setError(undefined)
            }}
          />
          {!error && <FieldDescription>Queda registrado en la venta y en el kardex.</FieldDescription>}
          <FieldError>{error}</FieldError>
        </Field>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Volver</AlertDialogCancel>
          <Button variant="destructive" disabled={saving} onClick={() => void confirm()}>
            {saving && <LoaderCircle className="animate-spin" />}
            Cancelar venta
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
