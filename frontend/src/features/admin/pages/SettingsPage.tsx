import { CreditCard, LoaderCircle, Printer, ReceiptText, RotateCcw, ScanBarcode, Store } from 'lucide-react'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { toast } from 'sonner'
import { TicketView } from '@/components/ticket/TicketView'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSeparator } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { getErrorMessage } from '@/lib/api/client'
import type { StoreSettings } from '@/lib/api/types'
import { formatDateTime, formatRate } from '@/lib/format'
import type { FieldErrors } from '../inventory/form-errors'
import { TAX_RATES } from '../inventory/product-form'
import { PrinterTestPanel } from '../settings/PrinterTestPanel'
import { sampleSale } from '../settings/sample-sale'
import {
  ADDRESS_HINT,
  PRINTER_CONNECTIONS,
  printerFromValues,
  SCANNER_MODES,
  SETTINGS_FIELDS,
  toFormValues,
  toSettingsErrors,
  toUpdatePayload,
  validateSettings,
  type SettingsField,
  type SettingsFormValues,
} from '../settings/settings-form'
import { useSettingsStore } from '../settings/settings-store'

export function SettingsPage() {
  const settings = useSettingsStore((state) => state.settings)
  const error = useSettingsStore((state) => state.error)
  const load = useSettingsStore((state) => state.load)

  // Siempre se recarga al entrar: otra pestaña o sesión pudo haberla cambiado
  useEffect(() => {
    void load()
  }, [load])

  if (!settings) {
    return error ? (
      <div className="grid justify-items-center gap-3 py-16 text-center">
        <p className="text-muted-foreground">{getErrorMessage(error)}</p>
        <Button variant="outline" onClick={() => void load()}>
          <RotateCcw /> Reintentar
        </Button>
      </div>
    ) : (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-6">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <Skeleton className="h-[28rem] rounded-xl" />
      </div>
    )
  }

  // key: al guardar (o recargar con cambios de otra sesión) el formulario se reinicia con lo guardado
  return <SettingsForm key={settings.updatedAt ?? 'sin-configurar'} settings={settings} />
}

function SettingsForm({ settings }: { settings: StoreSettings }) {
  const save = useSettingsStore((state) => state.save)
  const [values, setValues] = useState<SettingsFormValues>(() => toFormValues(settings))
  const [errors, setErrors] = useState<FieldErrors<SettingsField>>({})
  const [saving, setSaving] = useState(false)

  const set = <K extends SettingsField>(field: K, value: SettingsFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors(({ [field]: _cleared, ...rest }) => rest as FieldErrors<SettingsField>)
  }
  const changes = toUpdatePayload(values, settings)
  const dirty = Object.keys(changes).length > 0

  const printer = printerFromValues(values)
  const header = {
    businessName: values.businessName.trim() || settings.businessName,
    legalName: values.legalName.trim() || null,
    rfc: values.rfc.trim().toUpperCase() || null,
    address: values.address.trim(),
    phone: values.phone.trim() || null,
    ticketFooter: values.ticketFooter.trim() || null,
  }
  const [preview] = useState(sampleSale)
  const taxOptions = TAX_RATES.some((rate) => rate.value === values.defaultTaxRate)
    ? TAX_RATES
    : [...TAX_RATES, { value: values.defaultTaxRate, label: formatRate(Number(values.defaultTaxRate)) }]

  async function submit() {
    const found = validateSettings(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSaving(true)
    try {
      await save(changes)
      toast.success('Configuración guardada')
    } catch (cause) {
      const { fields, message } = toSettingsErrors(cause, SETTINGS_FIELDS)
      setErrors(fields)
      if (message) toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const field = (name: SettingsField, label: string, control: ReactNode, description?: ReactNode) => (
    <Field data-invalid={Boolean(errors[name])}>
      <FieldLabel htmlFor={`settings-${name}`}>{label}</FieldLabel>
      {control}
      {description && !errors[name] && <FieldDescription>{description}</FieldDescription>}
      <FieldError>{errors[name]}</FieldError>
    </Field>
  )
  type TextField = Extract<
    SettingsField,
    'businessName' | 'legalName' | 'rfc' | 'phone' | 'logoUrl' | 'printerAddress' | 'terminalProvider' | 'terminalId'
  >
  const text = (name: TextField, props: React.ComponentProps<typeof Input> = {}) => (
    <Input
      id={`settings-${name}`}
      value={values[name]}
      aria-invalid={Boolean(errors[name])}
      onChange={(event) => set(name, event.target.value)}
      {...props}
    />
  )

  return (
    <form
      className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="size-4 text-primary" /> Perfil del negocio
            </CardTitle>
            <CardDescription>Aparece en el encabezado de cada ticket, impreso o en la app del cliente.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                {field('businessName', 'Nombre comercial', text('businessName', { maxLength: 150 }))}
                {field('legalName', 'Razón social', text('legalName', { maxLength: 200, placeholder: 'Opcional' }))}
                {field(
                  'rfc',
                  'RFC',
                  text('rfc', {
                    maxLength: 13,
                    placeholder: 'Opcional',
                    className: 'uppercase',
                    onChange: (event) => set('rfc', event.target.value.toUpperCase()),
                  }),
                  '12 caracteres (persona moral) o 13 (persona física)',
                )}
                {field('phone', 'Teléfono', text('phone', { maxLength: 20, type: 'tel', placeholder: 'Opcional' }))}
              </div>
              {field(
                'address',
                'Dirección',
                <Textarea
                  id="settings-address"
                  rows={2}
                  maxLength={500}
                  value={values.address}
                  aria-invalid={Boolean(errors.address)}
                  onChange={(event) => set('address', event.target.value)}
                />,
              )}
              {field('logoUrl', 'Logotipo (URL)', text('logoUrl', { type: 'url', maxLength: 500, placeholder: 'https://…' }))}
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ReceiptText className="size-4 text-primary" /> Ventas e impuestos
            </CardTitle>
            <CardDescription>Los precios se capturan con IVA incluido, en pesos mexicanos (MXN).</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              {field(
                'defaultTaxRate',
                'IVA por defecto',
                <Select value={values.defaultTaxRate} onValueChange={(value) => set('defaultTaxRate', value)}>
                  <SelectTrigger id="settings-defaultTaxRate" className="w-full sm:w-72">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {taxOptions.map((rate) => (
                      <SelectItem key={rate.value} value={rate.value}>
                        {rate.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>,
                'Se propone al dar de alta productos; cada producto conserva su propia tasa.',
              )}
              {field(
                'ticketFooter',
                'Mensaje al pie del ticket',
                <Textarea
                  id="settings-ticketFooter"
                  rows={2}
                  maxLength={500}
                  placeholder="¡Gracias por su compra!"
                  value={values.ticketFooter}
                  onChange={(event) => set('ticketFooter', event.target.value)}
                />,
              )}
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer className="size-4 text-primary" /> Periféricos
            </CardTitle>
            <CardDescription>Impresora de tickets, lector de código de barras y terminal bancaria del mostrador.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-3">
                {field(
                  'printerConnection',
                  'Impresora térmica',
                  <Select
                    value={values.printerConnection}
                    onValueChange={(value) => set('printerConnection', value as SettingsFormValues['printerConnection'])}
                  >
                    <SelectTrigger id="settings-printerConnection" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRINTER_CONNECTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>,
                )}
                {field(
                  'paperWidthMm',
                  'Ancho de papel',
                  <Select value={values.paperWidthMm} onValueChange={(value) => set('paperWidthMm', value as '58' | '80')}>
                    <SelectTrigger id="settings-paperWidthMm" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="58">58 mm</SelectItem>
                      <SelectItem value="80">80 mm</SelectItem>
                    </SelectContent>
                  </Select>,
                )}
                {values.printerConnection !== 'NONE' &&
                  field(
                    'printerAddress',
                    'Dirección del dispositivo',
                    text('printerAddress', { maxLength: 100, placeholder: ADDRESS_HINT[values.printerConnection].placeholder }),
                    ADDRESS_HINT[values.printerConnection].description,
                  )}
              </div>
              <PrinterTestPanel
                printer={printer}
                header={header}
                onDetectedAddress={(address) => set('printerAddress', address)}
              />

              <FieldSeparator />

              {field(
                'scannerMode',
                'Lector de código de barras',
                <Select
                  value={values.scannerMode}
                  onValueChange={(value) => set('scannerMode', value as SettingsFormValues['scannerMode'])}
                >
                  <SelectTrigger id="settings-scannerMode" className="w-full sm:w-72">
                    <ScanBarcode />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCANNER_MODES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>,
                SCANNER_MODES.find((option) => option.value === values.scannerMode)?.description,
              )}

              <FieldSeparator />

              <div className="grid gap-4 sm:grid-cols-2">
                {field(
                  'terminalProvider',
                  'Terminal bancaria',
                  text('terminalProvider', { maxLength: 50, placeholder: 'Clip, Mercado Pago, Getnet…' }),
                  <span className="flex items-center gap-1">
                    <CreditCard className="size-3.5" /> Solo referencia: el cobro con tarjeta se registra en el POS.
                  </span>,
                )}
                {field('terminalId', 'ID de la terminal', text('terminalId', { maxLength: 50, placeholder: 'Opcional' }))}
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
          <p className="mr-auto text-xs text-muted-foreground">
            {dirty
              ? 'Tienes cambios sin guardar.'
              : settings.updatedAt
                ? `Última actualización: ${formatDateTime(settings.updatedAt)}`
                : 'La tienda aún no se ha configurado.'}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={!dirty || saving}
            onClick={() => {
              setValues(toFormValues(settings))
              setErrors({})
            }}
          >
            Descartar
          </Button>
          <Button type="submit" disabled={!dirty || saving}>
            {saving && <LoaderCircle className="animate-spin" />}
            Guardar cambios
          </Button>
        </div>
      </div>

      <aside className="grid gap-2 xl:sticky xl:top-20 print:static">
        <p className="text-sm font-medium">Vista previa del ticket</p>
        {/* --ticket-width: el diálogo de impresión usa el ancho del formulario, aunque no esté guardado */}
        <div className="mx-auto w-full" style={{ maxWidth: `${values.paperWidthMm}mm`, '--ticket-width': `${values.paperWidthMm}mm` } as CSSProperties}>
          <TicketView
          sale={preview}
          printable
          business={{
            name: header.businessName,
            legalName: header.legalName,
            rfc: header.rfc,
            address: header.address,
            phone: header.phone,
            logoUrl: values.logoUrl.trim() || null,
            footer: header.ticketFooter,
          }}
          />
        </div>
        <p className="text-center text-xs text-muted-foreground">Papel de {values.paperWidthMm} mm · venta de ejemplo</p>
      </aside>
    </form>
  )
}
