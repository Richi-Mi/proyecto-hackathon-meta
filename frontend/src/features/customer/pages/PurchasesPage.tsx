import { ReceiptText } from 'lucide-react'
import { PagePlaceholder } from '@/components/PagePlaceholder'

export function PurchasesPage() {
  return (
    <PagePlaceholder
      icon={ReceiptText}
      title="Mis compras"
      description="Tickets agrupados por fecha con el detalle de lo que las cámaras cobraron automáticamente."
      milestone="Requiere /me/purchases"
    />
  )
}
