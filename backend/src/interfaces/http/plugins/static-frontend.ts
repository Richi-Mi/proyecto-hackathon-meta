import { Elysia, NotFoundError } from 'elysia'
import { existsSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'

/** Archivos con hash en el nombre (Vite los genera en /assets): nunca cambian. */
const IMMUTABLE = 'public, max-age=31536000, immutable'
/** index.html, sw.js, manifest e íconos: el navegador revalida para recibir cada deploy. */
const REVALIDATE = 'no-cache'

const isBackendPath = (path: string) => path === '/api' || path.startsWith('/api/') || path.startsWith('/swagger')

/**
 * Sirve el build del frontend (SPA + PWA) desde el mismo origen que la API.
 * Las rutas del API y de Swagger ganan por ser más específicas que el comodín; el resto es un archivo
 * de `dir` o, si es una navegación de la SPA (sin extensión), `index.html`.
 */
export function staticFrontend(dir: string) {
  const root = resolve(dir)
  const indexHtml = join(root, 'index.html')
  if (!existsSync(indexHtml)) {
    throw new Error(`FRONTEND_DIST: no existe ${indexHtml} (¿se compiló el frontend?)`)
  }

  const fileAt = async (pathname: string) => {
    let decoded: string
    try {
      decoded = decodeURIComponent(pathname)
    } catch {
      return null
    }
    const filePath = resolve(root, `.${decoded}`)
    if (!filePath.startsWith(root + sep)) return null
    const info = await stat(filePath).catch(() => null)
    return info?.isFile() ? filePath : null
  }

  return new Elysia({ name: 'static-frontend' }).get(
    '/*',
    async ({ path, set }) => {
      // Rutas del API inexistentes: mismo 404 JSON de siempre
      if (isBackendPath(path)) throw new NotFoundError()

      const filePath = await fileAt(path)
      if (filePath) {
        set.headers['cache-control'] = path.startsWith('/assets/') ? IMMUTABLE : REVALIDATE
        return Bun.file(filePath)
      }
      // Un archivo que no existe (/logo-viejo.png) es 404; una ruta de la SPA (/admin/inventory) recibe el shell
      if (extname(path)) throw new NotFoundError()
      set.headers['cache-control'] = REVALIDATE
      return Bun.file(indexHtml)
    },
    { detail: { hide: true } },
  )
}
