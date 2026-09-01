// Registro del service worker + recarga automática cuando toma control una
// versión nueva. Compartido entre el CRM interno (main.tsx) y el sitio de
// agendamiento público (main-agendar.tsx) — ambos son builds separados con
// su propio service worker (scope = su propio BASE_PATH), pero el mismo
// comportamiento aplica a los dos.
export function registrarServiceWorkerConAutoRecarga() {
  if (!('serviceWorker' in navigator)) return
  // 'controllerchange' también se dispara la PRIMERA vez que un service
  // worker toma control de una página (de "sin controlador" a "con
  // controlador"), no solo cuando reemplaza a uno viejo — clientsClaim()
  // hace justo eso. Si alguien entra por primera vez y ya está a la mitad
  // de un formulario cuando esa primera activación termina (puede tardar
  // unos segundos, instalando el precache), se le recargaba la página y
  // perdía lo que llevaba escrito — sin necesidad, porque en ese caso no
  // había nada viejo que refrescar. Se distingue guardando si YA había un
  // controlador al cargar: si no había ninguno, este cambio es esa primera
  // activación (no se recarga); si ya había uno, es una actualización real
  // reemplazando contenido viejo (sí se recarga).
  const yaTeniaControlador = !!navigator.serviceWorker.controller
  let recargando = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargando || !yaTeniaControlador) return
    recargando = true
    window.location.reload()
  })
  // El navegador ya revisa si hay una versión nueva en cada navegación,
  // pero una pestaña puede quedarse abierta mucho tiempo sin recargar — se
  // refuerza con una revisión periódica mientras siga abierta.
  navigator.serviceWorker.ready.then(registration => {
    setInterval(() => registration.update().catch(() => {}), 30 * 60 * 1000)
  }).catch(() => {})
}
