import { CheckCircle2, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { SaleDetail } from '@/lib/api/types'
import { formatDateTime, formatMoney } from '@/lib/format'

const METHOD_LABEL: Record<SaleDetail['paymentMethod'], string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  CARD_ON_FILE: 'Cobro automático',
}

interface ReceiptDialogProps {
  sale: SaleDetail | null
  onClose: () => void
}

export function ReceiptDialog({ sale, onClose }: ReceiptDialogProps) {
  return (
    <Dialog open={sale !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="items-center text-center">
          <CheckCircle2 className="size-10 text-primary" />
          <DialogTitle>Venta registrada</DialogTitle>
          <DialogDescription>El inventario ya se actualizó.</DialogDescription>
        </DialogHeader>

        {sale && (
          // Solo esta área se imprime (ver @media print en index.css)
          <div data-print-area className="grid gap-3 rounded-xl border border-dashed p-4 font-mono text-xs">
            <div className="text-center">
              <p className="text-sm font-semibold">Smart Abarrotes</p>
              <p>Ticket #{sale.folio}</p>
              <p>{formatDateTime(sale.dateTime)}</p>
            </div>
            <ul className="grid gap-1.5 border-y border-dashed py-2">
              {sale.items.map((item) => (
                <li key={item.id} className="grid grid-cols-[1fr_auto] gap-x-2">
                  <span>{item.productName}</span>
                  <span className="text-right">{formatMoney(item.subtotal)}</span>
                  <span className="text-muted-foreground">
                    {item.quantity} × {formatMoney(item.unitPrice)}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="grid gap-1">
              <Row label="Subtotal" value={formatMoney(sale.subtotal)} />
              <Row label="IVA" value={formatMoney(sale.taxAmount)} />
              <Row label="Total" value={formatMoney(sale.totalAmount)} strong />
              <Row label="Pago" value={METHOD_LABEL[sale.paymentMethod]} />
              {sale.cashReceived != null && <Row label="Recibido" value={formatMoney(sale.cashReceived)} />}
              {sale.changeGiven != null && <Row label="Cambio" value={formatMoney(sale.changeGiven)} strong />}
            </dl>
            <p className="text-center text-muted-foreground">¡Gracias por su compra!</p>
          </div>
        )}

        <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> Imprimir
          </Button>
          <Button onClick={onClose}>Nueva venta</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? 'flex justify-between text-sm font-semibold' : 'flex justify-between'}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
