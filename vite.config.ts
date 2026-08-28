import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// BASE_PATH: '/' en producción; '/preview/' en el deploy de preview (mismo
// dominio, subcarpeta aparte — ver docs/DEPLOY.md). Todo lo que sea una URL
// absoluta (manifest, íconos) tiene que derivarse de esta misma variable o
// el build de preview quedaría apuntando a los assets de producción.
const BASE_PATH = process.env.VITE_BASE_PATH || '/'
// El mismo build también se despliega como /agendar/ en robsen.com.mx (el
// dominio público que ya conoce la clientela, separado del CRM interno) —
// ahí nadie debería ver el manifest de instalación diciendo "CRM/ERP
// interno": es la misma app, pero ese despliegue muestra únicamente
// Booking.tsx.
const APP_MODE = process.env.VITE_APP_MODE || 'interno'
const MANIFEST_TEXT = APP_MODE === 'agendar'
  ? { name: 'Agenda tu cita · Robsen Salón & Spa', short_name: 'Robsen — Agendar', description: 'Agenda tu cita en línea con Robsen Salón & Spa' }
  : { name: 'Robsen Salón · Sistema interno', short_name: 'Robsen', description: 'CRM/ERP interno de Robsen Salón & Spa' }

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
      // El scope del service worker generado sigue a `base` automáticamente
      // (queda en BASE_PATH + sw.js), así que preview y producción nunca se
      // pisan entre sí aunque compartan dominio.
      workbox: {
        cleanupOutdatedCaches: true,
        // Por default, Workbox responde CUALQUIER navegación (F5, enlace
        // directo, etc.) desde el shell precacheado, sin tocar la red — así
        // que un navegador con un service worker viejo ya registrado sigue
        // sirviendo el index.html/JS de un deploy anterior indefinidamente,
        // hasta que el propio SW note el cambio y se actualice solo (lo que
        // puede tardar). Eso es lo que explica "en incógnito sí funciona,
        // en modo normal no": incógnito nunca tiene un SW previo de por
        // medio. NetworkFirst pide la red primero (con límite de 3s) y solo
        // cae al shell cacheado si de verdad no hay conexión — así el
        // personal siempre ve el deploy más reciente estando en línea, y la
        // app sigue funcionando offline igual que antes.
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: ({ request }: { request: Request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'app-shell', networkTimeoutSeconds: 3 },
          },
        ],
      },
      manifest: {
        ...MANIFEST_TEXT,
        start_url: BASE_PATH,
        scope: BASE_PATH,
        display: 'standalone',
        background_color: '#0f0f0f',
        theme_color: '#C8A14A',
        icons: [
          { src: `${BASE_PATH}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${BASE_PATH}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
          { src: `${BASE_PATH}icons/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: { port: 3000 },
  base: BASE_PATH,
})
