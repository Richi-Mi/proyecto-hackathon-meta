import { CameraOff, DoorOpen, LoaderCircle, LogOut, ScanQrCode, UserRoundCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError, getErrorMessage } from '@/lib/api/client'
import type { StoreVisit } from '@/lib/api/types'
import { useApiQuery } from '@/lib/api/use-api-query'
import { cn } from '@/lib/utils'
import { admitAtGate, fetchStoreVisits } from '../api'
import { GateCheckoutDialog } from '../gate/GateCheckoutDialog'
import { createQrDecoder } from '../gate/qr-decoder'

const SCAN_MS = 250
const POLL_MS = 5000
/** Tiempo que se muestra el resultado antes de volver a escanear */
const WELCOME_MS = 3000
const ERROR_MS = 2500
const GATE_ID_KEY = 'gate.gateId'
const DEFAULT_GATE_ID = 'PUERTA-TELEFONO'

type Status = 'off' | 'starting' | 'scanning' | 'validating' | 'welcome' | 'rejected'
const STATUS_COPY: Record<Status, string> = {
  off: 'Cámara apagada',
  starting: 'Encendiendo…',
  scanning: 'Buscando un código QR',
  validating: 'Validando el pase…',
  welcome: 'Acceso concedido',
  rejected: 'Pase rechazado',
}

const readGateId = () => {
  try {
    return localStorage.getItem(GATE_ID_KEY) || DEFAULT_GATE_ID
  } catch {
    return DEFAULT_GATE_ID
  }
}

const timeFormat = new Intl.DateTimeFormat('es-MX', { timeStyle: 'short' })
const minutesSince = (iso: string, now: number) => Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000))

/**
 * Puerta de la tienda en el teléfono del propietario: lee el QR de la app del cliente y abre su visita.
 * Debajo, los clientes que están dentro; al salir, el propietario registra lo que se llevaron.
 */
export function GatePage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | undefined>(undefined)
  const resumeRef = useRef<number | undefined>(undefined)
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null)
  const decodeRef = useRef<((video: HTMLVideoElement) => Promise<string | null>) | null>(null)
  /** Mientras se valida o se muestra un resultado no se escanea */
  const busyRef = useRef(false)
  /** Último QR enviado: el mismo código frente a la cámara no se vuelve a mandar */
  const lastTokenRef = useRef<string | null>(null)
  const gateIdRef = useRef(readGateId())

  const [status, setStatus] = useState<Status>('off')
  const [gateId, setGateId] = useState(readGateId)
  const [message, setMessage] = useState<{ title: string; detail?: string } | null>(null)
  const [checkoutVisit, setCheckoutVisit] = useState<StoreVisit | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const secure = typeof window === 'undefined' || window.isSecureContext

  const visits = useApiQuery((signal) => fetchStoreVisits({ status: 'ACTIVE' }, signal), [])

  // En vivo: otros teléfonos (o el simulador) también abren y cierran visitas
  useEffect(() => {
    const timer = window.setInterval(() => {
      visits.reload()
      setNow(Date.now())
    }, POLL_MS)
    return () => window.clearInterval(timer)
  })

  useEffect(() => {
    gateIdRef.current = gateId
    try {
      localStorage.setItem(GATE_ID_KEY, gateId)
    } catch {
      // Sin almacenamiento (modo privado): solo no se recuerda la puerta
    }
  }, [gateId])

  // Al salir de la página se apaga la cámara
  useEffect(() => () => stopCamera(), [])

  /** Muestra el resultado unos segundos y vuelve a escanear */
  function showResult(next: 'welcome' | 'rejected', title: string, detail?: string) {
    setMessage({ title, detail })
    setStatus(next)
    window.clearTimeout(resumeRef.current)
    resumeRef.current = window.setTimeout(
      () => {
        busyRef.current = false
        setMessage(null)
        setStatus(streamRef.current ? 'scanning' : 'off')
      },
      next === 'welcome' ? WELCOME_MS : ERROR_MS,
    )
  }

  async function admit(token: string) {
    busyRef.current = true
    lastTokenRef.current = token
    setStatus('validating')
    try {
      const entry = await admitAtGate(token, gateIdRef.current.trim() || undefined)
      navigator.vibrate?.(120)
      toast.success(`Bienvenido, ${entry.user.name}`, { description: `Entrada por ${gateIdRef.current.trim() || DEFAULT_GATE_ID}` })
      showResult('welcome', `Bienvenido, ${entry.user.name}`, 'Puede pasar a la tienda')
      visits.reload()
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined
      const detail =
        code === 'INVALID_ENTRY_TOKEN'
          ? 'El QR no es válido o ya expiró: pide al cliente que lo actualice en su app'
          : code === 'ENTRY_TOKEN_REUSED'
            ? 'Este QR ya se usó: la app del cliente genera uno nuevo en unos segundos'
            : getErrorMessage(error)
      toast.error('Pase rechazado', { description: detail })
      showResult('rejected', 'Pase rechazado', detail)
    }
  }

  async function scan() {
    const video = videoRef.current
    if (busyRef.current || !video || !decodeRef.current) return
    busyRef.current = true
    let token: string | null = null
    try {
      token = await decodeRef.current(video)
    } finally {
      busyRef.current = false
    }
    if (token && token !== lastTokenRef.current) void admit(token)
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Este navegador no permite usar la cámara', { description: 'Abre la página en Safari o Chrome con https://' })
      return
    }
    setStatus('starting')
    try {
      decodeRef.current ??= await createQrDecoder()
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      const video = videoRef.current!
      video.srcObject = stream
      await video.play()
      busyRef.current = false
      lastTokenRef.current = null
      timerRef.current = window.setInterval(() => void scan(), SCAN_MS)
      setStatus('scanning')
      // Que la pantalla no se apague mientras la puerta está abierta (iOS 16.4+, Chrome)
      try {
        const wakeLock = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
        wakeLockRef.current = (await wakeLock?.request('screen')) ?? null
      } catch {
        // Sin wake lock: hay que desactivar el bloqueo automático a mano
      }
    } catch (error) {
      stopCamera()
      const denied = error instanceof DOMException && error.name === 'NotAllowedError'
      toast.error(denied ? 'Permiso de cámara denegado' : 'No se pudo abrir la cámara', {
        description: denied ? 'Actívalo en Ajustes → Safari → Cámara' : String(error),
      })
    }
  }

  function stopCamera() {
    window.clearInterval(timerRef.current)
    window.clearTimeout(resumeRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    void wakeLockRef.current?.release().catch(() => undefined)
    wakeLockRef.current = null
    busyRef.current = false
    setMessage(null)
    setStatus('off')
  }

  const on = status !== 'off' && status !== 'starting'
  const active = visits.data ?? []

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      {!secure && (
        <Card className="border-destructive/40 bg-destructive/5 py-4">
          <CardContent className="text-sm">
            La cámara solo funciona con <strong>https://</strong> (por ejemplo, la app desplegada en Railway) o en localhost.
          </CardContent>
        </Card>
      )}

      <div className="relative overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} playsInline muted autoPlay className="aspect-[4/3] w-full object-cover sm:aspect-video" />
        {!on && (
          <div className="absolute inset-0 grid place-items-center text-white/70">
            <div className="grid justify-items-center gap-2 px-6 text-center text-sm">
              <ScanQrCode className="size-10" />
              Enciende la cámara y apunta al QR que el cliente muestra en su app
            </div>
          </div>
        )}
        {on && (
          // Marco de encuadre: solo guía visual, se analiza el cuadro completo
          <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
            <div
              className={cn(
                'aspect-square w-3/5 max-w-72 rounded-3xl border-4 transition-colors',
                status === 'scanning' && 'border-white/80',
                status === 'validating' && 'border-sky-400',
                status === 'welcome' && 'border-emerald-500',
                status === 'rejected' && 'border-destructive',
              )}
            />
          </div>
        )}
        {message && (
          <div
            role="status"
            className={cn(
              'absolute inset-x-3 bottom-3 grid gap-0.5 rounded-xl px-4 py-3 text-white shadow-lg',
              status === 'welcome' ? 'bg-emerald-600' : 'bg-destructive',
            )}
          >
            <span className="font-heading text-lg font-semibold">{message.title}</span>
            {message.detail && <span className="text-sm text-white/90">{message.detail}</span>}
          </div>
        )}
        <div className="absolute top-3 left-3">
          <Badge
            className={cn(
              'gap-1.5 border-0 text-white',
              status === 'scanning' && 'bg-black/60',
              status === 'validating' && 'bg-sky-600',
              status === 'welcome' && 'bg-emerald-600',
              status === 'rejected' && 'bg-destructive',
              (status === 'off' || status === 'starting') && 'bg-black/60',
            )}
          >
            {(status === 'starting' || status === 'validating') && <LoaderCircle className="size-3 animate-spin" />}
            {STATUS_COPY[status]}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {on || status === 'starting' ? (
          <Button type="button" variant="outline" size="lg" onClick={stopCamera}>
            <CameraOff /> Apagar cámara
          </Button>
        ) : (
          <Button type="button" size="lg" onClick={() => void startCamera()} disabled={!secure}>
            <ScanQrCode /> Escanear entradas
          </Button>
        )}
        <div className="grid min-w-48 flex-1 gap-1.5">
          <Label htmlFor="gate-id">Puerta</Label>
          <Input id="gate-id" value={gateId} maxLength={64} onChange={(event) => setGateId(event.target.value)} />
        </div>
      </div>

      <section aria-labelledby="inside-title" className="grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="inside-title" className="flex items-center gap-2 font-heading text-lg font-semibold">
            <DoorOpen className="size-5" /> En la tienda ahora
          </h2>
          <Badge variant="secondary" className="tabular-nums">
            {visits.data ? active.length : '…'}
          </Badge>
        </div>

        {Boolean(visits.error) && !visits.data && <p className="text-sm text-destructive">{getErrorMessage(visits.error)}</p>}
        {!visits.data && !visits.error && <Skeleton className="h-20 rounded-xl" />}
        {visits.data && active.length === 0 && (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No hay clientes dentro. Escanea el QR de un cliente para abrir su visita.
          </p>
        )}

        <ul className="grid gap-2">
          {active.map((visit) => (
            <li key={visit.id}>
              <Card className="py-3">
                <CardContent className="flex flex-wrap items-center gap-3">
                  <UserRoundCheck className="size-5 shrink-0 text-emerald-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{visit.customer.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Entró a las {timeFormat.format(new Date(visit.enteredAt))} · hace {minutesSince(visit.enteredAt, now)} min ·{' '}
                      {visit.gateId}
                    </p>
                  </div>
                  <Button type="button" onClick={() => setCheckoutVisit(visit)}>
                    <LogOut /> Registrar salida
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <GateCheckoutDialog
        visit={checkoutVisit}
        onClose={() => setCheckoutVisit(null)}
        onDone={() => {
          setCheckoutVisit(null)
          visits.reload()
        }}
      />
    </div>
  )
}
