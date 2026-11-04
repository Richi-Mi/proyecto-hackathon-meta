import { Camera, CameraOff, Hand, ImageDown, LoaderCircle, ScanEye, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getErrorMessage } from '@/lib/api/client'
import type { ShelfEvent } from '@/lib/api/types'
import { useApiQuery } from '@/lib/api/use-api-query'
import { cn } from '@/lib/utils'
import { createShelfEvent, fetchShelfVisionStatus } from '../api'
import {
  DEFAULT_MOTION_SETTINGS,
  MotionDetector,
  SAMPLE_HEIGHT,
  SAMPLE_WIDTH,
  toGray,
  type MotionSettings,
} from '../shelf/motion-detector'
import { describeShelfEvent, SHELF_REVIEW_REASON, SHELF_STATUS } from '../shelf/shelf-labels'

const TICK_MS = 160
/** Ancho de la foto que se manda al modelo: suficiente para leer etiquetas, ligera para subir por datos móviles */
const CAPTURE_WIDTH = 1024
const CAMERA_ID_KEY = 'shelfsight.cameraId'

type Sensitivity = 'low' | 'medium' | 'high'
const SENSITIVITY: Record<Sensitivity, { label: string; settings: MotionSettings }> = {
  low: { label: 'Baja (repisa con mucho movimiento)', settings: { ...DEFAULT_MOTION_SETTINGS, motionRatio: 0.03, changeRatio: 0.015 } },
  medium: { label: 'Media', settings: DEFAULT_MOTION_SETTINGS },
  high: { label: 'Alta (productos chicos)', settings: { ...DEFAULT_MOTION_SETTINGS, motionRatio: 0.008, changeRatio: 0.004 } },
}

type Status = 'off' | 'starting' | 'watching' | 'motion' | 'analyzing'
const STATUS_COPY: Record<Status, string> = {
  off: 'Cámara apagada',
  starting: 'Encendiendo…',
  watching: 'Vigilando la repisa',
  motion: 'Movimiento: esperando a que termine',
  analyzing: 'Analizando con el modelo de visión…',
}

const readCameraId = () => {
  try {
    return localStorage.getItem(CAMERA_ID_KEY) || 'iphone-repisa-1'
  } catch {
    return 'iphone-repisa-1'
  }
}

/**
 * ShelfSight en un teléfono: abre la cámara trasera, detecta cuando alguien toma o deja algo
 * y manda la foto de antes y la de después al servidor.
 */
export function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | undefined>(undefined)
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null)
  const detectorRef = useRef(new MotionDetector<string>())
  const sampleCanvas = useRef<HTMLCanvasElement | null>(null)
  const captureCanvas = useRef<HTMLCanvasElement | null>(null)
  const pendingRef = useRef(0)
  // El intervalo de la cámara se crea una vez: lee el nombre vigente desde aquí
  const cameraIdRef = useRef(readCameraId())

  const [status, setStatus] = useState<Status>('off')
  const [cameraId, setCameraId] = useState(readCameraId)
  const [sensitivity, setSensitivity] = useState<Sensitivity>('medium')
  const [lastChange, setLastChange] = useState<number | null>(null)
  const [recent, setRecent] = useState<ShelfEvent[]>([])
  const [manualBefore, setManualBefore] = useState<string | null>(null)
  const vision = useApiQuery(fetchShelfVisionStatus, [])
  const secure = typeof window === 'undefined' || window.isSecureContext

  useEffect(() => {
    detectorRef.current.settings = SENSITIVITY[sensitivity].settings
  }, [sensitivity])

  useEffect(() => {
    cameraIdRef.current = cameraId
    try {
      localStorage.setItem(CAMERA_ID_KEY, cameraId)
    } catch {
      // Sin almacenamiento (modo privado): solo no se recuerda el nombre
    }
  }, [cameraId])

  // Al salir de la página se apaga la cámara
  useEffect(() => () => stopCamera(), [])

  function captureJpeg(): string {
    const video = videoRef.current!
    const canvas = (captureCanvas.current ??= document.createElement('canvas'))
    const scale = Math.min(1, CAPTURE_WIDTH / video.videoWidth)
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.82)
  }

  function sampleGray(): Uint8Array | null {
    const video = videoRef.current
    if (!video || video.readyState < 2 || !video.videoWidth) return null
    const canvas = (sampleCanvas.current ??= Object.assign(document.createElement('canvas'), {
      width: SAMPLE_WIDTH,
      height: SAMPLE_HEIGHT,
    }))
    const context = canvas.getContext('2d', { willReadFrequently: true })!
    context.drawImage(video, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT)
    return toGray(context.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT).data)
  }

  async function send(before: string, after: string, change: number | undefined) {
    pendingRef.current++
    setStatus('analyzing')
    try {
      const event = await createShelfEvent({
        cameraId: cameraIdRef.current.trim() || 'camara',
        capturedAt: new Date().toISOString(),
        ...(change !== undefined && { changeRatio: Math.min(1, Number(change.toFixed(4))) }),
        beforeImage: before,
        afterImage: after,
      })
      setRecent((current) => [event, ...current].slice(0, 6))
      const title = describeShelfEvent(event)
      if (event.status === 'APPLIED')
        toast.success(title, { description: event.visitId ? 'Agregado al carrito del cliente' : 'Inventario actualizado' })
      else if (event.status === 'PENDING_REVIEW')
        toast.warning(title, { description: event.reviewReason ? SHELF_REVIEW_REASON[event.reviewReason] : 'Por revisar' })
      else toast.info('Sin cambio en la repisa', { description: event.note ?? undefined })
    } catch (error) {
      toast.error('No se pudo enviar el evento', { description: getErrorMessage(error) })
    } finally {
      pendingRef.current--
      if (pendingRef.current === 0) setStatus(streamRef.current ? 'watching' : 'off')
    }
  }

  function tick() {
    const gray = sampleGray()
    if (!gray) return
    const result = detectorRef.current.push(gray, performance.now(), captureJpeg)
    if (result.kind === 'started' && pendingRef.current === 0) setStatus('motion')
    if (result.kind === 'discarded') {
      setLastChange(result.change)
      if (pendingRef.current === 0) setStatus('watching')
    }
    if (result.kind === 'event') {
      setLastChange(result.change)
      void send(result.before, result.after, result.change)
    }
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Este navegador no permite usar la cámara', { description: 'Abre la página en Safari o Chrome con https://' })
      return
    }
    setStatus('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      streamRef.current = stream
      const video = videoRef.current!
      video.srcObject = stream
      await video.play()
      detectorRef.current.reset()
      timerRef.current = window.setInterval(tick, TICK_MS)
      setStatus('watching')
      // Que la pantalla no se apague mientras vigila (iOS 16.4+, Chrome)
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
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    void wakeLockRef.current?.release().catch(() => undefined)
    wakeLockRef.current = null
    setManualBefore(null)
    setStatus('off')
  }

  const on = status !== 'off' && status !== 'starting'

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      {!secure && (
        <Card className="border-destructive/40 bg-destructive/5 py-4">
          <CardContent className="text-sm">
            La cámara solo funciona con <strong>https://</strong> (por ejemplo, la app desplegada en Railway) o en localhost.
          </CardContent>
        </Card>
      )}
      {vision.data && !vision.data.visionEnabled && (
        <Card className="border-amber-500/40 bg-amber-500/5 py-4">
          <CardContent className="text-sm">
            No hay modelo de visión configurado (<code>VISION_API_KEY</code> en el servidor). Los eventos se guardan y quedan
            en <strong>Repisa en vivo</strong> para revisarlos a mano.
          </CardContent>
        </Card>
      )}

      <div className="relative overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} playsInline muted autoPlay className="aspect-video w-full object-contain" />
        {!on && (
          <div className="absolute inset-0 grid place-items-center text-white/70">
            <div className="grid justify-items-center gap-2 text-sm">
              <Camera className="size-10" />
              Apunta el teléfono a la repisa y enciende la cámara
            </div>
          </div>
        )}
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2">
          <Badge
            className={cn(
              'gap-1.5 border-0 text-white',
              status === 'watching' && 'bg-emerald-600',
              status === 'motion' && 'bg-amber-500',
              status === 'analyzing' && 'bg-sky-600',
              (status === 'off' || status === 'starting') && 'bg-black/60',
            )}
          >
            {status === 'analyzing' && <LoaderCircle className="size-3 animate-spin" />}
            {status === 'motion' && <Hand className="size-3" />}
            {status === 'watching' && <ScanEye className="size-3" />}
            {STATUS_COPY[status]}
          </Badge>
          {lastChange !== null && on && (
            <Badge className="border-0 bg-black/60 text-white tabular-nums">Cambio {(lastChange * 100).toFixed(1)} %</Badge>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {on ? (
          <Button variant="outline" onClick={stopCamera}>
            <CameraOff /> Apagar cámara
          </Button>
        ) : (
          <Button onClick={() => void startCamera()} disabled={status === 'starting' || !secure}>
            {status === 'starting' ? <LoaderCircle className="animate-spin" /> : <Camera />} Encender cámara
          </Button>
        )}
        {on &&
          (manualBefore ? (
            <Button
              variant="secondary"
              onClick={() => {
                const before = manualBefore
                setManualBefore(null)
                void send(before, captureJpeg(), undefined)
              }}
            >
              <Sparkles /> Foto DESPUÉS y analizar
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setManualBefore(captureJpeg())}>
              <ImageDown /> Foto ANTES (modo manual)
            </Button>
          ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="camera-id">Nombre de esta cámara</Label>
          <Input id="camera-id" value={cameraId} maxLength={64} onChange={(event) => setCameraId(event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Sensibilidad</Label>
          <Select value={sensitivity} onValueChange={(value) => setSensitivity(value as Sensitivity)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SENSITIVITY) as Sensitivity[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {SENSITIVITY[key].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {vision.data?.visionEnabled && (
        <p className="text-xs text-muted-foreground">
          Modelo: {vision.data.model} · se aplica solo con confianza ≥ {Math.round(vision.data.autoApplyConfidence * 100)} % y
          hasta {vision.data.maxAutoQuantity} piezas por evento.
        </p>
      )}

      {recent.length > 0 && (
        <div className="grid gap-2">
          <h2 className="text-sm font-medium">Últimos eventos de esta cámara</h2>
          {recent.map((event) => (
            <div key={event.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{describeShelfEvent(event)}</div>
                {event.note && <div className="truncate text-xs text-muted-foreground">{event.note}</div>}
              </div>
              <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-xs font-medium', SHELF_STATUS[event.status].className)}>
                {SHELF_STATUS[event.status].label}
              </span>
            </div>
          ))}
        </div>
      )}

      <details className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">Consejos para el iPhone</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Ponlo en un tripié o soporte fijo: si la cámara se mueve, cuenta como movimiento.</li>
          <li>Encuadra solo la repisa, con luz pareja y sin reflejos.</li>
          <li>Déjalo conectado al cargador y desactiva el bloqueo automático (Ajustes → Pantalla y brillo).</li>
          <li>Si algo falla, usa el modo manual: foto ANTES, toma o deja el producto, foto DESPUÉS.</li>
        </ul>
      </details>
    </div>
  )
}
