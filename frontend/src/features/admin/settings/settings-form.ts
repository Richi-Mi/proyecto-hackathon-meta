import { ApiError, getErrorMessage } from '@/lib/api/client'
import type { Peripherals, PrinterSettings, StoreSettings, StoreSettingsUpdate } from '@/lib/api/types'
import type { FieldErrors } from '../inventory/form-errors'

type ScannerMode = NonNullable<Peripherals['barcodeScanner']>['mode']

/** Valores del formulario como texto (lo que el usuario teclea); se convierten al guardar. */
export interface SettingsFormValues {
  businessName: string
  legalName: string
  rfc: string
  address: string
  phone: string
  logoUrl: string
  defaultTaxRate: string
  ticketFooter: string
  printerConnection: PrinterSettings['connection']
  printerAddress: string
  paperWidthMm: '58' | '80'
  scannerMode: ScannerMode
  terminalProvider: string
  terminalId: string
}

export type SettingsField = keyof SettingsFormValues

export const SETTINGS_FIELDS = [
  'businessName',
  'legalName',
  'rfc',
  'address',
  'phone',
  'logoUrl',
  'defaultTaxRate',
  'ticketFooter',
  'printerConnection',
  'printerAddress',
  'paperWidthMm',
  'scannerMode',
  'terminalProvider',
  'terminalId',
] as const satisfies readonly SettingsField[]

export const PRINTER_CONNECTIONS: { value: PrinterSettings['connection']; label: string }[] = [
  { value: 'USB', label: 'USB' },
  { value: 'BLUETOOTH', label: 'Bluetooth' },
  { value: 'NETWORK', label: 'Red (IP)' },
  { value: 'NONE', label: 'Sin impresora térmica' },
]

export const ADDRESS_HINT: Record<PrinterSettings['connection'], { placeholder: string; description: string }> = {
  USB: { placeholder: '0416:5011', description: 'vendorId:productId en hexadecimal; se llena al probar la impresora' },
  BLUETOOTH: { placeholder: 'Nombre o MAC', description: 'El navegador no expone la MAC; se guarda el nombre del dispositivo al probar' },
  NETWORK: { placeholder: '192.168.1.50:9100', description: 'IP y puerto de la impresora (normalmente 9100)' },
  NONE: { placeholder: '', description: '' },
}

export const SCANNER_MODES: { value: ScannerMode; label: string; description: string }[] = [
  { value: 'KEYBOARD_WEDGE', label: 'Lector USB (teclado)', description: 'Escribe el código y Enter en el campo del POS' },
  { value: 'BLUETOOTH', label: 'Lector Bluetooth', description: 'Emparejado con el sistema; también funciona como teclado' },
  { value: 'CAMERA', label: 'Cámara del dispositivo', description: 'Para tabletas o teléfonos sin lector' },
]

/** Mismo formato que StoreSettingsUpdate.rfc en docs/specs/openapi.yaml */
const RFC_PATTERN = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/i

export function toFormValues(settings: StoreSettings): SettingsFormValues {
  const { printer, barcodeScanner, cardTerminal } = settings.peripherals
  return {
    businessName: settings.businessName,
    legalName: settings.legalName ?? '',
    rfc: settings.rfc ?? '',
    address: settings.address,
    phone: settings.phone ?? '',
    logoUrl: settings.logoUrl ?? '',
    defaultTaxRate: String(settings.defaultTaxRate),
    ticketFooter: settings.ticketFooter ?? '',
    printerConnection: printer?.connection ?? 'NONE',
    printerAddress: printer?.address ?? '',
    paperWidthMm: printer?.paperWidthMm === 58 ? '58' : '80',
    scannerMode: barcodeScanner?.mode ?? 'KEYBOARD_WEDGE',
    terminalProvider: cardTerminal?.provider ?? '',
    terminalId: cardTerminal?.terminalId ?? '',
  }
}

/** Mismas reglas que StoreSettingsUpdate en docs/specs/openapi.yaml */
export function validateSettings(values: SettingsFormValues): FieldErrors<SettingsField> {
  const errors: FieldErrors<SettingsField> = {}
  if (!values.businessName.trim()) errors.businessName = 'El nombre comercial es obligatorio'
  if (!values.address.trim()) errors.address = 'La dirección es obligatoria (sale en el ticket)'
  if (values.rfc.trim() && !RFC_PATTERN.test(values.rfc.trim())) errors.rfc = 'RFC inválido: 12 caracteres (moral) o 13 (física)'
  if (values.logoUrl.trim() && !URL.canParse(values.logoUrl.trim())) errors.logoUrl = 'URL inválida'
  return errors
}

const optional = (value: string) => value.trim() || null

export function printerFromValues(values: SettingsFormValues): PrinterSettings {
  return {
    connection: values.printerConnection,
    address: values.printerConnection === 'NONE' ? null : optional(values.printerAddress),
    paperWidthMm: Number(values.paperWidthMm) as PrinterSettings['paperWidthMm'],
  }
}

function toPayload(values: SettingsFormValues) {
  return {
    businessName: values.businessName.trim(),
    legalName: optional(values.legalName),
    rfc: optional(values.rfc)?.toUpperCase() ?? null,
    address: values.address.trim(),
    phone: optional(values.phone),
    logoUrl: optional(values.logoUrl),
    defaultTaxRate: Number(values.defaultTaxRate),
    ticketFooter: optional(values.ticketFooter),
  }
}

function devicesFromValues(values: SettingsFormValues): Required<Peripherals> {
  return {
    printer: printerFromValues(values),
    barcodeScanner: { mode: values.scannerMode },
    cardTerminal: { provider: optional(values.terminalProvider), terminalId: optional(values.terminalId) },
  }
}

/**
 * PATCH parcial: solo los campos que cambiaron. En `peripherals` va cada dispositivo modificado completo
 * (el servidor reemplaza los enviados y conserva los demás).
 */
export function toUpdatePayload(values: SettingsFormValues, original: StoreSettings): StoreSettingsUpdate {
  const originalValues = toFormValues(original)
  const next = toPayload(values)
  const current = toPayload(originalValues)
  const changes: StoreSettingsUpdate = Object.fromEntries(
    Object.entries(next).filter(([key, value]) => current[key as keyof typeof current] !== value),
  )

  const nextDevices = devicesFromValues(values)
  const currentDevices = devicesFromValues(originalValues)
  const peripherals = Object.fromEntries(
    Object.entries(nextDevices).filter(
      ([key, device]) => JSON.stringify(device) !== JSON.stringify(currentDevices[key as keyof Peripherals]),
    ),
  )
  if (Object.keys(peripherals).length > 0) changes.peripherals = peripherals
  return changes
}

/** Rutas de error del servidor (JSON pointer) → campo del formulario */
const FIELD_BY_PATH: Record<string, SettingsField> = {
  '/peripherals/printer/address': 'printerAddress',
  '/peripherals/printer/paperWidthMm': 'paperWidthMm',
  '/peripherals/printer/connection': 'printerConnection',
  '/peripherals/barcodeScanner/mode': 'scannerMode',
  '/peripherals/cardTerminal/provider': 'terminalProvider',
  '/peripherals/cardTerminal/terminalId': 'terminalId',
}

/** Convierte un error de la API en errores por campo y un mensaje general para lo demás. */
export function toSettingsErrors(error: unknown, fields: readonly SettingsField[]) {
  if (!(error instanceof ApiError)) return { fields: {}, message: getErrorMessage(error) }
  const known = new Set<string>(fields)
  const found: FieldErrors<SettingsField> = {}
  if (error.code === 'VALIDATION_ERROR' && Array.isArray(error.details)) {
    for (const issue of error.details as { path?: string; message?: string }[]) {
      const field = issue.path && (FIELD_BY_PATH[issue.path] ?? issue.path.slice(1))
      if (field && known.has(field)) found[field as SettingsField] ??= issue.message ?? 'Valor inválido'
    }
  }
  return Object.keys(found).length > 0 ? { fields: found } : { fields: found, message: error.message }
}
