#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
#  RenderRH — Bateria de Testes Automatizada (API + AI + Web health)
#  Uso: bash test-battery.sh
# ───────────────────────────────────────────────────────────────────────────
set -euo pipefail

API="${TB_API:-http://localhost:5056}"
AI="${TB_AI:-http://localhost:8000}"
WEB="${TB_WEB:-http://localhost:5064}"

OWNER_EMAIL="${TB_OWNER_EMAIL:-owner@dev.local}"
OWNER_PASSWORD="${TB_OWNER_PASSWORD:-ChangeThisPassword123!}"

ADMIN_EMAIL="${TB_ADMIN_EMAIL:-admin@liotecnica.com.br}"
ADMIN_EMAIL_FALLBACK="${TB_ADMIN_EMAIL_FALLBACK:-admin@dev.local}"
ADMIN_PASSWORD="${TB_ADMIN_PASSWORD:-ChangeThisPassword123!}"

TENANT_ID="${TB_TENANT_ID:-}"

PASS=0; FAIL=0; SKIP=0; TOTAL=0
FAILURES=""

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

check() {
  local label="$1" url="$2" method="${3:-GET}" body="${4:-}" expect="${5:-200}"
  TOTAL=$((TOTAL+1))
  
  local bodyfile
  bodyfile="$(mktemp 2>/dev/null || echo "/tmp/tb_body_${RANDOM}.txt")"

  local args=(-s --insecure -o "$bodyfile" -w "%{http_code}" -X "$method" --max-time 10)
  if [[ -n "$body" ]]; then
    args+=(-H "Content-Type: application/json" -d "$body")
  fi
  if [[ -n "${TOKEN:-}" ]]; then
    args+=(-H "Authorization: Bearer $TOKEN")
  fi
  if [[ "$url" == "$API/api/"* && "$url" != "$API/api/owner/"* && -n "${TENANT_ID:-}" ]]; then
    args+=(-H "X-Tenant-Id: $TENANT_ID")
  fi

  local code
  code=$(curl "${args[@]}" "$url" 2>/dev/null) || code="000"

  if [[ "$code" == "$expect" ]]; then
    PASS=$((PASS+1))
    printf "${GREEN}✅ PASS${NC} [%s] %s %s → %s\n" "$label" "$method" "$url" "$code"
  else
    FAIL=$((FAIL+1))
    local body_preview
    body_preview=$(head -c 200 "$bodyfile" 2>/dev/null || echo "")
    FAILURES="${FAILURES}\n  ❌ ${label}: expected ${expect}, got ${code} — ${body_preview}"
    printf "${RED}❌ FAIL${NC} [%s] %s %s → %s (expected %s)\n" "$label" "$method" "$url" "$code" "$expect"
  fi

  rm -f "$bodyfile" 2>/dev/null || true
}

skip() {
  local label="$1" reason="$2"
  TOTAL=$((TOTAL+1)); SKIP=$((SKIP+1))
  printf "${YELLOW}⏭ SKIP${NC} [%s] %s\n" "$label" "$reason"
}

header() {
  echo ""
  printf "${CYAN}══════════════════════════════════════════════════════════════${NC}\n"
  printf "${CYAN}  %s${NC}\n" "$1"
  printf "${CYAN}══════════════════════════════════════════════════════════════${NC}\n"
}

# ═══════════════════════════════════════════════════════════════
header "1. AI (FastAPI) Health"
# ═══════════════════════════════════════════════════════════════
check "AI01" "$AI/health"

# ═══════════════════════════════════════════════════════════════
header "2. API — Owner Login"
# ═══════════════════════════════════════════════════════════════
OWNER_RESP=$(curl -s -X POST "$API/api/owner/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$OWNER_EMAIL\",\"password\":\"$OWNER_PASSWORD\"}" \
  --max-time 10 2>/dev/null || echo "")
OWNER_TOKEN=$(echo "$OWNER_RESP" | grep -oP '"accessToken":"\K[^"]+' | head -1 || echo "")

if [[ -n "$OWNER_TOKEN" ]]; then
  PASS=$((PASS+1)); TOTAL=$((TOTAL+1))
  printf "${GREEN}✅ PASS${NC} [OWNER-LOGIN] Owner login OK\n"
else
  FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1))
  FAILURES="${FAILURES}\n  ❌ OWNER-LOGIN: failed to get owner token"
  printf "${RED}❌ FAIL${NC} [OWNER-LOGIN] Could not obtain owner token\n"
fi

# Get tenant list (need a tenant ID for admin login)
TOKEN="$OWNER_TOKEN"
TENANTS_RESP=$(curl -s -H "Authorization: Bearer $TOKEN" "$API/api/owner/tenants" --max-time 10 2>/dev/null || echo "[]")
if [[ -z "${TENANT_ID:-}" ]]; then
  TENANT_ID=$(echo "$TENANTS_RESP" | grep -oP '"tenantId":"\K[^"]+' | head -1 || echo "")
fi

if [[ -z "$TENANT_ID" ]]; then
  TENANT_ID="liotecnica"
fi
printf "  ℹ️  Using tenant: %s\n" "$TENANT_ID"

# ═══════════════════════════════════════════════════════════════
header "3. Owner API endpoints"
# ═══════════════════════════════════════════════════════════════
check "OW01" "$API/api/owner/tenants"
check "OW02" "$API/api/owner/tenants/$TENANT_ID"
check "OW03" "$API/api/owner/tenants/migrations/status"
check "OW04" "$API/api/owner/tenants/$TENANT_ID/users"
check "OW05" "$API/api/owner/tenants/$TENANT_ID/roles"
check "OW06" "$API/api/owner/tenants/$TENANT_ID/units"
check "OW07" "$API/api/owner/tenants/$TENANT_ID/funcionarios"

# ═══════════════════════════════════════════════════════════════
header "4. API — Admin Login"
# ═══════════════════════════════════════════════════════════════
maybe_seed_tenant() {
  local users_resp
  users_resp=$(curl -s -H "Authorization: Bearer $OWNER_TOKEN" "$API/api/owner/tenants/$TENANT_ID/users" --max-time 20 2>/dev/null || echo "[]")

  # Heurística simples: se não aparece "email" no payload, assume sem users seed.
  if ! echo "$users_resp" | grep -q '"email"'; then
    printf "  ℹ️  Tenant parece sem usuários. Rodando seed via Owner API...\n"
    curl -s -X POST "$API/api/owner/tenants/$TENANT_ID/seed" \
      -H "Authorization: Bearer $OWNER_TOKEN" \
      --max-time 60 2>/dev/null >/dev/null || true
  fi
}

admin_login() {
  local email="$1"
  local resp
  resp=$(curl -s -X POST "$API/api/auth/login" \
    -H "Content-Type: application/json" \
    -H "X-Tenant-Id: $TENANT_ID" \
    -d "{\"email\":\"$email\",\"password\":\"$ADMIN_PASSWORD\"}" \
    --max-time 15 2>/dev/null || echo "")
  echo "$resp" | grep -oP '"accessToken":"\K[^"]+' | head -1 || echo ""
}

ADMIN_TOKEN="$(admin_login "$ADMIN_EMAIL")"
if [[ -z "$ADMIN_TOKEN" ]]; then
  ADMIN_TOKEN="$(admin_login "$ADMIN_EMAIL_FALLBACK")"
fi

if [[ -z "$ADMIN_TOKEN" && -n "${OWNER_TOKEN:-}" ]]; then
  maybe_seed_tenant
  ADMIN_TOKEN="$(admin_login "$ADMIN_EMAIL")"
  if [[ -z "$ADMIN_TOKEN" ]]; then
    ADMIN_TOKEN="$(admin_login "$ADMIN_EMAIL_FALLBACK")"
  fi
fi

if [[ -n "$ADMIN_TOKEN" ]]; then
  PASS=$((PASS+1)); TOTAL=$((TOTAL+1))
  printf "${GREEN}✅ PASS${NC} [ADMIN-LOGIN] Admin login OK\n"
  TOKEN="$ADMIN_TOKEN"
else
  FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1))
  FAILURES="${FAILURES}\n  ❌ ADMIN-LOGIN: failed to get admin token"
  printf "${RED}❌ FAIL${NC} [ADMIN-LOGIN] Could not obtain admin token, using owner token\n"
  TOKEN="$OWNER_TOKEN"
fi

# ═══════════════════════════════════════════════════════════════
header "5. Auth & Identity"
# ═══════════════════════════════════════════════════════════════
check "A04" "$API/api/auth/me"
check "A05" "$API/api/me"
check "A06" "$API/api/me/tenants"

# ═══════════════════════════════════════════════════════════════
header "6. Dashboard"
# ═══════════════════════════════════════════════════════════════
check "D01" "$API/api/dashboard/kpis"
check "D02" "$API/api/dashboard/recebidos-series?days=7"
check "D03" "$API/api/dashboard/funnel"
check "D04" "$API/api/dashboard/top-matches?take=5"
check "D05" "$API/api/dashboard/open-vagas?take=5"
check "D06" "$API/api/dashboard/vagas-lookup"
check "D07" "$API/api/dashboard/areas-lookup"

# ═══════════════════════════════════════════════════════════════
header "7. Vagas"
# ═══════════════════════════════════════════════════════════════
check "V01" "$API/api/vagas?page=1&pageSize=5"
# Get first vaga ID for detail test
VAGAS_RESP=$(curl -s -H "Authorization: Bearer $TOKEN" "$API/api/vagas?page=1&pageSize=1" --max-time 10 2>/dev/null || echo "")
VAGA_ID=$(echo "$VAGAS_RESP" | grep -oP '"id":"\K[^"]+' | head -1 || echo "")

if [[ -n "$VAGA_ID" ]]; then
  check "V02" "$API/api/vagas/$VAGA_ID"
  check "V06" "$API/api/vagas/$VAGA_ID/matching?take=5"
else
  skip "V02" "No vaga found for detail test"
  skip "V06" "No vaga found for matching test"
fi

# ═══════════════════════════════════════════════════════════════
header "8. Candidatos"
# ═══════════════════════════════════════════════════════════════
check "C01" "$API/api/candidatos?page=1&pageSize=5"
CANDS_RESP=$(curl -s -H "Authorization: Bearer $TOKEN" "$API/api/candidatos?page=1&pageSize=1" --max-time 10 2>/dev/null || echo "")
CAND_ID=$(echo "$CANDS_RESP" | grep -oP '"id":"\K[^"]+' | head -1 || echo "")

if [[ -n "$CAND_ID" ]]; then
  check "C02" "$API/api/candidatos/$CAND_ID"
  check "C10" "$API/api/candidatos/$CAND_ID/status-history"
else
  skip "C02" "No candidato found"
  skip "C10" "No candidato found"
fi

# ═══════════════════════════════════════════════════════════════
header "9. Talentos"
# ═══════════════════════════════════════════════════════════════
check "T01" "$API/api/talentos?page=1&pageSize=5"
TALENTO_RESP=$(curl -s -H "Authorization: Bearer $TOKEN" "$API/api/talentos?page=1&pageSize=1" --max-time 10 2>/dev/null || echo "")
TALENTO_ID=$(echo "$TALENTO_RESP" | grep -oP '"id":"\K[^"]+' | head -1 || echo "")

if [[ -n "$TALENTO_ID" ]]; then
  check "T02" "$API/api/talentos/$TALENTO_ID"
else
  skip "T02" "No talento found"
fi

# ═══════════════════════════════════════════════════════════════
header "10. Funcionários"
# ═══════════════════════════════════════════════════════════════
check "CA01" "$API/api/funcionarios?page=1&pageSize=5"
check "CA06" "$API/api/funcionarios/users-without-funcionario"

# ═══════════════════════════════════════════════════════════════
header "11. Agenda"
# ═══════════════════════════════════════════════════════════════
check "CA07" "$API/api/agenda/types"
check "CA08" "$API/api/agenda/events"

# ═══════════════════════════════════════════════════════════════
header "12. Áreas, Departamentos, Unidades, Cargos"
# ═══════════════════════════════════════════════════════════════
check "CA13" "$API/api/areas"
check "CA14" "$API/api/departments"
check "CA15" "$API/api/units"
check "CA16" "$API/api/job-positions"

# ═══════════════════════════════════════════════════════════════
header "13. Usuários, Roles, Menus"
# ═══════════════════════════════════════════════════════════════
check "CA17" "$API/api/users"
check "CA18" "$API/api/roles"
check "CA19-list" "$API/api/menus"
check "CA19-user" "$API/api/menus/for-current-user"

# ═══════════════════════════════════════════════════════════════
header "14. Notificações"
# ═══════════════════════════════════════════════════════════════
check "CA20" "$API/api/notifications?take=10"

# ═══════════════════════════════════════════════════════════════
header "15. Feedback Module"
# ═══════════════════════════════════════════════════════════════
check "F02" "$API/api/feedback/items/mine?page=1&pageSize=5"
check "F03" "$API/api/feedback/items/all?page=1&pageSize=5"

# Celebrations
check "F05" "$API/api/feedback/celebrations/feed?page=1&pageSize=5"
check "F06" "$API/api/feedback/celebrations/mention-users?take=5"

# OneOnOne
check "F11" "$API/api/feedback/oneonone?page=1&pageSize=5"

# Development Plans
check "F17" "$API/api/feedback/plans/my?page=1&pageSize=5"
check "F18" "$API/api/feedback/plans/team?page=1&pageSize=5"

# Gamification
check "F24" "$API/api/feedback/gamification/leaderboard?page=1&pageSize=5"
check "F25" "$API/api/feedback/gamification/my-balance"
check "F26" "$API/api/feedback/gamification/history?months=3"

# Surveys
check "F27" "$API/api/feedback/surveys?page=1&pageSize=5"

# ═══════════════════════════════════════════════════════════════
header "16. AI Matching Endpoints"
# ═══════════════════════════════════════════════════════════════
TOKEN=""  # AI endpoints don't require auth

check "AI01" "$AI/health"

if [[ -n "$VAGA_ID" ]]; then
  # Only test if we have a vaga
  check "AI02" "$AI/matching/run" "POST" "{\"vaga_id\":\"$VAGA_ID\",\"tenant_id\":\"$TENANT_ID\",\"limit\":10}"
  
  if [[ -n "$CAND_ID" ]]; then
    check "AI03" "$AI/matching/evaluate-one" "POST" "{\"vaga_id\":\"$VAGA_ID\",\"person_id\":\"$CAND_ID\",\"source\":\"candidato\",\"tenant_id\":\"$TENANT_ID\"}"
    check "AI08" "$AI/search/similarity" "POST" "{\"vaga_id\":\"$VAGA_ID\",\"candidato_id\":\"$CAND_ID\",\"tenant_id\":\"$TENANT_ID\"}"
  else
    skip "AI03" "No candidato for evaluate-one"
    skip "AI08" "No candidato for similarity"
  fi
  
  # Legacy endpoints
  check "AI09" "$AI/match" "POST" "{\"vaga_id\":\"$VAGA_ID\",\"tenant_id\":\"$TENANT_ID\",\"limit\":5}"
else
  skip "AI02" "No vaga for matching"
  skip "AI03" "No vaga for evaluate-one"
  skip "AI08" "No vaga for similarity"
  skip "AI09" "No vaga for legacy match"
fi

# ═══════════════════════════════════════════════════════════════
header "17. Web (MVC) Pages — Health Check"
# ═══════════════════════════════════════════════════════════════
check "W01-login" "$WEB/Account/Login" "GET" "" "200"
check "W03-health" "$WEB/api/health" "GET" "" "200"

# ═══════════════════════════════════════════════════════════════
echo ""
printf "${CYAN}══════════════════════════════════════════════════════════════${NC}\n"
printf "${CYAN}  RESULTADO FINAL${NC}\n"
printf "${CYAN}══════════════════════════════════════════════════════════════${NC}\n"
echo ""
printf "  Total:   %d\n" "$TOTAL"
printf "  ${GREEN}Passed:  %d${NC}\n" "$PASS"
printf "  ${RED}Failed:  %d${NC}\n" "$FAIL"
printf "  ${YELLOW}Skipped: %d${NC}\n" "$SKIP"
echo ""

if [[ $FAIL -gt 0 ]]; then
  printf "${RED}Falhas:${NC}\n"
  echo -e "$FAILURES"
  echo ""
fi

if [[ $FAIL -gt 0 ]]; then exit 1; fi
exit 0
