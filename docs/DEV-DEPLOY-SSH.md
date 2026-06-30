# Deploy DEV via SSH (sem GitHub Actions)

Use este fluxo quando o GitHub Actions estiver indisponível (billing, runners hosted, etc.).
O build roda **no servidor** `10.0.0.79`; não há push para GHCR.

## Pré-requisitos

1. **VPN/rede** com acesso SSH ao `10.0.0.79`.
2. **Git** no Windows (para `git archive` da branch `DEV`).
3. **Python 3.11+** com dependências da GUI:
   ```powershell
   cd __scripts__\deploy\gui
   python -m pip install -r requirements.txt
   ```
4. No servidor DEV:
   - Docker + Docker Compose
   - Arquivo `~/.env.portalrh-dev` (ver `docs/env.portalrh-dev.example`)
   - Usuário no grupo `docker` (ex.: `administrator`)

## Como executar

### Opção A — atalho

```powershell
.\abrir-deploy-rhportal.bat
```

### Opção B — manual

```powershell
cd D:\Projetos\PortalRH\PortalRS
python __scripts__\deploy\gui\deploy_gui.py
```

## Configuração na GUI

1. **Ambiente:** `dev — DEV (10.0.0.79)`
2. **Host:** `10.0.0.79`
3. **Usuário:** `administrator`
4. **Senha:** senha SSH (não é salva em arquivo)
5. **Repo local:** raiz do repositório RH
6. **Dir remoto:** `/home/administrator/rh-deploys-dev`

URLs padrão DEV:

| Campo | Valor |
| --- | --- |
| API URL | `http://10.0.0.79:5000` |
| Admin URL | `http://10.0.0.79:3000/app` |
| Portal Vagas URL | `http://10.0.0.79:3050` |
| Tenant | `liotecnica` |

## Modos

- **Inteligente:** builda só serviços alterados desde o último deploy registrado no servidor.
- **Completo:** builda API, Web Next, Portal Vagas e RHPortal.Ai (recomendado após falha ou dúvida).

## O que a ferramenta faz

1. `git fetch` da branch `DEV`
2. Snapshot (`git archive`) enviado por SFTP
3. Limpeza de disco (cache Docker, imagens antigas)
4. `docker build` no servidor (tags locais `ghcr.io/desenvolvimentoliotecnica/portalrs/rhportal-*:<sha>`)
5. `docker compose -f docker-compose.portalrh-dev.yml up -d`
6. Validação de health (`/health`, `/app/login`, Portal Vagas)

## Limpeza de disco no servidor

Se o deploy falhar por falta de espaço, no servidor:

```bash
docker system df
df -h /
docker builder prune -af
docker image prune -af
```

O script `__scripts__/deploy/docker-deploy-purge.sh` também roda automaticamente antes/depois do `compose up` quando disponível no snapshot.

## Rollback

A GUI grava imagens anteriores em `/home/administrator/rh-deploys-dev/deploy-state.json`.
Use o botão **Rollback** para voltar ao SHA anterior (sem rebuild).

## HMG

Na mesma GUI, selecione **Ambiente → hmg — HMG (10.0.0.80)** (branch `HML`, compose `docker-compose.hmg.yml`).

Documentação complementar: [HMG-DEPLOY-GUI.md](./HMG-DEPLOY-GUI.md)
