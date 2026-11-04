import { Camera, LoaderCircle, RefreshCw, ScanEye } from 'lucide-react'
import { useEffect, useEffectEvent, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getErrorMessage } from '@/lib/api/client'
import type { Product } from '@/lib/api/types'
import { identifyProduct } from '../api'
import { useCamera, type Facing } from '../shelf/use-camera'

/** Botón de la caja: en lugar del lector de código de barras, Muse Spark reconoce el producto con una foto. */
export function IdentifyProductButton({ onProduct }: { onProduct: (product: Product) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" className="h-12" onClick={() => setOpen(true)}>
        <ScanEye /> Identificar con cámara
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          {open && <IdentifyCamera onProduct={onProduct} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

function IdentifyCamera({ onProduct }: { onProduct: (product: Product) => void }) {
  const { videoRef, state, error, start, capture } = useCamera()
  const [facing, setFacing] = useState<Facing>('user')
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  // Solo al abrir el diálogo; el hook apaga la cámara al cerrarlo
  const startOnOpen = useEffectEvent(() => void start('user'))
  useEffect(() => startOnOpen(), [])

  async function identify() {
    const image = capture(1024)
    if (!image) return
    setBusy(true)
    setHint(null)
    try {
      const result = await identifyProduct(image)
      if (result.product && result.confidence >= 0.6) {
        onProduct(result.product)
        toast.success(`${result.product.name} agregado al ticket`, {
          description: `Confianza ${Math.round(result.confidence * 100)} %`,
        })
        setHint(`Último: ${result.product.name}. Acerca el siguiente producto.`)
      } else {
        setHint(
          result.product
            ? `¿Es ${result.product.name}? No estoy seguro (${Math.round(result.confidence * 100)} %). Acércalo con la etiqueta de frente.`
            : `No lo reconocí: ${result.reason || 'acércalo con la etiqueta de frente'}`,
        )
      }
    } catch (error) {
      toast.error('No se pudo identificar', { description: getErrorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Identificar con cámara</DialogTitle>
        <DialogDescription>Acerca el producto con la etiqueta de frente y toma la foto.</DialogDescription>
      </DialogHeader>
      <div className="relative overflow-hidden rounded-xl bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`aspect-video w-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Cambiar cámara"
          onClick={() => {
            const next = facing === 'user' ? 'environment' : 'user'
            setFacing(next)
            void start(next)
          }}
        >
          <RefreshCw />
        </Button>
        <Button className="flex-1" onClick={() => void identify()} disabled={busy || state !== 'on'}>
          {busy ? <LoaderCircle className="animate-spin" /> : <Camera />} {busy ? 'Identificando…' : 'Tomar foto e identificar'}
        </Button>
      </div>
    </>
  )
}
