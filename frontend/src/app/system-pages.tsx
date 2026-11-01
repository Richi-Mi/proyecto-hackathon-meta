import { LoaderCircle, SearchX, TriangleAlert } from 'lucide-react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { Button } from '@/components/ui/button'

export function FullPageLoader() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <LoaderCircle className="size-6 animate-spin text-primary" aria-label="Cargando" />
    </div>
  )
}

function SystemMessage({ icon: Icon, title, description }: { icon: typeof SearchX; title: string; description: string }) {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="grid max-w-sm justify-items-center gap-3">
        <Icon className="size-10 text-muted-foreground" />
        <h1 className="font-heading text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
        <Button asChild variant="outline">
          <Link to="/">Volver al inicio</Link>
        </Button>
      </div>
    </div>
  )
}

export function NotFoundPage() {
  return <SystemMessage icon={SearchX} title="Página no encontrada" description="La dirección no existe o cambió." />
}

export function RouteError() {
  const error = useRouteError()
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />
  console.error(error)
  return (
    <SystemMessage
      icon={TriangleAlert}
      title="Algo salió mal"
      description="Recarga la página. Si sigue pasando, avisa al administrador."
    />
  )
}
