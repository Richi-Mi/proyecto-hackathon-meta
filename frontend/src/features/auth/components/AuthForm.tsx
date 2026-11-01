import { LoaderCircle } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getErrorMessage } from '@/lib/api/client'

export interface AuthField {
  name: string
  label: string
  type: 'text' | 'email' | 'password'
  autoComplete: string
  minLength?: number
  placeholder?: string
}

interface AuthFormProps {
  fields: AuthField[]
  submitLabel: string
  /** Recibe los valores del formulario; si lanza, se muestra el mensaje del error como toast. */
  onSubmit: (values: Record<string, string>) => Promise<void>
  footer?: ReactNode
}

export function AuthForm({ fields, submitLabel, onSubmit, footer }: AuthFormProps) {
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = Object.fromEntries(
      [...new FormData(event.currentTarget)].map(([key, value]) => [key, String(value)]),
    )
    setPending(true)
    try {
      await onSubmit(values)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      {fields.map((field) => (
        <div key={field.name} className="grid gap-2">
          <Label htmlFor={field.name}>{field.label}</Label>
          <Input
            id={field.name}
            name={field.name}
            type={field.type}
            autoComplete={field.autoComplete}
            minLength={field.minLength}
            placeholder={field.placeholder}
            required
            disabled={pending}
            className="h-11"
          />
        </div>
      ))}
      <Button type="submit" size="lg" className="mt-2 h-11" disabled={pending}>
        {pending && <LoaderCircle className="animate-spin" />}
        {submitLabel}
      </Button>
      {footer}
    </form>
  )
}
