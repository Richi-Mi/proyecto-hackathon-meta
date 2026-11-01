import { LoaderCircle, Printer, Send } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { PrinterSettings } from '@/lib/api/types'
import { buildTestTicket, type TicketHeader } from './printer/test-ticket'
import { PRINTER_SUPPORT, PrinterError, printDirect } from './printer/transports'

interface PrinterTestPanelProps {
  printer: PrinterSettings
  header: TicketHeader
  /** La impresión directa detectó la dirección del dispositivo (vendorId:productId o nombre BLE) */
  onDetectedAddress: (address: string) => void
}

/**
 * Prueba de impresora con los valores del formulario (aunque no estén guardados):
 * - directa en ESC/POS por USB o Bluetooth (sin driver, desde el navegador);
 * - con el diálogo del navegador, que imprime la vista previa del ticket (sirve para cualquier impresora del sistema).
 */
export function PrinterTestPanel({ printer, header, onDetectedAddress }: PrinterTestPanelProps) {
  const [printing, setPrinting] = useState(false)
  const direct = printer.connection === 'USB' || printer.connection === 'BLUETOOTH'
  const supported = PRINTER_SUPPORT[printer.connection]()

  async function testDirect() {
    setPrinting(true)
    try {
      const printed = await printDirect(printer, buildTestTicket(header, printer))
      if (printed.address && printed.address !== printer.address) {
        onDetectedAddress(printed.address)
        toast.success(`Ticket de prueba enviado a ${printed.name}`, {
          description: `Se detectó ${printed.address}; guarda los cambios para recordarla.`,
        })
      } else {
        toast.success(`Ticket de prueba enviado a ${printed.name}`)
      }
    } catch (error) {
      toast.error(error instanceof PrinterError ? error.message : 'No se pudo imprimir')
    } finally {
      setPrinting(false)
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {direct && (
          <Button type="button" onClick={() => void testDirect()} disabled={printing || !supported}>
            {printing ? <LoaderCircle className="animate-spin" /> : <Send />}
            Imprimir prueba ({printer.connection === 'USB' ? 'USB' : 'Bluetooth'})
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => window.print()}>
          <Printer /> Imprimir con el navegador
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {direct && !supported
          ? 'Este navegador no permite conectar impresoras directamente. Usa Chrome o Edge en https o localhost.'
          : direct
            ? 'La prueba directa envía comandos ESC/POS sin driver. Si la impresora está instalada en el sistema, usa el diálogo del navegador.'
            : 'Imprime la vista previa del ticket con el diálogo del navegador (impresora instalada en el sistema).'}
      </p>
    </div>
  )
}
