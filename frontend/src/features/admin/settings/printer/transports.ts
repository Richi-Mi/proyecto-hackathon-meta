import type { PrinterSettings } from '@/lib/api/types'

/**
 * Envío de bytes ESC/POS a la impresora desde el navegador:
 * - USB: WebUSB (Chrome/Edge de escritorio y Android).
 * - Bluetooth: Web Bluetooth, solo impresoras BLE (las de Bluetooth clásico/SPP no son accesibles desde el navegador).
 * - Red: los navegadores no abren sockets TCP; se usa la impresión del sistema (window.print).
 * Ambas APIs exigen contexto seguro (https o localhost) y un gesto del usuario para elegir el dispositivo.
 */

// Tipos mínimos: lib.dom de TypeScript no incluye WebUSB ni Web Bluetooth.
interface UsbEndpoint {
  endpointNumber: number
  direction: 'in' | 'out'
  type: 'bulk' | 'interrupt' | 'isochronous'
}
interface UsbInterface {
  interfaceNumber: number
  alternate: { interfaceClass: number; endpoints: UsbEndpoint[] }
}
interface UsbDevice {
  vendorId: number
  productId: number
  productName?: string
  configuration: { interfaces: UsbInterface[] } | null
  open(): Promise<void>
  close(): Promise<void>
  selectConfiguration(value: number): Promise<void>
  claimInterface(number: number): Promise<void>
  releaseInterface(number: number): Promise<void>
  transferOut(endpoint: number, data: BufferSource): Promise<{ status: 'ok' | 'stall' | 'babble' }>
}
interface Usb {
  getDevices(): Promise<UsbDevice[]>
  requestDevice(options: { filters: { vendorId?: number; productId?: number; classCode?: number }[] }): Promise<UsbDevice>
}
interface BluetoothCharacteristic {
  properties: { write: boolean; writeWithoutResponse: boolean }
  writeValueWithResponse(value: BufferSource): Promise<void>
  writeValueWithoutResponse(value: BufferSource): Promise<void>
}
interface BluetoothServer {
  getPrimaryServices(): Promise<{ getCharacteristics(): Promise<BluetoothCharacteristic[]> }[]>
  disconnect(): void
}
interface BluetoothDevice {
  name?: string
  gatt?: { connect(): Promise<BluetoothServer> }
}
interface Bluetooth {
  requestDevice(options: { acceptAllDevices: true; optionalServices: string[] }): Promise<BluetoothDevice>
}

const navigatorWithDevices = () => navigator as Navigator & { usb?: Usb; bluetooth?: Bluetooth }

export class PrinterError extends Error {}

/** Resultado de una impresión directa: dirección para guardar en la configuración. */
export interface PrintedOn {
  address: string | null
  name: string
}

export const PRINTER_SUPPORT = {
  USB: () => window.isSecureContext && Boolean(navigatorWithDevices().usb),
  BLUETOOTH: () => window.isSecureContext && Boolean(navigatorWithDevices().bluetooth),
  NETWORK: () => false,
  NONE: () => false,
} satisfies Record<PrinterSettings['connection'], () => boolean>

export function printDirect(printer: PrinterSettings, data: Uint8Array<ArrayBuffer>): Promise<PrintedOn> {
  if (printer.connection === 'USB') return printViaUsb(data, printer.address)
  if (printer.connection === 'BLUETOOTH') return printViaBluetooth(data)
  throw new PrinterError(
    printer.connection === 'NETWORK'
      ? 'El navegador no puede conectarse directo a una impresora de red. Instálala en el sistema y usa "Imprimir con el navegador".'
      : 'No hay impresora térmica configurada.',
  )
}

// ── USB ─────────────────────────────────────────────────────────────────────

const USB_PRINTER_CLASS = 7
const hex4 = (value: number) => value.toString(16).padStart(4, '0')

export const formatUsbAddress = (device: Pick<UsbDevice, 'vendorId' | 'productId'>) =>
  `${hex4(device.vendorId)}:${hex4(device.productId)}`

function parseUsbAddress(address: string | null) {
  const match = address?.trim().match(/^([0-9a-f]{4}):([0-9a-f]{4})$/i)
  return match ? { vendorId: parseInt(match[1], 16), productId: parseInt(match[2], 16) } : null
}

async function printViaUsb(data: Uint8Array<ArrayBuffer>, address: string | null): Promise<PrintedOn> {
  const usb = navigatorWithDevices().usb
  if (!usb || !window.isSecureContext) throw new PrinterError('Este navegador no permite USB directo. Usa Chrome o Edge (https o localhost).')

  try {
    // Una impresora ya autorizada se reutiliza sin volver a mostrar el selector
    const saved = parseUsbAddress(address)
    const known = saved && (await usb.getDevices()).find((d) => d.vendorId === saved.vendorId && d.productId === saved.productId)
    const device = known ?? (await usb.requestDevice({ filters: [] }))

    await device.open()
    try {
      if (!device.configuration) await device.selectConfiguration(1)
      const target = findBulkOut(device.configuration?.interfaces ?? [])
      if (!target) throw new PrinterError('El dispositivo elegido no parece una impresora (no tiene salida USB de datos).')
      await device.claimInterface(target.interfaceNumber)
      try {
        const result = await device.transferOut(target.endpointNumber, data)
        if (result.status !== 'ok') throw new PrinterError(`La impresora rechazó los datos (${result.status}).`)
      } finally {
        await device.releaseInterface(target.interfaceNumber).catch(() => undefined)
      }
    } finally {
      await device.close().catch(() => undefined)
    }
    return { address: formatUsbAddress(device), name: device.productName || 'Impresora USB' }
  } catch (error) {
    throw toPrinterError(error, 'USB')
  }
}

/** Interfaz de impresora (clase 7) con endpoint bulk de salida; si no hay, cualquier bulk de salida. */
function findBulkOut(interfaces: UsbInterface[]) {
  const candidates = interfaces.flatMap((usbInterface) =>
    usbInterface.alternate.endpoints
      .filter((endpoint) => endpoint.direction === 'out' && endpoint.type === 'bulk')
      .map((endpoint) => ({
        interfaceNumber: usbInterface.interfaceNumber,
        endpointNumber: endpoint.endpointNumber,
        isPrinter: usbInterface.alternate.interfaceClass === USB_PRINTER_CLASS,
      })),
  )
  return candidates.find((candidate) => candidate.isPrinter) ?? candidates[0]
}

// ── Bluetooth (BLE) ─────────────────────────────────────────────────────────

/** Servicios GATT que usan las impresoras térmicas BLE más comunes (genéricas chinas, ISSC/Microchip, etc.) */
const PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb',
]

async function printViaBluetooth(data: Uint8Array<ArrayBuffer>): Promise<PrintedOn> {
  const bluetooth = navigatorWithDevices().bluetooth
  if (!bluetooth || !window.isSecureContext) {
    throw new PrinterError('Este navegador no permite Bluetooth directo. Usa Chrome o Edge (https o localhost).')
  }

  try {
    const device = await bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: PRINTER_SERVICES })
    if (!device.gatt) throw new PrinterError('El dispositivo elegido no admite conexión BLE.')
    const server = await device.gatt.connect()
    try {
      const characteristic = await findWritableCharacteristic(server)
      if (!characteristic) throw new PrinterError('El dispositivo no expone un canal de impresión BLE conocido.')
      // Con respuesta: el navegador fragmenta y confirma cada bloque. Sin respuesta: bloques de 20 bytes (MTU mínimo).
      const withResponse = characteristic.properties.write
      const chunkSize = withResponse ? 180 : 20
      for (let offset = 0; offset < data.length; offset += chunkSize) {
        const chunk = data.slice(offset, offset + chunkSize)
        await (withResponse ? characteristic.writeValueWithResponse(chunk) : characteristic.writeValueWithoutResponse(chunk))
      }
    } finally {
      server.disconnect()
    }
    return { address: device.name ?? null, name: device.name || 'Impresora Bluetooth' }
  } catch (error) {
    throw toPrinterError(error, 'Bluetooth')
  }
}

async function findWritableCharacteristic(server: BluetoothServer) {
  for (const service of await server.getPrimaryServices()) {
    for (const characteristic of await service.getCharacteristics()) {
      if (characteristic.properties.write || characteristic.properties.writeWithoutResponse) return characteristic
    }
  }
  return null
}

// ── Errores ─────────────────────────────────────────────────────────────────

function toPrinterError(error: unknown, kind: 'USB' | 'Bluetooth'): PrinterError {
  if (error instanceof PrinterError) return error
  if (error instanceof DOMException) {
    if (error.name === 'NotFoundError') return new PrinterError('No se eligió ninguna impresora.')
    if (error.name === 'SecurityError') return new PrinterError(`El navegador bloqueó el acceso ${kind}.`)
    if (kind === 'USB' && (error.name === 'NetworkError' || error.name === 'InvalidStateError')) {
      return new PrinterError(
        'El sistema operativo tiene tomada la impresora (driver o cola de impresión instalados). Quítala del sistema para usar USB directo, o usa "Imprimir con el navegador".',
      )
    }
    return new PrinterError(`Error ${kind}: ${error.message}`)
  }
  return new PrinterError(`No se pudo imprimir por ${kind}.`)
}
