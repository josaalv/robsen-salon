import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './styles/main.css'

// El registerSW.js que genera el build solo llama a
// navigator.serviceWorker.register() — nunca escucha cuándo una versión
// nueva toma control, así que una pestaña ya abierta se queda para siempre
// con el JS viejo en memoria (Ctrl+Shift+R no ayuda: eso salta el caché
// HTTP normal, no el del service worker, que sigue respondiendo la
// navegación con lo que tenga precacheado). El sw.js ya trae
// skipWaiting()+clientsClaim() (configurados vía registerType:'autoUpdate'
// en vite.config.ts), así que la nueva versión SÍ toma control sola en
// background — solo faltaba recargar cuando eso pase. Sin riesgo de perder
// datos: las escrituras offline viven en IndexedDB (outbox), sobreviven un
// reload; el único riesgo real es un formulario sin guardar a medio llenar
// justo en el momento exacto de un deploy, ventana muy angosta dado lo
// poco frecuente que se despliega.
if ('serviceWorker' in navigator) {
  let recargando = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargando) return
    recargando = true
    window.location.reload()
  })
  // El navegador ya revisa si hay una versión nueva en cada navegación,
  // pero el personal suele dejar la pestaña abierta todo el día sin
  // recargar — se refuerza con una revisión periódica mientras siga abierta.
  navigator.serviceWorker.ready.then(registration => {
    setInterval(() => registration.update().catch(() => {}), 30 * 60 * 1000)
  }).catch(() => {})
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
