// Sufijo para namespacing de almacenamiento local (localStorage/IndexedDB).
// Vacío en producción; en el build de preview (mismo origen que producción,
// deploy en /preview/) evita que ambos compartan caché de datos y cola de
// sincronización offline — ver docs/DEPLOY.md.
export const STORAGE_SUFFIX = import.meta.env.VITE_STORAGE_SUFFIX ?? ''
