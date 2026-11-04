import { CheckCircle2, ChevronLeft, ChevronRight, Clock, ScanEye, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage } from '@/lib/api/client'
import type { ShelfEventStatus } from '@/lib/api/types'
import { useApiQuery } from '@/lib/api/use-api-query'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { fetchShelfEvents, fetchShelfVisionStatus } from '../api'
import { KpiCard } from '../components/KpiCard'
import { describeShelfEvent, SHELF_REVIEW_REASON, SHELF_STATUS } from '../shelf/shelf-labels'
import { CurrentVisitCard } from '../shelf/CurrentVisitCard'
import { ShelfEventDialog } from '../shelf/ShelfEventDialog'

const PAGE_SIZE = 20
const POLL_MS = 3000
const ALL = 'all'

/** Bitácora en vivo de la cámara de repisa y cola de revisión del dueño. */
export function ShelfEventsPage() {
  const [status, setStatus] = useState<ShelfEventStatus | typeof ALL>(ALL)
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string | null>(null)

  const events = useApiQuery(
    (signal) => fetchShelfEvents({ status: status === ALL ? undefined : status, page, limit: PAGE_SIZE }, signal),
    [status, page],
  )
  const pending = useApiQuery((signal) => fetchShelfEvents({ status: 'PENDING_REVIEW', limit: 1 }, signal), [])
  const applied = useApiQuery((signal) => fetchShelfEvents({ status: 'APPLIED', limit: 1 }, signal), [])
  const vision = useApiQuery(fetchShelfVisionStatus, [])

  const refresh = () => {
    events.reload()
    pending.reload()
    applied.reload()
  }

  // En vivo: la cámara del teléfono va agregando eventos
  useEffect(() => {
    const timer = window.setInterval(refresh, POLL_MS)
    return () => window.clearInterval(timer)
  })

  const total = events.data?.meta.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="grid gap-6">
      <CurrentVisitCard onCheckout={refresh} />
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Por revisar"
          icon={Clock}
          tone="warning"
          loading={!pending.data}
          value={pending.data?.meta.total}
          hint="El stock no cambia hasta que confirmes"
        />
        <KpiCard
          label="Aplicados al inventario"
          icon={CheckCircle2}
          loading={!applied.data}
          value={applied.data?.meta.total}
        />
        <KpiCard
          label="Modelo de visión"
          icon={ScanEye}
          tone={vision.data && !vision.data.visionEnabled ? 'danger' : 'default'}
          loading={!vision.data}
          value={vision.data && (vision.data.visionEnabled ? 'Activo' : 'Sin configurar')}
          hint={vision.data?.model ?? 'Configura VISION_API_KEY en el servidor'}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as ShelfEventStatus | typeof ALL)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-52" aria-label="Filtrar por estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los eventos</SelectItem>
            {(Object.keys(SHELF_STATUS) as ShelfEventStatus[]).map((key) => (
              <SelectItem key={key} value={key}>
                {SHELF_STATUS[key].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-emerald-500" /> Actualización automática
        </span>
        <Button asChild variant="outline" className="ml-auto">
          <Link to="/admin/camera">
            <Smartphone /> Abrir cámara
          </Link>
        </Button>
      </div>

      {events.error ? (
        <div className="grid justify-items-center gap-3 rounded-xl border p-10 text-center">
          <p className="text-sm text-muted-foreground">{getErrorMessage(events.error)}</p>
          <Button variant="outline" onClick={refresh}>
            Reintentar
          </Button>
        </div>
      ) : !events.data ? (
        <div className="grid gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : events.data.data.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-xl border p-10 text-center text-sm text-muted-foreground">
          <ScanEye className="size-8" />
          Aún no hay eventos. Abre la cámara en el teléfono y toma o deja un producto en la repisa.
        </div>
      ) : (
        <div className="grid gap-2">
          {events.data.data.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => setOpenId(event.id)}
              className={cn(
                'flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors hover:bg-muted/60',
                event.status === 'PENDING_REVIEW' && 'border-amber-500/50 bg-amber-500/5',
              )}
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{describeShelfEvent(event)}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {formatDateTime(event.capturedAt)} · {event.cameraId}
                  {event.visitId && ' · carrito del cliente'}
                  {event.confidence !== null && ` · confianza ${Math.round(event.confidence * 100)} %`}
                  {event.reviewReason && ` · ${SHELF_REVIEW_REASON[event.reviewReason]}`}
                </div>
              </div>
              <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-xs font-medium', SHELF_STATUS[event.status].className)}>
                {SHELF_STATUS[event.status].label}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          {total} evento{total === 1 ? '' : 's'}
        </span>
        <div className="flex items-center gap-2">
          <span>
            Página {page} de {pages}
          </span>
          <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Página anterior">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Página siguiente">
            <ChevronRight />
          </Button>
        </div>
      </div>

      <ShelfEventDialog eventId={openId} onClose={() => setOpenId(null)} onResolved={refresh} />
    </div>
  )
}
