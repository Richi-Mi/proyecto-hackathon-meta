/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** URL base de la API; por defecto `/api/v1` (proxy de Vite en desarrollo) */
  readonly VITE_API_URL?: string
  /** 'true' muestra el botón "Simular visita" también en builds de producción (el backend debe tener /dev) */
  readonly VITE_STORE_SIMULATOR?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
