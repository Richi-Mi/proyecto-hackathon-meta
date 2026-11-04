import jsQR from 'jsqr'
import { Camera, CameraOff, DoorOpen, LoaderCircle, RefreshCw, UserCheck } from 'lucide-react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ApiError, getErrorMessage } from '@/lib/api/client'
import type { StoreEntryResponse } from '@/lib/api/types'
import { registerDoorEntry } from '../api'
import { useCamera, type Facing } from '../shelf/use-camera'

const SCAN_MS = 250
const GATE_ID = 'PUERTA-PRINCIPAL'

/** Puerta de la tienda: la laptop (o un teléfono) lee el QR de la app del cliente y abre su visita. */
export function DoorPage() {
  const { videoRef, state, error, start: startCamera, stop, pixels } = useCamera()
  const [facing, setFacing] = useState<Facing>('user')
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState<StoreEntryResponse | null>(null)
  const seenRef = useRef(new Set<string>())
  const busyRef = useRef(false)

  async function admit(token: string) {
    busyRef.current = true
    setBusy(true)
    try {
      const entry = await registerDoorEntry(token, GATE_ID)
      setLast(entry)
      toast.success(`¡Bienvenido, ${entry.user.name}!`, { description: 'Visita abierta: lo que tome se carga a su cuenta' })
    } catch (error) {
      const message =
        error instanceof ApiError && error.code === 'INVALID_ENTRY_TOKEN'
          ? 'El QR expiró o no es válido: que el cliente genere otro'
          : getErrorMessage(error)
      toast.error('No se pudo abrir la puerta', { description: message })
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const scan = useEffectEvent(() => {
    if (busyRef.current) return
    const frame = pixels()
    if (!frame) return
    const code = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' })
    if (code?.data && !seenRef.current.has(code.data)) {
      seenRef.current.add(code.data)
      void admit(code.data)
    }
  })

  useEffect(() => {
    if (state !== 'on') return
    const timer = window.setInterval(scan, SCAN_MS)
    return () => window.clearInterval(timer)
  }, [state])

  const start = (side: Facing) => {
    setFacing(side)
    void startCamera(side)
  }

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <div className="relative overflow-hidden rounded-2xl bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`aspect-video w-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`}
        />
        {state !== 'on' && (
          <div className="absolute inset-0 grid place-items-center text-white/70">
            <div className="grid justify-items-center gap-2 text-center text-sm">
              <DoorOpen className="size-10" />
              El cliente acerca su QR de la app a la cámara
            </div>
          </div>
        )}
        {state === 'on' && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="size-48 rounded-3xl border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
        )}
        {busy && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-md bg-sky-600 px-2 py-1 text-xs text-white">
            <LoaderCircle className="size-3 animate-spin" /> Validando QR…
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {state === 'on' ? (
          <>
            <Button variant="outline" onClick={stop}>
              <CameraOff /> Apagar
            </Button>
            <Button variant="outline" onClick={() => start(facing === 'user' ? 'environment' : 'user')}>
              <RefreshCw /> Cambiar cámara
            </Button>
          </>
        ) : (
          <Button onClick={() => start(facing)} disabled={state === 'starting'}>
            {state === 'starting' ? <LoaderCircle className="animate-spin" /> : <Camera />} Encender puerta
          </Button>
        )}
      </div>

      {last && (
        <Card className="border-emerald-500/40 bg-emerald-500/5 py-4">
          <CardContent className="flex items-center gap-3">
            <UserCheck className="size-8 text-emerald-600" />
            <div>
              <div className="font-medium">{last.user.name} está en la tienda</div>
              <div className="text-xs text-muted-foreground">
                Lo que la cámara de la repisa le vea tomar va a su carrito; se cobra cuando toque «Salir» en su app.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        El QR de la app se renueva cada 60 s y solo sirve una vez. Si no lo lee, sube el brillo del teléfono del cliente.
      </p>
    </div>
  )
}
