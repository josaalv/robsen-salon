# Migraciones — Robsen Salón & Spa

Esta carpeta refleja **exactamente** lo que existe hoy en el proyecto de Supabase de producción (`pkpwrifwrntjztprwcwp`). Los archivos `015` en adelante se exportaron con el SQL literal que Supabase guardó al aplicarse (`supabase_migrations.schema_migrations`), no reconstruidos de memoria — si algo aquí no coincide con producción, es un bug de esta documentación, repórtalo.

## Orden de ejecución

| # | Archivo | Qué hace |
|---|---------|----------|
| 001 | `001_initial_schema.sql` | Esquema inicial de tablas (bootstrap manual, antes de que existiera control de migraciones) |
| 002 | `002_rls_policies.sql` | Primeras políticas RLS (superadas por las de seguridad real, ver 016-017) |
| 003 | `003_seed_data.sql` | Datos de demostración iniciales |
| 004 | `004_correct_schema.sql` | Corrección del esquema para que coincidiera con el código real |
| 005 | `005_add_bloqueos.sql` | Tabla de bloqueos de horario en agenda |
| 006 | `006_add_gastos.sql` | Tabla de gastos operativos |
| 007 | `007_add_escala_comisiones.sql` | Escala progresiva de comisiones + email en clientas |
| 008 | `008_add_media_columns.sql` | Columnas de imágenes (logo, avatar, fotos de clientas) |
| 009 | `009_add_avatar_to_usuarios.sql` | Columna avatar en usuarios |
| 010 | `010_storage_media_update_policy.sql` | Política de UPDATE en storage (reemplazada en 017) |
| 011 | `011_create_reset_tokens.sql` | Sistema de recuperación por token propio — **reemplazado por Supabase Auth**, tabla eliminada en 026 |
| 012 | `012_add_cita_id_to_ventas.sql` | Relaciona ventas con la cita que las originó |
| 013 | `013_add_foto_bio_to_estilistas.sql` | Foto y bio pública de cada estilista |
| 014 | `014_add_service_fields_from_excel.sql` | Campos de servicios importados de Excel (descripción, comisión, etc.) |
| 015 | `015_auth_foundation.sql` | Fundamento de Supabase Auth: `auth_user_id`, `estilista_id`, funciones helper `current_rol()`/`current_estilista_id()`/`is_active()` |
| 016 | `016_authenticated_rls_policies.sql` | Políticas RLS reales por rol (admin/gerente/recepción/estilista) para todas las tablas operativas |
| 017 | `017_close_open_policies.sql` | **El cierre de seguridad crítico**: elimina las políticas `anon_all` que dejaban todo abierto a cualquiera con la anon key |
| 018 | `018_drop_plaintext_password.sql` | Elimina la columna que guardaba contraseñas en texto plano |
| 019 | `019_login_picker_solo_cuentas_reales.sql` | El picker de login solo muestra perfiles con cuenta de Auth real |
| 020 | `020_audit_logs.sql` | Tabla y trigger de auditoría (quién hizo qué, cuándo) |
| 021 | `021_servicios_activo_dedupe_validaciones.sql` | Servicios desactivables, dedupe de clientas por teléfono, estado "no_asistio", checks de montos no-negativos, bloqueo de citas encimadas |
| 022 | `022_cierres_caja.sql` | Tabla de corte de caja (bitácora inmutable) |
| 023 | `023_saldo_cobrado_monto.sql` | Evita doble conteo en cierre de caja al liquidar saldos |
| 024 | `024_endurecer_funciones.sql` | Fija `search_path` en funciones, revoca ejecución directa de `fn_audit_log` |
| 025 | `025_permitir_borrar_usuarios.sql` | FKs de `audit_logs`/`cierres_caja` a `ON DELETE SET NULL` para poder borrar usuarios sin perder historial |
| 026 | `026_hardening_seguridad_release_candidate.sql` | Auditoría pre-release: vista segura para el picker de login, revoca RPC directo de funciones internas, bucket privado para fotos de clientas, elimina `reset_tokens` |

## Cómo aplicar esto en un proyecto de Supabase nuevo

```bash
# Con la Supabase CLI, desde la raíz del repo:
supabase link --project-ref <tu-project-ref>
supabase db push
```

Esto ejecuta los archivos en orden numérico. Si prefieres pegarlos a mano en el SQL Editor del dashboard, respeta el orden 001 → 026 exactamente — varias migraciones dependen de columnas/funciones creadas en las anteriores.

**Nota:** después de aplicar las migraciones necesitas recrear manualmente (no está en SQL, vive en el dashboard/Auth):
- Las 4 cuentas de Supabase Auth reales (no se replican con migraciones — usa "Invitar usuario" desde Ajustes → Usuarios una vez que la app esté arriba).
- El bucket `media` (público) y `fotos-privadas` (privado) si `026` no los crea automáticamente por alguna limitación del entorno — revisa el contenido de esa migración.
- La configuración de Auth → URL Configuration (Site URL y Redirect URLs) — ver `docs/SECURITY.md`.

## Cómo restaurar desde un backup

Ver `docs/BACKUPS.md` para el proceso completo de backup y restauración con `pg_dump`/`pg_restore`.

## Checklist de validación de seguridad

Ver `docs/SECURITY.md`, sección "Verificación rápida", para las consultas SQL que confirman que RLS sigue bien configurado después de cualquier cambio futuro.
