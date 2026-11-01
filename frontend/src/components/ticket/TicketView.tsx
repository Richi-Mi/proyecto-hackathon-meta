import type { BusinessProfile, SaleDetail } from '@/lib/api/types'
import { formatDateTime, formatMoney, formatRate } from '@/lib/format'
import { taxBreakdown } from '@/lib/pricing'
import { PAYMENT_METHOD_LABEL } from '@/lib/sale-labels'
import { cn } from '@/lib/utils'

interface TicketViewProps {
  sale: SaleDetail
  /** Encabezado del negocio (de GET /sales/{id}/receipt); sin él se muestra solo el nombre */
  business?: BusinessProfile
  /** Marca el área que se imprime con window.print() (ver @media print en index.css) */
  printable?: boolean
  className?: string
}

/** Ticket en formato de impresora térmica: POS, reimpresión del propietario y detalle de compra del cliente. */
export function TicketView({ sale, business, printable = false, className }: TicketViewProps) {
  const cancelled = sale.status === 'CANCELLED'
  return (
    <div
      data-print-area={printable || undefined}
      className={cn('relative grid gap-3 rounded-xl border border-dashed bg-card p-4 font-mono text-xs', className)}
    >
      {cancelled && (
        <span className="absolute top-3 right-3 rotate-6 rounded border-2 border-destructive px-2 py-0.5 text-[11px] font-bold tracking-widest text-destructive">
          CANCELADO
        </span>
      )}
      <div className="text-center">
        <p className="text-sm font-semibold">{business?.name ?? 'Smart Abarrotes'}</p>
        {business?.legalName && <p>{business.legalName}</p>}
        {business?.rfc && <p>RFC {business.rfc}</p>}
        {business?.address && <p>{business.address}</p>}
        {business?.phone && <p>Tel. {business.phone}</p>}
        <p className="mt-1">Ticket #{sale.folio}</p>
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
        {taxBreakdown(sale.items).map((line) => (
          <Row key={line.rate} label={`IVA ${formatRate(line.rate)} sobre ${formatMoney(line.base)}`} value={formatMoney(line.tax)} />
        ))}
        <Row label="Total" value={formatMoney(sale.totalAmount)} strong />
        <Row label="Pago" value={PAYMENT_METHOD_LABEL[sale.paymentMethod]} />
        {sale.paymentReference && <Row label="Referencia" value={sale.paymentReference} />}
        {sale.cashReceived != null && <Row label="Recibido" value={formatMoney(sale.cashReceived)} />}
        {sale.changeGiven != null && <Row label="Cambio" value={formatMoney(sale.changeGiven)} strong />}
      </dl>

      {cancelled ? (
        <p className="text-center text-destructive">
          Cancelado {sale.cancelledAt && formatDateTime(sale.cancelledAt)}
          {sale.cancelReason && <> · {sale.cancelReason}</>}
        </p>
      ) : (
        <p className="text-center text-muted-foreground">{business?.footer ?? '¡Gracias por su compra!'}</p>
      )}
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? 'flex justify-between gap-3 text-sm font-semibold' : 'flex justify-between gap-3'}>
      <dt>{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  )
}
