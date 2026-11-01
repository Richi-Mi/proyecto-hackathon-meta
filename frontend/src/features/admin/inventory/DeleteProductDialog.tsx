import { useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { getErrorMessage } from '@/lib/api/client'
import type { Product } from '@/lib/api/types'
import { deleteProduct } from '../api'

interface DeleteProductDialogProps {
  product: Product | null
  onClose: () => void
  onDeleted: () => void
}

export function DeleteProductDialog({ product, onClose, onDeleted }: DeleteProductDialogProps) {
  const [deleting, setDeleting] = useState(false)

  async function confirm() {
    if (!product) return
    setDeleting(true)
    try {
      await deleteProduct(product.id)
      toast.success(`"${product.name}" se dio de baja`)
      onDeleted()
      onClose()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog open={product !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Dar de baja "{product?.name}"?</AlertDialogTitle>
          <AlertDialogDescription>
            Deja de aparecer en el inventario y en la caja. Su historial de ventas y movimientos se conserva y el SKU{' '}
            <span className="font-mono">{product?.id}</span> queda reservado. Si solo quieres ocultarlo de la caja, cámbialo a
            "Inactivo" desde Editar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleting}
            onClick={(event) => {
              // Mantener el diálogo abierto hasta que termine la petición
              event.preventDefault()
              void confirm()
            }}
          >
            Dar de baja
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
