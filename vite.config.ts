import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Sin CDN por delante (deploy es FTP plano a Hostinger) — el propio
      // service worker debe invalidar su caché en cada deploy o el personal
      // se queda atorado en una versión vieja después de una actualización.
      // Sin runtimeCaching: las llamadas a Supabase nunca pasan por el
      // service worker (ni se cachean) — una lectura vieja de citas/ventas
      // sería peor que ninguna. El store de Zustand (localStorage) ya cubre
      // la lectura offline; el service worker solo cachea el cascarón (JS/CSS/HTML).
      workbox: {
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'Robsen Salón · Sistema interno',
        short_name: 'Robsen',
        description: 'CRM/ERP interno de Robsen Salón & Spa',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f0f0f',
        theme_color: '#C8A14A',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: { port: 3000 },
  base: process.env.GITHUB_PAGES ? '/robsen-salon/' : '/',
})
