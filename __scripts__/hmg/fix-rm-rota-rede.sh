#!/usr/bin/env bash
# Diagnóstico e correção de rota RM no dev-hmg (10.0.0.80).
# Runbook: docs/HMG-RM-ROTA-REDE.md
set -euo pipefail

RM_NET="172.19.30.0/24"
RM_GW="10.0.0.254"
RM_SQL="172.19.30.3"
RM_REST="172.19.30.37"
NETPLAN="/etc/netplan/50-cloud-init.yaml"
API_CONTAINER="${API_CONTAINER:-rhportal-api}"

red() { printf '\033[31m%s\033[0m\n' "$*"; }
grn() { printf '\033[32m%s\033[0m\n' "$*"; }
ylw() { printf '\033[33m%s\033[0m\n' "$*"; }

section() { echo; echo "========== $* =========="; }

route_ok() {
  ip route get "$1" 2>/dev/null | grep -q "via ${RM_GW} dev ens160"
}

test_port() {
  local host="$1" port="$2" label="$3"
  if nc -zv -w 5 "$host" "$port" 2>&1 | grep -qi succeeded; then
    grn "OK  $label ($host:$port)"
    return 0
  fi
  red "FAIL $label ($host:$port)"
  return 1
}

section "1. Rotas atuais"
ip route show | grep -E '172\.19\.30|default' || true
echo "--- ip route get ---"
ip route get "$RM_SQL" || true
ip route get "$RM_REST" || true

section "2. Teste TCP (host)"
HOST_OK=0
test_port "$RM_SQL" 1433 "SQL RM" && HOST_OK=1 || true
test_port "$RM_REST" 8051 "REST RM" && HOST_OK=1 || true

section "3. Teste TCP (container $API_CONTAINER)"
if docker ps --format '{{.Names}}' | grep -qx "$API_CONTAINER"; then
  if docker exec "$API_CONTAINER" sh -c "command -v nc >/dev/null && nc -zv -w 5 $RM_REST 8051" 2>&1 | grep -qi succeeded; then
    grn "OK  REST RM from container"
  else
    red "FAIL REST RM from container (mesmo sintoma do worker)"
    docker exec "$API_CONTAINER" sh -c "nc -zv -w 5 $RM_REST 8051" 2>&1 || true
  fi
else
  ylw "Container $API_CONTAINER não encontrado — pulando teste in-container"
fi

if route_ok "$RM_REST" && [ "$HOST_OK" -eq 1 ]; then
  section "Rede OK — nada a corrigir no netplan"
  grn "Se o worker ainda falhar, verifique serviço RM em ${RM_REST}:8051 ou credenciais em /app/admin/configuracao-rm"
  exit 0
fi

section "4. Diagnóstico"
if ! route_ok "$RM_REST"; then
  red "Rota incorreta: tráfego para 172.19.30.x não usa ${RM_GW} via ens160 (provável conflito Docker 172.19.0.0/16)"
  NEED_FIX=1
else
  ylw "Rota parece correta, mas porta falhou — pode ser serviço RM parado ou firewall"
  NEED_FIX=0
fi

if [ "${NEED_FIX:-0}" -eq 1 ]; then
  section "5. Aplicar correção netplan (${RM_NET} via ${RM_GW})"
  if [ ! -f "$NETPLAN" ]; then
    red "Arquivo $NETPLAN não encontrado — abortando"
    exit 1
  fi

  sudo cp "$NETPLAN" "${NETPLAN}.bak-$(date +%Y%m%d-%H%M%S)"

  if grep -q "172.19.30.0/24" "$NETPLAN" 2>/dev/null; then
    ylw "Netplan já contém 172.19.30.0/24 — aplicando netplan apply"
  else
    ylw "Aplicando netplan padrão HMG (backup já criado)..."
    sudo tee "$NETPLAN" > /dev/null <<'EOF'
network:
  version: 2
  ethernets:
    ens160:
      addresses:
      - "10.0.0.80/24"
      nameservers:
        addresses:
        - 10.0.0.51
        search: []
      routes:
      - to: "default"
        via: "10.0.0.254"
      - to: "172.19.30.0/24"
        via: "10.0.0.254"
EOF
  fi

  # Limpar rotas conflitantes
  while ip route show | grep -q "172.19.30.0/24 via 10.0.0.1"; do
    sudo ip route del 172.19.30.0/24 via 10.0.0.1 dev ens160 || break
  done

  sudo netplan generate
  sudo netplan apply

  section "6. Verificação pós-correção"
  ip route show | grep 172.19.30 || true
  ip route get "$RM_REST" || true
  test_port "$RM_SQL" 1433 "SQL RM" || true
  test_port "$RM_REST" 8051 "REST RM" || true
fi

section "7. Próximo ciclo worker"
ylw "Aguarde até 15 min ou baixe log em /app/admin/tenant-configuracao → Ver execuções"
curl -fsS http://127.0.0.1:5001/health >/dev/null 2>&1 && grn "API health OK (5001)" || curl -fsS http://127.0.0.1:5000/health >/dev/null 2>&1 && grn "API health OK (5000)" || ylw "API health não respondeu em 5001/5000"
