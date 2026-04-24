#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# seed-rs-completo.sh — Popular dataset COMPLETO de R&S + reindexar IA
# ═══════════════════════════════════════════════════════════════════════════
#
# Uso:   bash scripts/seed-rs-completo.sh
# Ou:    ./scripts/seed-rs-completo.sh
#
# O que faz em sequência:
#   1. Roda seed-vaga-simulacao.sql (se ainda não rodou — cria Ana/Bruno/Carla/Diego)
#   2. Roda seed-rs-completo.sql (9 pessoas + 9 candidatos + 9 candidaturas + vagas)
#   3. Dispara reindexação IA na API (ou avisa para disparar manualmente)
#
# Requisitos:
#   - PostgreSQL 18 rodando com tenant liotecnica seedado
#   - API rodando em http://localhost:5056 (opcional — só para reindex)
#   - Ollama rodando (opcional — só pra embeddings; sem ele matching cai em léxico)
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PG_HOST="${PG_HOST:-localhost}"
PG_USER="${PG_USER:-postgres}"
PG_PASS="${PG_PASSWORD:-@FelipeL89*}"
PG_DB="${PG_DB:-dev_render_liotecnica}"
API_BASE="${API_BASE:-http://localhost:5056}"
API_ADMIN="${API_ADMIN:-admin@dev.local}"
API_PASS="${API_PASS:-YkmF@2022*}"

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║  SEED COMPLETO — Recrutamento & Seleção                              ║"
echo "║  DB: ${PG_DB}                                                        ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# ── 0. Pre-clean: remove TUDO do seed-completo primeiro ─────────────────────
#      Razão: seed-vaga-simulacao.sql deleta CentroCusto TI-OPS (aaaaaaaa-cc01),
#      mas vagas criadas pelo seed-completo (eeeeeeee-* e ffffffff-*) referenciam
#      TI-OPS via FK RESTRICT. Limpar na ordem reversa de dependência antes de rodar.
echo "► [0/3] Pre-clean de dependências cross-prefix..."
PGPASSWORD="$PG_PASS" psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 <<'SQL' 2>&1 | tail -5
BEGIN;
-- Propostas de vagas (todas que serão regeradas)
DELETE FROM "PropostasVaga"
WHERE "Id"::text LIKE 'bbbbbbbb-%' OR "Id"::text LIKE 'cccccccc-%'
   OR "Id"::text LIKE 'dddddddd-%' OR "Id"::text LIKE 'ffffffff-%';

-- Candidaturas, Candidatos, Talentos, Pessoas do seed-completo
DELETE FROM "CandidaturaEtapaHistoricos" WHERE "CandidaturaId" IN (
  SELECT "Id" FROM "Candidaturas"
  WHERE "Id"::text LIKE 'bbbbbbbb-%' OR "Id"::text LIKE 'cccccccc-%' OR "Id"::text LIKE 'dddddddd-%');
DELETE FROM "Candidaturas"
WHERE "Id"::text LIKE 'bbbbbbbb-%' OR "Id"::text LIKE 'cccccccc-%' OR "Id"::text LIKE 'dddddddd-%';
DELETE FROM "CandidatoCompetencias" WHERE "CandidatoId" IN (
  SELECT "Id" FROM "Candidatos"
  WHERE "Id"::text LIKE 'bbbbbbbb-%' OR "Id"::text LIKE 'cccccccc-%' OR "Id"::text LIKE 'dddddddd-%');
DELETE FROM "CandidatoEmbeddings" WHERE "CandidatoId" IN (
  SELECT "Id" FROM "Candidatos"
  WHERE "Id"::text LIKE 'bbbbbbbb-%' OR "Id"::text LIKE 'cccccccc-%' OR "Id"::text LIKE 'dddddddd-%');
DELETE FROM "Candidatos"
WHERE "Id"::text LIKE 'bbbbbbbb-%' OR "Id"::text LIKE 'cccccccc-%' OR "Id"::text LIKE 'dddddddd-%';
DELETE FROM "Talentos"
WHERE "Id"::text LIKE 'bbbbbbbb-%' OR "Id"::text LIKE 'cccccccc-%' OR "Id"::text LIKE 'dddddddd-%';
DELETE FROM "Pessoas"
WHERE "Id"::text LIKE 'bbbbbbbb-%' OR "Id"::text LIKE 'cccccccc-%' OR "Id"::text LIKE 'dddddddd-%';

-- Vagas do seed-completo (inclusive eeee/ffff que referenciam TI-OPS)
DELETE FROM "Vagas" WHERE "Id"::text LIKE 'bbbbbbbb-%' OR "Id"::text LIKE 'cccccccc-%'
   OR "Id"::text LIKE 'dddddddd-%' OR "Id"::text LIKE 'eeeeeeee-%' OR "Id"::text LIKE 'ffffffff-%';

COMMIT;
SELECT 'Pre-clean completo' AS status;
SQL
echo ""

# ── 1. Seed base (vaga Assistente Suporte Técnico) ──────────────────────────
if [ -f /tmp/seed_vaga_simulacao.sql ]; then
  echo "► [1/3] Rodando seed-vaga-simulacao.sql (Ana, Bruno, Carla, Diego)..."
  PGPASSWORD="$PG_PASS" psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" \
    -v ON_ERROR_STOP=1 -f /tmp/seed_vaga_simulacao.sql 2>&1 | tail -5
else
  echo "► [1/3] seed-vaga-simulacao.sql não encontrado em /tmp (pulando)"
fi
echo ""

# ── 2. Seed completo ────────────────────────────────────────────────────────
echo "► [2/3] Rodando seed-rs-completo.sql..."
PGPASSWORD="$PG_PASS" psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" \
  -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/seed-rs-completo.sql" 2>&1 | tail -25
echo ""

# ── 3. Reindexar IA ─────────────────────────────────────────────────────────
echo "► [3/3] Reindexando embeddings IA..."
if ! curl -sS -o /dev/null -w "%{http_code}" "$API_BASE/health" 2>/dev/null | grep -q 200; then
  echo "   ⚠ API offline em $API_BASE — pulando reindex."
  echo "   Quando a API estiver no ar, dispare:"
  echo "   curl -X POST -H \"Authorization: Bearer \$TOKEN\" -H \"X-Tenant-Id: liotecnica\" \\"
  echo "     \"$API_BASE/api/assistente-ia/embeddings/reindexar?force=true\""
  echo ""
else
  TOKEN=$(curl -sS -X POST "$API_BASE/api/auth/login" \
    -H "Content-Type: application/json" -H "X-Tenant-Id: liotecnica" \
    -d "{\"email\":\"$API_ADMIN\",\"password\":\"$API_PASS\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null)

  if [ -z "$TOKEN" ]; then
    echo "   ⚠ Falha ao autenticar — token vazio."
  else
    echo "   Autenticação OK. Disparando reindex..."
    time curl -sS -X POST \
      -H "Authorization: Bearer $TOKEN" -H "X-Tenant-Id: liotecnica" \
      "$API_BASE/api/assistente-ia/embeddings/reindexar?force=true" \
      | python3 -m json.tool 2>&1 || echo "   ⚠ Ollama pode estar offline; matching cai em léxico."
  fi
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║  ✅ SEED COMPLETO                                                     ║"
echo "║                                                                      ║"
echo "║  Próximo passo — teste pela UI:                                      ║"
echo "║   • /app/recrutamento/candidaturas → kanban com todas as etapas      ║"
echo "║   • /app/recrutamento/funil → funil de conversão                     ║"
echo "║   • /app/assistente-ia → chat RAG                                    ║"
echo "║                                                                      ║"
echo "║  Leia TRILHA_TESTES_RS.md para roteiro completo.                    ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
