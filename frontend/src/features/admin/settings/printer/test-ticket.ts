import type { PrinterSettings } from '@/lib/api/types'
import { formatDateTime, formatMoney } from '@/lib/format'
import { columns, COLUMNS_BY_WIDTH, EscPosBuilder } from './escpos'

export interface TicketHeader {
  businessName: string
  legalName: string | null
  rfc: string | null
  address: string
  phone: string | null
  ticketFooter: string | null
}

const CONNECTION_LABEL: Record<PrinterSettings['connection'], string> = {
  USB: 'USB',
  BLUETOOTH: 'Bluetooth',
  NETWORK: 'Red',
  NONE: 'Ninguna',
}

/** Ticket de prueba: encabezado real del negocio, una regla para verificar el ancho y el pie configurado. */
export function buildTestTicket(header: TicketHeader, printer: PrinterSettings, now = new Date()) {
  const width = COLUMNS_BY_WIDTH[printer.paperWidthMm]
  const ticket = new EscPosBuilder(width)

  ticket.align('center').bold(true).large(true).line(header.businessName, { large: true }).large(false).bold(false)
  if (header.legalName) ticket.line(header.legalName)
  if (header.rfc) ticket.line(`RFC ${header.rfc}`)
  ticket.line(header.address)
  if (header.phone) ticket.line(`Tel. ${header.phone}`)

  ticket.divider().bold(true).line('PRUEBA DE IMPRESION').bold(false).line(formatDateTime(now.toISOString())).divider()

  ticket
    .align('left')
    .line(columns('Conexion', `${CONNECTION_LABEL[printer.connection]}${printer.address ? ` ${printer.address}` : ''}`, width))
    .line(columns('Papel', `${printer.paperWidthMm} mm / ${width} col.`, width))
    .line('1234567890'.repeat(Math.ceil(width / 10)).slice(0, width))
    .divider()
    .line('Refresco de cola 600 ml')
    .line(columns(`  2 x ${formatMoney(20)}`, formatMoney(40), width))
    .bold(true)
    .line(columns('TOTAL', formatMoney(40), width))
    .bold(false)
    .divider()
    .align('center')
    .line(header.ticketFooter ?? '¡Gracias por su compra!')
    .feed(3)
    .cut()

  return ticket.build()
}
