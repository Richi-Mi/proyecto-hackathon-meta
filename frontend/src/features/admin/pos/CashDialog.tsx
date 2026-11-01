import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatMoney } from '@/lib/format'

const BILLS = [20, 50, 100, 200, 500, 1000]

interface CashDialogProps {
  total: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (cashReceived: number) => void
}

/** Monto recibido en efectivo: pago exacto, billetes rápidos o captura libre; calcula el cambio. */
export function CashDialog({ total, open, onOpenChange, onConfirm }: CashDialogProps) {
  const [received, setReceived] = useState('')
  const amount = Number(received)
  const valid = received !== '' && Number.isFinite(amount) && amount >= total
  const quickAmounts = [total, ...BILLS.filter((bill) => bill > total).slice(0, 4)]

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setReceived('')
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cobro en efectivo</DialogTitle>
          <DialogDescription>
            Total a cobrar: <span className="font-semibold text-foreground">{formatMoney(total)}</span>
          </DialogDescription>
        </DialogHeader>

        <form
          id="cash-form"
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (valid) onConfirm(amount)
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="cash-received">Recibido</Label>
            <Input
              id="cash-received"
              autoFocus
              inputMode="decimal"
              type="number"
              min={total}
              step="0.5"
              value={received}
              onChange={(event) => setReceived(event.target.value)}
              className="h-12 text-lg tabular-nums"
              placeholder="0.00"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {quickAmounts.map((value, index) => (
              <Button key={value} type="button" variant="outline" onClick={() => setReceived(String(value))}>
                {index === 0 ? 'Exacto' : formatMoney(value)}
              </Button>
            ))}
          </div>
          <div className="flex items-baseline justify-between rounded-xl bg-muted px-4 py-3">
            <span className="text-sm text-muted-foreground">Cambio</span>
            <span className="font-heading text-2xl font-semibold tabular-nums">{formatMoney(valid ? amount - total : 0)}</span>
          </div>
        </form>

        <DialogFooter>
          <Button type="submit" form="cash-form" size="lg" disabled={!valid} className="w-full">
            Confirmar cobro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
