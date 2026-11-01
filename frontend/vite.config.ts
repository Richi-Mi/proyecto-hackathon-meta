import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
        manifest: {
          name: 'Smart Abarrotes',
          short_name: 'Abarrotes',
          description: 'Tu pase de entrada y tus compras en Smart Abarrotes',
          lang: 'es-MX',
          start_url: '/app',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          theme_color: '#059669',
          background_color: '#ffffff',
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          // SPA: cualquier navegación sin red devuelve el shell; la API y Swagger nunca se sirven desde caché
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/swagger/],
        },
      }),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      // En desarrollo la API se consume por el mismo origen (sin CORS)
      proxy: { '/api': env.VITE_API_PROXY_TARGET || 'http://localhost:3000' },
    },
  }
})
