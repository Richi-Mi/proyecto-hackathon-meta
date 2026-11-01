import { Check, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { Category } from '@/lib/api/types'
import { cn } from '@/lib/utils'
import { createCategory } from '../api'
import { toFieldErrors } from './form-errors'

const SWATCHES = ['#2563EB', '#16A34A', '#F59E0B', '#DC2626', '#7C3AED', '#0891B2', '#D97706', '#DB2777', '#4B5563']

interface CategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (category: Category) => void
  /** La categoría nueva va al final del catálogo del POS */
  nextSortOrder: number
}

export function CategoryDialog({ open, onOpenChange, onCreated, nextSortOrder }: CategoryDialogProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(SWATCHES[0]!)
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const close = (next: boolean) => {
    if (!next) {
      setName('')
      setError(undefined)
    }
    onOpenChange(next)
  }

  async function save() {
    if (!name.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    setSaving(true)
    try {
      const category = await createCategory({ name: name.trim(), color, sortOrder: nextSortOrder })
      toast.success(`Categoría "${category.name}" creada`)
      onCreated(category)
      close(false)
    } catch (cause) {
      const { fields, message } = toFieldErrors(cause, ['name'] as const)
      setError(fields.name)
      if (message) toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nueva categoría</DialogTitle>
          <DialogDescription>El color identifica a la categoría en el catálogo del POS.</DialogDescription>
        </DialogHeader>
        <form
          id="category-form"
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="category-name">Nombre</FieldLabel>
            <Input
              id="category-name"
              autoFocus
              maxLength={60}
              value={name}
              aria-invalid={Boolean(error)}
              onChange={(event) => setName(event.target.value)}
            />
            <FieldError>{error}</FieldError>
          </Field>
          <Field>
            <FieldLabel>Color</FieldLabel>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color de la categoría">
              {SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  role="radio"
                  aria-checked={color === swatch}
                  aria-label={swatch}
                  onClick={() => setColor(swatch)}
                  className={cn(
                    'grid size-8 place-items-center rounded-full text-white ring-offset-2 ring-offset-background transition',
                    color === swatch && 'ring-2 ring-ring',
                  )}
                  style={{ backgroundColor: swatch }}
                >
                  {color === swatch && <Check className="size-4" />}
                </button>
              ))}
            </div>
          </Field>
        </form>
        <DialogFooter>
          <Button type="submit" form="category-form" disabled={saving}>
            {saving && <LoaderCircle className="animate-spin" />}
            Crear categoría
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
