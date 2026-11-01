import { ArrowRight, LoaderCircle, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { Product } from '@/lib/api/types'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { adjustStock } from '../api'
import { toFieldErrors, type FieldErrors } from './form-errors'

export type StockMode = 'RESTOCK' | 'ADJUSTMENT'
type AdjustmentField = 'quantity' | 'unitCost' | 'note'

const COPY: Record<StockMode, { title: string; description: string; submit: string }> = {
  RESTOCK: {
    title: 'Entrada de mercancía',
    description: 'Registra lo que llegó del proveedor. Si cambió el costo, actualízalo aquí.',
    submit: 'Registrar entrada',
  },
  ADJUSTMENT: {
    title: 'Ajuste de stock',
    description: 'Corrige el inventario por merma, caducidad, robo o un conteo físico.',
    submit: 'Aplicar ajuste',
  },
}

interface StockAdjustmentDialogProps {
  target: { product: Product; mode: StockMode } | null
  onClose: () => void
  onDone: () => void
}

export function StockAdjustmentDialog({ target, onClose, onDone }: StockAdjustmentDialogProps) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {target && <AdjustmentForm key={`${target.product.id}-${target.mode}`} {...target} onClose={onClose} onDone={onDone} />}
      </DialogContent>
    </Dialog>
  )
}

function AdjustmentForm({ product, mode, onClose, onDone }: { product: Product; mode: StockMode; onClose: () => void; onDone: () => void }) {
  const [direction, setDirection] = useState<1 | -1>(mode === 'RESTOCK' ? 1 : -1)
  const [quantity, setQuantity] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<FieldErrors<AdjustmentField>>({})
  const [saving, setSaving] = useState(false)

  const amount = /^\d+$/.test(quantity) ? Number(quantity) : 0
  const delta = amount * direction
  const resulting = product.stock + delta
  const copy = COPY[mode]

  async function submit() {
    const found: FieldErrors<AdjustmentField> = {}
    if (amount <= 0) found.quantity = 'Indica una cantidad entera mayor a 0'
    else if (resulting < 0) found.quantity = `Solo hay ${product.stock} en inventario`
    if (unitCost && !(Number(unitCost) >= 0)) found.unitCost = 'Costo inválido'
    if (mode === 'ADJUSTMENT' && !note.trim()) found.note = 'Indica el motivo del ajuste'
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSaving(true)
    try {
      await adjustStock(product.id, {
        type: mode,
        quantity: delta,
        ...(mode === 'RESTOCK' && unitCost !== '' && { unitCost: Number(unitCost) }),
        ...(note.trim() && { note: note.trim() }),
      })
      toast.success(`${product.name}: stock ${product.stock} → ${resulting}`)
      onDone()
      onClose()
    } catch (cause) {
      const { fields, message } = toFieldErrors(cause, ['quantity', 'unitCost', 'note'] as const)
      setErrors(fields)
      if (message) toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{copy.title}</DialogTitle>
        <DialogDescription>
          <span className="font-medium text-foreground">{product.name}</span> · {copy.description}
        </DialogDescription>
      </DialogHeader>

      <form
        id="stock-form"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <FieldGroup>
          {mode === 'ADJUSTMENT' && (
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de ajuste">
              {([
                [-1, 'Restar (merma)', Minus],
                [1, 'Sumar (sobrante)', Plus],
              ] as const).map(([value, label, Icon]) => (
                <Button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={direction === value}
                  variant={direction === value ? 'default' : 'outline'}
                  onClick={() => setDirection(value)}
                >
                  <Icon /> {label}
                </Button>
              ))}
            </div>
          )}

          <Field data-invalid={Boolean(errors.quantity)}>
            <FieldLabel htmlFor="stock-quantity">Cantidad (piezas)</FieldLabel>
            <Input
              id="stock-quantity"
              autoFocus
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={quantity}
              aria-invalid={Boolean(errors.quantity)}
              onChange={(event) => setQuantity(event.target.value)}
              className="h-11 text-lg tabular-nums"
            />
            <FieldError>{errors.quantity}</FieldError>
          </Field>

          <div
            className={cn(
              'flex items-center justify-center gap-3 rounded-xl bg-muted px-4 py-3 font-heading text-lg tabular-nums',
              resulting < 0 && 'bg-destructive/10 text-destructive',
            )}
            aria-live="polite"
          >
            <span className="text-muted-foreground">{product.stock}</span>
            <ArrowRight className="size-4 text-muted-foreground" />
            <span className="font-semibold">{resulting}</span>
            <span className="text-sm font-normal text-muted-foreground">en inventario</span>
          </div>

          {mode === 'RESTOCK' && (
            <Field data-invalid={Boolean(errors.unitCost)}>
              <FieldLabel htmlFor="stock-unitCost">Costo unitario (sin IVA)</FieldLabel>
              <Input
                id="stock-unitCost"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder={String(product.purchaseCost)}
                value={unitCost}
                aria-invalid={Boolean(errors.unitCost)}
                onChange={(event) => setUnitCost(event.target.value)}
              />
              {!errors.unitCost && (
                <FieldDescription>Opcional. Actual: {formatMoney(product.purchaseCost)}; si cambia, se actualiza el producto.</FieldDescription>
              )}
              <FieldError>{errors.unitCost}</FieldError>
            </Field>
          )}

          <Field data-invalid={Boolean(errors.note)}>
            <FieldLabel htmlFor="stock-note">{mode === 'RESTOCK' ? 'Nota (proveedor, factura…)' : 'Motivo'}</FieldLabel>
            <Input
              id="stock-note"
              maxLength={255}
              value={note}
              aria-invalid={Boolean(errors.note)}
              placeholder={mode === 'RESTOCK' ? 'Opcional' : 'Ej. producto caducado'}
              onChange={(event) => setNote(event.target.value)}
            />
            <FieldError>{errors.note}</FieldError>
          </Field>
        </FieldGroup>
      </form>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" form="stock-form" disabled={saving}>
          {saving && <LoaderCircle className="animate-spin" />}
          {copy.submit}
        </Button>
      </DialogFooter>
    </>
  )
}
