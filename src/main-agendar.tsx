import React from 'react'
import ReactDOM from 'react-dom/client'
import { ScreenBooking } from './screens/Booking'
import { ToastHost } from './components/ui'
import { registrarServiceWorkerConAutoRecarga } from './lib/registerSw'
import './styles/main.css'

// Entry point aparte del CRM interno (main.tsx / App.tsx) — a propósito.
// robsen.com.mx/agendar es un sitio público independiente, no una sección
// con un candado sobre el sistema completo: este build nunca importa
// App.tsx ni ninguna pantalla del CRM (login, Ventas, POS, Agenda, etc.),
// así que no hay manera de que "se vuelva a abrir el sistema" ahí — no es
// un chequeo que hay que mantener correcto para siempre, es que el código
// del CRM ni siquiera está en este bundle. Ver vite.config.ts (build de
// agendar.html en vez de index.html cuando VITE_APP_MODE=agendar) y
// deploy-agendar.yml / deploy-agendar-preview.yml.
registrarServiceWorkerConAutoRecarga()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ScreenBooking />
    <ToastHost />
  </React.StrictMode>,
)
