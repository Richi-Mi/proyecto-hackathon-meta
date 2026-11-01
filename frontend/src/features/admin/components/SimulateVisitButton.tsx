import { ScanLine } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { getErrorMessage } from '@/lib/api/client'
import { formatMoney } from '@/lib/format'
import { PAYMENT_STATUS_LABEL } from '@/lib/sale-labels'
import { simulateStoreVisit } from '../api'

/** Demo del flujo automático: el cliente demo entra con su QR y sale con productos al azar. */
export function SimulateVisitButton({ onSimulated }: { onSimulated: () => void }) {
  const [running, setRunning] = useState(false)

  const simulate = async () => {
    setRunning(true)
    try {
      const visit = await simulateStoreVisit()
      const pieces = `${visit.itemCount} ${visit.itemCount === 1 ? 'pieza' : 'piezas'}`
      const message = `${visit.customer.name} salió con ${pieces}: ticket #${visit.folio} por ${formatMoney(visit.totalAmount)}`
      if (visit.paymentStatus === 'PAID') toast.success(message, { description: 'Cobrado automáticamente' })
      else toast.warning(message, { description: visit.paymentStatus ? PAYMENT_STATUS_LABEL[visit.paymentStatus] : undefined })
      onSimulated()
    } catch (error) {
      toast.error('No se pudo simular la visita', { description: getErrorMessage(error) })
    } finally {
      setRunning(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={simulate} disabled={running}>
      <ScanLine />
      {running ? 'Simulando…' : 'Simular visita'}
    </Button>
  )
}
