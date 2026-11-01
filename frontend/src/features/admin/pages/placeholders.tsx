import { ReceiptText, Settings } from 'lucide-react'
import { PagePlaceholder } from '@/components/PagePlaceholder'

// Pantallas del panel pendientes. Cada una se reemplaza por su página real al construirse.

export function SalesPage() {
  return (
    <PagePlaceholder
      icon={ReceiptText}
      title="Historial de ventas"
      description="Tickets cronológicos, reimpresión de recibos y cancelaciones."
      milestone="Requiere /sales"
    />
  )
}

export function SettingsPage() {
  return (
    <PagePlaceholder
      icon={Settings}
      title="Configuración"
      description="Perfil del negocio, IVA y periféricos (impresora térmica, lector, terminal bancaria)."
      milestone="Requiere /settings"
    />
  )
}
