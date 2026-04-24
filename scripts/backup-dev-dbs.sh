#!/bin/bash
# backup-dev-dbs.sh — Gera backups dos 3 bancos de desenvolvimento
#
# Uso:  bash scripts/backup-dev-dbs.sh
# Saída: backups/{dev_render, dev_render_master, dev_render_liotecnica}.dump

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$ROOT/backups"
PG_DUMP="${PG_DUMP:-/Library/PostgreSQL/18/bin/pg_dump}"

mkdir -p "$BACKUP_DIR"

export PGPASSWORD="${PGPASSWORD:-@FelipeL89*}"

for db in dev_render dev_render_master dev_render_liotecnica; do
  echo "→ Dumping $db..."
  "$PG_DUMP" \
    -h "${PG_HOST:-localhost}" \
    -U "${PG_USER:-postgres}" \
    -Fc -Z 9 \
    -f "$BACKUP_DIR/${db}.dump" \
    "$db"
  size=$(du -h "$BACKUP_DIR/${db}.dump" | awk '{print $1}')
  echo "  ✓ $BACKUP_DIR/${db}.dump ($size)"
done

echo ""
echo "✅ Backup concluído. Total:"
du -sh "$BACKUP_DIR"
