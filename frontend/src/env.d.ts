/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** URL base de la API; por defecto `/api/v1` (proxy de Vite en desarrollo) */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
