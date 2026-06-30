#!/usr/bin/env bash
# Executar NO SERVIDOR HMG (conta que tem ~/actions-runner), depois de obter token na UI:
#   Settings → Actions → Runners → New self-hosted runner
#
# Uso:
#   export RUNNER_TOKEN='xxxxxxxxxxxxxxxxxxxxxxxxxxxx'
#   bash register-runner-hmg.sh
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/desenvolvimentoliotecnica/PortalRS}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/actions-runner}"

if [[ -z "${RUNNER_TOKEN:-}" ]]; then
  echo "Define RUNNER_TOKEN com o token da página \"New self-hosted runner\" do GitHub."
  exit 1
fi

cd "$INSTALL_DIR"
test -x ./config.sh || { echo "Runner não encontrado em $INSTALL_DIR"; exit 1; }

./config.sh --url "$REPO_URL" --token "$RUNNER_TOKEN" --labels hmg-deploy --unattended --replace

echo "OK: runner configurado. Instalar serviço com:"
echo "  cd $INSTALL_DIR && sudo ./svc.sh install && sudo ./svc.sh start"
