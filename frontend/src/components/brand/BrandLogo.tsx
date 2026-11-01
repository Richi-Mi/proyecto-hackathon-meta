import { cn } from '@/lib/utils'

interface BrandLogoProps {
  className?: string
  /** Oculta el nombre (sidebar colapsado, headers compactos) */
  iconOnly?: boolean
  subtitle?: string
}

export function BrandLogo({ className, iconOnly = false, subtitle }: BrandLogoProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <img src="/logo.svg" alt="" className="size-8 shrink-0 rounded-lg" />
      {!iconOnly && (
        <div className="grid leading-tight">
          <span className="font-heading text-base font-semibold tracking-tight">Smart Abarrotes</span>
          {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        </div>
      )}
    </div>
  )
}
