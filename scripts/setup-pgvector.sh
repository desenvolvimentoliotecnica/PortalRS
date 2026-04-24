#!/bin/bash
# setup-pgvector.sh — Habilita a extensão pgvector no PostgreSQL EDB 18
#
# Usage: sudo bash scripts/setup-pgvector.sh
#
# Pré-requisitos:
#   - brew install pgvector       (já instalado — /opt/homebrew/Cellar/pgvector)
#   - PostgreSQL 18 rodando       (EDB installer em /Library/PostgreSQL/18)
#
# O que faz: copia vector.control + *.sql para share/extension/ e vector.dylib
# para lib/postgresql/ do Postgres EDB. Depois habilita a extensão em todos os
# bancos de tenant listados (e no master).

set -euo pipefail

if [ "$EUID" -ne 0 ]; then
  echo "❌ Rode com sudo: sudo bash $0"
  exit 1
fi

PGVECTOR_SRC="/opt/homebrew/Cellar/pgvector/0.8.2"
PG_EXTENSION_DIR="/Library/PostgreSQL/18/share/postgresql/extension"
PG_LIB_DIR="/Library/PostgreSQL/18/lib/postgresql"

if [ ! -d "$PGVECTOR_SRC" ]; then
  echo "❌ pgvector não encontrado em $PGVECTOR_SRC"
  echo "   Rode: brew install pgvector"
  exit 1
fi

echo "→ Copiando SQL/control files para $PG_EXTENSION_DIR"
cp "$PGVECTOR_SRC/share/postgresql@18/extension/"*.sql         "$PG_EXTENSION_DIR/"
cp "$PGVECTOR_SRC/share/postgresql@18/extension/vector.control" "$PG_EXTENSION_DIR/"

echo "→ Copiando vector.dylib para $PG_LIB_DIR"
cp "$PGVECTOR_SRC/lib/postgresql@18/vector.dylib" "$PG_LIB_DIR/"

echo "→ Files copiados. Habilitando extensão em dev_render_liotecnica"
# A senha do postgres vem do env PGPASSWORD
export PGPASSWORD="${PGPASSWORD:-@FelipeL89*}"

psql -h localhost -U postgres -d dev_render_liotecnica <<'SQL'
CREATE EXTENSION IF NOT EXISTS vector;
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
SQL

echo ""
echo "✅ pgvector instalado com sucesso."
