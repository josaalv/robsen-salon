#!/usr/bin/env bash
# Respaldo manual de la base de datos de Supabase.
#
# Uso:
#   export DATABASE_URL="postgresql://postgres.xxxx:password@aws-0-region.pooler.supabase.com:6543/postgres"
#   ./scripts/backup-db.sh
#
# La connection string se obtiene desde Supabase → Project Settings →
# Database → Connection string (usa el modo "Session pooler", funciona
# igual desde tu máquina que desde GitHub Actions). Nunca la pegues en
# un commit ni la compartas por chat — trátala como una contraseña.
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Falta la variable DATABASE_URL. Ejemplo:" >&2
  echo '  export DATABASE_URL="postgresql://postgres.xxxx:password@aws-0-region.pooler.supabase.com:6543/postgres"' >&2
  exit 1
fi

mkdir -p backups
FECHA=$(date +%Y-%m-%d_%H%M)
ARCHIVO="backups/robsen-$FECHA.dump"

pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file="$ARCHIVO"

echo "Respaldo guardado en $ARCHIVO"
echo "Este archivo NO debe subirse al repo (ya está en .gitignore). Muévelo a un lugar seguro y cifrado."
