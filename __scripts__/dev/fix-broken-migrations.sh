#!/usr/bin/env bash
# ============================================================
# fix-broken-migrations.sh
#
# Destrava a migration V2 corrompida que impede a API de subir.
#
# Contexto: a migration 20260411055438_AddUnidadeLotacaoHierarchyV2
# foi gerada por engano com todo o schema (6663 linhas em vez de
# só as mudanças incrementais). O banco já tem as tabelas criadas,
# mas o __EFMigrationsHistory não tem esse registro. Este script
# insere o registro nos 3 bancos de desenvolvimento para que o
# EF Core pule essa migration e continue do ponto certo.
#
# Uso: bash __scripts__/dev/fix-broken-migrations.sh
# ============================================================
set -euo pipefail

MIGRATION_ID="20260411055438_AddUnidadeLotacaoHierarchyV2"
PRODUCT_VERSION="8.0.11"
PG_HOST="${PGHOST:-localhost}"
PG_PORT="${PGPORT:-5432}"
PG_USER="${PGUSER:-postgres}"
PG_PASSWORD="${PGPASSWORD:-admin}"

DATABASES=("dev_render" "dev_render_dev" "dev_render_liotecnica")

# ── Localizar psql ──────────────────────────────────────────
find_psql() {
  if command -v psql &>/dev/null; then
    echo "psql"
    return 0
  fi

  # Windows: PostgreSQL instalado em Program Files
  for ver in 18 17 16 15 14; do
    local candidate="/c/Program Files/PostgreSQL/$ver/bin/psql.exe"
    if [ -f "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done

  echo ""
}

PSQL="$(find_psql)"
if [ -z "$PSQL" ]; then
  echo "ERRO: psql não encontrado. Instale o PostgreSQL client ou adicione ao PATH."
  exit 1
fi

export PGPASSWORD="$PG_PASSWORD"

run_sql() {
  local db="$1"
  local sql="$2"
  "$PSQL" -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$db" -t -c "$sql" 2>&1
}

db_exists() {
  local db="$1"
  run_sql postgres "SELECT 1 FROM pg_database WHERE datname='$db'" 2>/dev/null | grep -q 1
}

echo ""
echo "=== fix-broken-migrations.sh ==="
echo "Migration alvo: $MIGRATION_ID"
echo ""

FIXED=0
SKIPPED=0
MISSING_DB=0

for db in "${DATABASES[@]}"; do
  printf "Verificando banco %-30s ... " "$db"

  if ! db_exists "$db"; then
    echo "IGNORADO (banco não existe)"
    MISSING_DB=$((MISSING_DB + 1))
    continue
  fi

  # Checa se a migration já está registrada
  result=$(run_sql "$db" \
    "SELECT COUNT(*) FROM \"__EFMigrationsHistory\" WHERE \"MigrationId\" = '$MIGRATION_ID';" \
    2>/dev/null | tr -d ' \n\r' || echo "0")

  if [ "$result" = "1" ]; then
    echo "já aplicada, OK"
    SKIPPED=$((SKIPPED + 1))
  else
    run_sql "$db" \
      "INSERT INTO \"__EFMigrationsHistory\" (\"MigrationId\", \"ProductVersion\") VALUES ('$MIGRATION_ID', '$PRODUCT_VERSION') ON CONFLICT DO NOTHING;" \
      > /dev/null
    echo "CORRIGIDO ✓"
    FIXED=$((FIXED + 1))
  fi
done

echo ""
echo "Resultado: $FIXED corrigidos / $SKIPPED já OK / $MISSING_DB bancos ausentes"

if [ $FIXED -gt 0 ]; then
  echo ""
  echo "Pronto. Rode 'bash __scripts__/dev/dev-all.sh' ou 'bash __scripts__/dev/dev-api.sh'."
fi
