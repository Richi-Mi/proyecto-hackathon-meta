import { LoaderCircle, ScanBarcode } from 'lucide-react'
import { useState, type KeyboardEvent, type RefObject } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { ApiError, getErrorMessage } from '@/lib/api/client'
import type { Product } from '@/lib/api/types'
import { lookupProduct } from '../api'

interface ScannerInputProps {
  inputRef: RefObject<HTMLInputElement | null>
  value: string
  onChange: (value: string) => void
  /** Catálogo ya cargado: un código conocido se agrega sin ir al servidor */
  catalog: Product[]
  onProduct: (product: Product) => void
}

/**
 * Los lectores de código de barras USB/Bluetooth "teclean" el código y envían Enter.
 * Enter = búsqueda exacta (código o SKU); escribir = filtra el catálogo.
 */
export function ScannerInput({ inputRef, value, onChange, catalog, onProduct }: ScannerInputProps) {
  const [looking, setLooking] = useState(false)

  async function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    const code = value.trim()
    if (!code) return
    event.preventDefault()

    const known = catalog.find((product) => product.barcode === code || product.id.toLowerCase() === code.toLowerCase())
    if (known) {
      onProduct(known)
      onChange('')
      return
    }
    setLooking(true)
    try {
      onProduct(await lookupProduct(code))
      onChange('')
    } catch (error) {
      toast.error(error instanceof ApiError && error.status === 404 ? `Ningún producto con el código "${code}"` : getErrorMessage(error))
    } finally {
      setLooking(false)
    }
  }

  return (
    <div className="relative">
      <ScanBarcode className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        autoFocus
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Escanea un código o busca por nombre…"
        aria-label="Lector de código de barras o búsqueda"
        className="h-12 pr-10 pl-11 text-base"
      />
      {looking && <LoaderCircle className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
    </div>
  )
}
