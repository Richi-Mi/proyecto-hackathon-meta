import { LoaderCircle, Plus, TriangleAlert } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { Category, Product } from '@/lib/api/types'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { createProduct, updateProduct } from '../api'
import { CategoryDialog } from './CategoryDialog'
import { toFieldErrors, type FieldErrors } from './form-errors'
import {
  marginPreview,
  PRODUCT_FIELDS,
  STATUS_OPTIONS,
  TAX_RATES,
  toCreatePayload,
  toFormValues,
  toUpdatePayload,
  validateProduct,
  type ProductField,
  type ProductFormValues,
} from './product-form'

const NEW_CATEGORY = '__new__'

interface ProductFormSheetProps {
  /** `null` = alta de producto nuevo */
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  /** IVA propuesto para productos nuevos (`defaultTaxRate` de /settings) */
  defaultTaxRate: number
  onCategoryCreated: () => void
  onSaved: (product: Product) => void
}

export function ProductFormSheet({ product, open, onOpenChange, ...props }: ProductFormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        {/* key: al cambiar de producto el formulario se reinicia con sus valores */}
        {open && <ProductForm key={product?.id ?? 'new'} product={product} onClose={() => onOpenChange(false)} {...props} />}
      </SheetContent>
    </Sheet>
  )
}

function ProductForm({
  product,
  categories,
  defaultTaxRate,
  onCategoryCreated,
  onSaved,
  onClose,
}: Omit<ProductFormSheetProps, 'open' | 'onOpenChange'> & { onClose: () => void }) {
  const mode = product ? 'edit' : 'create'
  const [values, setValues] = useState<ProductFormValues>(() => toFormValues(product ?? undefined, defaultTaxRate))
  const [errors, setErrors] = useState<FieldErrors<ProductField>>({})
  const [saving, setSaving] = useState(false)
  const [categoryDialog, setCategoryDialog] = useState(false)

  const set = <K extends ProductField>(field: K, value: ProductFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors(({ [field]: _cleared, ...rest }) => rest as FieldErrors<ProductField>)
  }
  const changes = product ? toUpdatePayload(values, product) : null
  const unchanged = changes !== null && Object.keys(changes).length === 0
  const margin = marginPreview(values)

  async function submit() {
    const found = validateProduct(values, mode)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSaving(true)
    try {
      const saved = product ? await updateProduct(product.id, changes!) : await createProduct(toCreatePayload(values))
      toast.success(product ? `"${saved.name}" actualizado` : `"${saved.name}" agregado al inventario`)
      onSaved(saved)
      onClose()
    } catch (cause) {
      const { fields, message } = toFieldErrors(cause, PRODUCT_FIELDS)
      setErrors(fields)
      if (message) toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const field = (name: ProductField, label: string, control: ReactNode, description?: ReactNode) => (
    <Field data-invalid={Boolean(errors[name])}>
      <FieldLabel htmlFor={`product-${name}`}>{label}</FieldLabel>
      {control}
      {description && !errors[name] && <FieldDescription>{description}</FieldDescription>}
      <FieldError>{errors[name]}</FieldError>
    </Field>
  )
  const text = (name: Extract<ProductField, 'id' | 'barcode' | 'name' | 'imageUrl'>, props: React.ComponentProps<typeof Input> = {}) => (
    <Input
      id={`product-${name}`}
      value={values[name]}
      aria-invalid={Boolean(errors[name])}
      onChange={(event) => set(name, event.target.value)}
      {...props}
    />
  )
  const number = (name: Extract<ProductField, 'price' | 'purchaseCost' | 'initialStock' | 'minStockAlert'>, step: string) => (
    <Input
      id={`product-${name}`}
      type="number"
      inputMode="decimal"
      min={0}
      step={step}
      value={values[name]}
      aria-invalid={Boolean(errors[name])}
      onChange={(event) => set(name, event.target.value)}
      className="tabular-nums"
    />
  )

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle>{product ? 'Editar producto' : 'Nuevo producto'}</SheetTitle>
        <SheetDescription>
          {product ? `SKU ${product.id} · el stock se modifica con entradas y ajustes.` : 'Se agrega al inventario y, si está activo, al POS.'}
        </SheetDescription>
      </SheetHeader>

      <form
        id="product-form"
        className="flex-1 overflow-y-auto px-4 py-5"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            {field(
              'id',
              'SKU',
              text('id', { disabled: mode === 'edit', autoFocus: mode === 'create', placeholder: 'REF-COLA-600', maxLength: 64 }),
              mode === 'create' ? 'No se puede cambiar después' : undefined,
            )}
            {field('barcode', 'Código de barras', text('barcode', { placeholder: 'Opcional', inputMode: 'numeric', maxLength: 64 }))}
          </div>
          {field('name', 'Nombre', text('name', { maxLength: 150, autoFocus: mode === 'edit' }))}
          {field(
            'description',
            'Descripción',
            <Textarea
              id="product-description"
              rows={2}
              maxLength={2000}
              value={values.description}
              onChange={(event) => set('description', event.target.value)}
            />,
          )}
          {field(
            'categoryId',
            'Categoría',
            <Select
              value={values.categoryId}
              onValueChange={(value) => (value === NEW_CATEGORY ? setCategoryDialog(true) : set('categoryId', value))}
            >
              <SelectTrigger id="product-categoryId" className="w-full" aria-invalid={Boolean(errors.categoryId)}>
                <SelectValue placeholder="Elige una categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: category.color }} />
                    {category.name}
                  </SelectItem>
                ))}
                <SelectSeparator />
                <SelectItem value={NEW_CATEGORY}>
                  <Plus /> Nueva categoría
                </SelectItem>
              </SelectContent>
            </Select>,
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            {field('price', 'Precio al público', number('price', '0.5'), 'IVA incluido')}
            {field('purchaseCost', 'Costo de compra', number('purchaseCost', '0.01'), 'Sin IVA')}
            {field(
              'taxRate',
              'IVA',
              <Select value={values.taxRate} onValueChange={(value) => set('taxRate', value)}>
                <SelectTrigger id="product-taxRate" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAX_RATES.map((rate) => (
                    <SelectItem key={rate.value} value={rate.value}>
                      {rate.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>,
            )}
          </div>

          {margin && (
            <div
              className={cn(
                'flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm',
                margin.margin < 0 ? 'bg-destructive/10 text-destructive' : 'bg-primary/5',
              )}
              aria-live="polite"
            >
              <span className="text-muted-foreground">
                Sin IVA: <span className="font-medium text-foreground tabular-nums">{formatMoney(margin.base)}</span>
              </span>
              <span className="flex items-center gap-1.5 font-medium tabular-nums">
                {margin.margin < 0 && <TriangleAlert className="size-4" />}
                Margen {formatMoney(margin.margin)} · {(margin.percent * 100).toFixed(1)} %
              </span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {mode === 'create' && field('initialStock', 'Stock inicial', number('initialStock', '1'), 'Genera una entrada en el kardex')}
            {field('minStockAlert', 'Stock mínimo', number('minStockAlert', '1'), 'Debajo de esto se marca como "stock bajo"')}
            {field(
              'status',
              'Estado',
              <Select value={values.status} onValueChange={(value) => set('status', value as ProductFormValues['status'])}>
                <SelectTrigger id="product-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>,
            )}
          </div>

          <Field orientation="horizontal" className="rounded-xl border px-4 py-3">
            <div className="grid flex-1 gap-1">
              <FieldLabel htmlFor="product-isQuickAccess">Acceso rápido en el POS</FieldLabel>
              <FieldDescription>Aparece en "Más vendidos" del catálogo de la caja.</FieldDescription>
            </div>
            <Switch
              id="product-isQuickAccess"
              checked={values.isQuickAccess}
              onCheckedChange={(checked) => set('isQuickAccess', checked)}
            />
          </Field>

          {field('imageUrl', 'Imagen (URL)', text('imageUrl', { type: 'url', placeholder: 'https://…', maxLength: 500 }))}
        </FieldGroup>
      </form>

      <SheetFooter className="flex-row justify-end gap-2 border-t">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" form="product-form" disabled={saving || unchanged}>
          {saving && <LoaderCircle className="animate-spin" />}
          {product ? 'Guardar cambios' : 'Agregar producto'}
        </Button>
      </SheetFooter>

      <CategoryDialog
        open={categoryDialog}
        onOpenChange={setCategoryDialog}
        nextSortOrder={Math.max(0, ...categories.map((category) => category.sortOrder)) + 1}
        onCreated={(category) => {
          onCategoryCreated()
          set('categoryId', category.id)
        }}
      />
    </>
  )
}
