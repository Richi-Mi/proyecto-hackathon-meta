import { CheckCircle2, Printer } from 'lucide-react'
import { TicketView } from '@/components/ticket/TicketView'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { SaleDetail } from '@/lib/api/types'

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

        {sale && <TicketView sale={sale} printable />}

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
