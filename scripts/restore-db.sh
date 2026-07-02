#!/usr/bin/env bash
# Restaura un respaldo generado por backup-db.sh.
#
# ADVERTENCIA: esto SOBREESCRIBE los datos del destino. Para probar que un
# respaldo funciona, apunta DATABASE_URL a un proyecto de Supabase NUEVO
# (no al real) — ver docs/BACKUPS.md, sección "Prueba de restauración".
#
# Uso:
#   export DATABASE_URL="postgresql://postgres.xxxx:password@aws-0-region.pooler.supabase.com:6543/postgres"
#   ./scripts/restore-db.sh backups/robsen-2026-07-02_0800.dump
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ] || [ -z "${1:-}" ]; then
  echo "Uso: DATABASE_URL=... ./scripts/restore-db.sh <archivo.dump>" >&2
  exit 1
fi

echo "Vas a restaurar '$1' sobre la base de datos de DATABASE_URL."
echo "Esto sobreescribe lo que exista ahí. Escribe 'restaurar' para continuar:"
read -r CONFIRMA
if [ "$CONFIRMA" != "restaurar" ]; then
  echo "Cancelado."
  exit 1
fi

pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$DATABASE_URL" "$1"
echo "Restauración completa."
