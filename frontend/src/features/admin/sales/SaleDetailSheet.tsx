import { Ban, Printer } from 'lucide-react'
import { useState } from 'react'
import { TicketView } from '@/components/ticket/TicketView'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage } from '@/lib/api/client'
import type { SaleDetail } from '@/lib/api/types'
import { useApiQuery } from '@/lib/api/use-api-query'
import { PAYMENT_STATUS_LABEL, SALE_TYPE_LABEL } from '@/lib/sale-labels'
import { fetchReceipt } from '../api'
import { CancelSaleDialog } from './CancelSaleDialog'

interface SaleDetailSheetProps {
  saleId: string | null
  onClose: () => void
  onChanged: () => void
}

export function SaleDetailSheet({ saleId, onClose, onChanged }: SaleDetailSheetProps) {
  return (
    <Sheet open={saleId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        {saleId && <SaleDetailContent key={saleId} saleId={saleId} onChanged={onChanged} />}
      </SheetContent>
    </Sheet>
  )
}

function SaleDetailContent({ saleId, onChanged }: { saleId: string; onChanged: () => void }) {
  const receipt = useApiQuery((signal) => fetchReceipt(saleId, signal), [saleId])
  const [cancelling, setCancelling] = useState<SaleDetail | null>(null)
  const sale = receipt.data?.sale

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle>{sale ? `Ticket #${sale.folio}` : 'Ticket'}</SheetTitle>
        <SheetDescription asChild>
          <div className="flex flex-wrap items-center gap-2">
            {sale ? (
              <>
                <Badge variant="secondary">{SALE_TYPE_LABEL[sale.saleType]}</Badge>
                <Badge variant="outline">{PAYMENT_STATUS_LABEL[sale.paymentStatus]}</Badge>
                {sale.customer && <span>Cliente: {sale.customer.name}</span>}
                {sale.cashier && <span>Cobró: {sale.cashier.name}</span>}
              </>
            ) : (
              <span>Cargando…</span>
            )}
          </div>
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {receipt.error !== undefined && <p className="text-sm text-destructive">{getErrorMessage(receipt.error)}</p>}
        {!receipt.data && receipt.error === undefined && <Skeleton className="h-96 w-full rounded-xl" />}
        {receipt.data && sale && <TicketView sale={sale} business={receipt.data.business} printable />}
      </div>

      <SheetFooter className="flex-row justify-end gap-2 border-t">
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive"
          disabled={!sale || sale.status === 'CANCELLED'}
          onClick={() => sale && setCancelling(sale)}
        >
          <Ban /> Cancelar venta
        </Button>
        <Button disabled={!sale} onClick={() => window.print()}>
          <Printer /> Reimprimir
        </Button>
      </SheetFooter>

      <CancelSaleDialog
        sale={cancelling}
        onClose={() => setCancelling(null)}
        onCancelled={() => {
          receipt.reload()
          onChanged()
        }}
      />
    </>
  )
}
