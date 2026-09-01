import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { registrarServiceWorkerConAutoRecarga } from './lib/registerSw'
import './styles/main.css'

// Sin riesgo de perder datos al recargar: las escrituras offline viven en
// IndexedDB (outbox), sobreviven un reload; el único riesgo real es un
// formulario sin guardar a medio llenar justo en el momento exacto de un
// deploy, ventana muy angosta dado lo poco frecuente que se despliega.
registrarServiceWorkerConAutoRecarga()

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
