import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  label: string
  value: ReactNode
  icon: LucideIcon
  hint?: ReactNode
  loading?: boolean
  tone?: 'default' | 'warning' | 'danger'
}

const TONES = {
  default: 'bg-primary/10 text-primary',
  warning: 'bg-amber-500/15 text-amber-600',
  danger: 'bg-destructive/10 text-destructive',
}

export function KpiCard({ label, value, icon: Icon, hint, loading, tone = 'default' }: KpiCardProps) {
  return (
    <Card className="py-5">
      <CardContent className="grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className={cn('grid size-8 place-items-center rounded-lg', TONES[tone])}>
            <Icon className="size-4" />
          </span>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-28" />
        ) : (
          <span className="font-heading text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
        )}
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </CardContent>
    </Card>
  )
}
