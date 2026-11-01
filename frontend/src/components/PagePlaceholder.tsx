import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface PagePlaceholderProps {
  icon: LucideIcon
  title: string
  description: string
  /** Bloque del plan en el que se construye la pantalla */
  milestone: string
}

/** Pantalla aún no construida: deja visible el layout y lo que vendrá. */
export function PagePlaceholder({ icon: Icon, title, description, milestone }: PagePlaceholderProps) {
  return (
    <Card className="border-dashed">
      <CardHeader className="items-start gap-3">
        <div className="flex w-full items-center justify-between gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" />
          </span>
          <Badge variant="secondary">{milestone}</Badge>
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  )
}
