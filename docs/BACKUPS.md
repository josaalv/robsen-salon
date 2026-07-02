# Respaldos — recomendación

No hay un respaldo automatizado configurado todavía. Esto es lo que recomendamos, sin implementar nada a ciegas hasta confirmar el plan de Supabase y dónde se van a guardar las copias.

## 1. Revisa tu plan de Supabase

En el dashboard → Project Settings → Add-ons (o Billing):

- **Plan Pro o superior:** Supabase ya guarda backups diarios automáticos por 7 días, y ofrece **PITR** (Point-in-Time Recovery) como add-on pagado — permite restaurar la base de datos a cualquier minuto de los últimos días, no solo al último backup diario. Recomendado para producción real con dinero y citas de clientas.
- **Plan Free:** No hay backups automáticos gestionados por Supabase. Hay que resolverlo manualmente (ver abajo).

## 2. Respaldo manual mínimo (mientras no haya plan Pro)

Un `pg_dump` semanal es suficiente para un salón de este tamaño. Opciones, de más simple a más robusta:

- **Manual, vía Dashboard:** Supabase → Database → Backups tiene un botón de exportación manual. Suficiente si alguien se acuerda de hacerlo cada semana — el riesgo es justo que alguien se olvide.
- **Automatizado con GitHub Actions:** un workflow programado (`schedule: cron`) que corra `pg_dump` contra la base y suba el archivo a un storage privado (otro bucket de Supabase con acceso restringido, o un bucket de un proveedor externo). Requiere decidir dónde vive ese respaldo y con qué credenciales — no lo implementamos todavía porque necesita esa decisión tuya primero.

## 3. Qué NO hacer

- No guardar el respaldo en el mismo proyecto de Supabase sin cifrar ni restringir acceso — si alguien compromete el proyecto, se lleva también los respaldos.
- No depender solo de la memoria de alguien del equipo para "acordarse de exportar".

## 4. Prueba de restauración

Un respaldo que nunca se probó restaurar no es un respaldo confiable. Recomendamos, al menos una vez, restaurar el dump más reciente en un proyecto de Supabase nuevo (no en producción) y confirmar que la app enciende con esos datos.

---

**Siguiente paso sugerido:** confirmar el plan actual de Supabase y decidir si vale la pena subir a Pro para tener PITR automático, dado que el sistema ya maneja ventas y dinero real.
