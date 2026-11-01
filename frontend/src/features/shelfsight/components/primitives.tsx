import { ScanEye, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Etiqueta de precio que abre cada sección. */
export function Tag({ children }: { children: ReactNode }) {
  return <span className="sf-tag">{children}</span>
}

export function SectionIntro({ tag, title, lead }: { tag: string; title: string; lead?: string }) {
  return (
    <>
      <Tag>{tag}</Tag>
      <h2 className="sf-wide sf-h2 mt-5 max-w-3xl">{title}</h2>
      {lead && <p className="sf-lead mt-4 text-(--sf-muted)">{lead}</p>}
    </>
  )
}

export function IconTile({ icon: Icon, accent = false }: { icon: LucideIcon; accent?: boolean }) {
  return (
    <span
      className={cn(
        'grid size-11 shrink-0 place-items-center rounded-[10px]',
        accent ? 'bg-(--sf-accent) text-(--sf-accent-ink)' : 'bg-(--sf-surface-2) text-(--sf-ink)',
      )}
    >
      <Icon className="size-5" strokeWidth={1.75} aria-hidden />
    </span>
  )
}

export function BrandMark() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-[8px] bg-(--sf-accent) text-(--sf-accent-ink)">
        <ScanEye className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="sf-wide text-xl">ShelfSight</span>
    </span>
  )
}
