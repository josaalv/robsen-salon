# Respaldos

## Cómo funciona ahora

Hay un respaldo automático real cada semana vía GitHub Actions
(`.github/workflows/backup-db.yml`): corre `pg_dump` contra la base de datos
de Supabase y sube el archivo como un **artifact** de esa ejecución (privado
al repo, solo lo pueden descargar quienes tengan acceso a él), con 90 días de
retención. También se puede disparar a mano cuando quieras, sin esperar al
domingo.

**Falta un solo paso de tu parte para que funcione:** agregar el secret
`SUPABASE_DB_URL` en GitHub. Sin ese secret, el workflow corre pero falla en
rojo con un mensaje claro — no falla en silencio.

### Cómo agregar el secret

1. Supabase Dashboard → tu proyecto → **Project Settings → Database →
   Connection string**.
2. Elige el modo **"Session pooler"** (funciona mejor desde GitHub Actions
   que la conexión directa) y copia la URI completa — incluye tu contraseña
   de base de datos, no la anon key ni la service role key.
3. GitHub → este repo → **Settings → Secrets and variables → Actions → New
   repository secret**.
   - Nombre: `SUPABASE_DB_URL`
   - Valor: la connection string que copiaste.
4. Ejecuta el workflow una vez a mano (**Actions → Backup de la base de
   datos → Run workflow**) para confirmar que funciona.

### Cómo correr un respaldo manual desde tu computadora

```bash
export DATABASE_URL="postgresql://postgres.xxxx:tu-password@aws-0-region.pooler.supabase.com:6543/postgres"
./scripts/backup-db.sh
```

Genera un archivo en `backups/robsen-FECHA.dump` — esa carpeta está en
`.gitignore`, nunca se sube al repo. Muévelo a un lugar seguro (no lo dejes
en tu carpeta de Descargas indefinidamente).

## Cómo restaurar

**Nunca pruebes una restauración contra el proyecto de producción.** Crea un
proyecto de Supabase nuevo (gratis) solo para probar, y apunta `DATABASE_URL`
a ese proyecto de prueba:

```bash
export DATABASE_URL="postgresql://postgres.xxxx:password@aws-0-region.pooler.supabase.com:6543/postgres"
./scripts/restore-db.sh backups/robsen-2026-07-02_0800.dump
```

El script pide que escribas "restaurar" para confirmar, justamente para que
no sea un solo comando accidental el que sobreescriba algo.

## Prueba de restauración (hazla al menos una vez)

Un respaldo que nunca se probó restaurar no es un respaldo confiable:

1. Crea un proyecto de Supabase nuevo (plan gratis, no afecta el real).
2. Descarga el artifact más reciente del workflow de backup.
3. Corre `restore-db.sh` apuntando a ese proyecto nuevo.
4. Confirma que las tablas y filas están ahí (`select count(*) from clientas;`
   en el SQL Editor, por ejemplo).
5. Borra el proyecto de prueba cuando termines — no lo dejes corriendo.

## Si Supabase pasa a plan Pro

Si en algún momento el salón decide pagar el plan Pro de Supabase, hay
backups diarios automáticos gestionados por Supabase (7 días de retención) y
la opción de contratar **PITR** (Point-in-Time Recovery) como add-on, que
permite restaurar a cualquier minuto exacto, no solo al último backup diario.
Eso sería una capa adicional sobre este proceso, no un reemplazo — el
workflow de GitHub Actions sigue siendo útil como copia independiente fuera
de Supabase (si alguna vez hay un problema con la cuenta de Supabase misma,
no con solo los datos).

## Si se borra una cita, venta o clienta por accidente

1. Antes que nada: la mayoría de los borrados accidentales quedan
   registrados en `audit_logs` (Ajustes → solo visible para admin/gerente vía
   consultas SQL directas por ahora, no hay una pantalla dedicada) — eso dice
   quién borró qué y cuándo, con los valores anteriores completos en
   `valores_antes`. A veces se puede reconstruir el registro manualmente
   desde ahí sin necesitar restaurar nada.
2. Si el borrado es grande o afecta a muchos registros, usa el respaldo más
   reciente: restáuralo en un proyecto de prueba (nunca directo a
   producción), extrae solo lo que se perdió, e insértalo de vuelta a mano en
   producción.
3. Restaurar el dump completo directo sobre producción es el último
   recurso — sobreescribe TODO lo que pasó desde ese respaldo hasta ahora
   (ventas nuevas, citas nuevas, etc.). Solo hazlo si el daño es mayor que
   perder esas horas/días de actividad reciente.

## Diferencia entre backup y exportar a CSV

Son cosas distintas y no se reemplazan entre sí:

- **Backup (`pg_dump`):** una copia completa y exacta de toda la base de
  datos — esquema, relaciones, todas las tablas. Sirve para recuperar el
  sistema completo si algo sale mal.
- **Exportar a CSV/Excel** (si existe esa función en Ventas/Finanzas): una
  vista de una sola tabla en un momento dado, útil para análisis o
  contabilidad, pero no permite reconstruir el sistema — no tiene relaciones
  entre tablas, RLS, triggers, etc.
