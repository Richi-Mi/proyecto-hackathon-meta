import { RefreshCw, ScanLine, Sun, WifiOff } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@/features/auth/session-store'
import { useEntryPass, useNow } from '../use-entry-pass'

const QR_SIZE = 232
const RING_RADIUS = 10
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

export function EntryPassPage() {
  const firstName = useSession('customer')?.user.name.split(' ')[0]
  const { pass, status, error, refresh } = useEntryPass()
  const now = useNow()

  const secondsLeft = pass ? Math.max(0, Math.ceil((pass.expiresAt - now) / 1000)) : 0
  const lifetime = pass ? (pass.expiresAt - pass.issuedAt) / 1000 : 1
  const showQr = pass && status !== 'offline' && secondsLeft > 0

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-sm text-muted-foreground">Hola{firstName ? `, ${firstName}` : ''} 👋</p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Tu pase de entrada</h1>
      </div>

      <Card className="items-center gap-5 px-6 py-7">
        <div className="relative grid size-[264px] place-items-center rounded-3xl bg-white p-4 shadow-sm ring-1 ring-border">
          <AnimatePresence mode="popLayout" initial={false}>
            {showQr ? (
              <motion.div
                key={pass.token}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.04 }}
                transition={{ duration: 0.25 }}
              >
                <QRCodeSVG
                  value={pass.token}
                  size={QR_SIZE}
                  level="M"
                  marginSize={0}
                  title="Código QR de acceso a la tienda"
                />
              </motion.div>
            ) : status === 'loading' ? (
              <Skeleton key="loading" className="size-[232px] rounded-xl" />
            ) : (
              <motion.div key="problem" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid justify-items-center gap-3 text-center">
                {status === 'offline' ? (
                  <>
                    <WifiOff className="size-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Necesitas internet para generar tu pase.</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">{error ?? 'Tu pase expiró.'}</p>
                    <Button variant="outline" onClick={() => void refresh()}>
                      <RefreshCw /> Generar otro pase
                    </Button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
          {showQr ? (
            <>
              <svg viewBox="0 0 24 24" className="size-5 -rotate-90" aria-hidden>
                <circle cx="12" cy="12" r={RING_RADIUS} fill="none" className="stroke-muted" strokeWidth="3" />
                <motion.circle
                  cx="12"
                  cy="12"
                  r={RING_RADIUS}
                  fill="none"
                  className="stroke-primary"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={RING_LENGTH}
                  animate={{ strokeDashoffset: RING_LENGTH * (1 - secondsLeft / lifetime) }}
                  transition={{ duration: 1, ease: 'linear' }}
                />
              </svg>
              <span>
                Válido por <span className="font-medium text-foreground tabular-nums">{secondsLeft}s</span> · se renueva
                solo
              </span>
            </>
          ) : (
            <span>&nbsp;</span>
          )}
        </div>
      </Card>

      <div className="grid gap-3 rounded-2xl bg-muted/60 p-4 text-sm">
        <p className="flex items-start gap-3">
          <ScanLine className="mt-0.5 size-4 shrink-0 text-primary" />
          Acerca la pantalla al escáner de la entrada; la puerta se abre al leer tu código.
        </p>
        <p className="flex items-start gap-3">
          <Sun className="mt-0.5 size-4 shrink-0 text-primary" />
          Sube el brillo de tu teléfono si el escáner tarda en leerlo.
        </p>
      </div>
    </div>
  )
}
