# Deploy automático HMG (GitHub Actions)

Fluxo: **push/merge em `portalRH-HML`** (por exemplo merge de um PR vindo de `portalRH-DEV`) dispara [`.github/workflows/deploy-hmg.yml`](../.github/workflows/deploy-hmg.yml):

1. **Job `build-and-push`** (runner hospedado pela Microsoft — `ubuntu-latest`): build das imagens e push para **GHCR**.
2. **Job `deploy-hmg`** (runner **self-hosted** com label `hmg-deploy`): corre **dentro da tua rede** e faz SCP/SSH para o host onde corre o Docker (ex. `10.0.0.80`), executando `docker compose pull` e `up`.

Motivo: IPs **privados** (10.x / 172.16 / 192.168) **não são alcançáveis** a partir dos runners públicos do GitHub. O deploy tem de correr num agente na **mesma LAN/VPN** que o servidor.

As **migrations EF** continuam a correr no arranque da API (`DbSeeder.MigrateAndSeedAsync`); não há job separado de migrate.

## Self-hosted runner (obrigatório para `deploy-hmg`)

Guia passo a passo no servidor **`10.0.0.80`** (pacote já descarregado em `~/actions-runner`): [**HMG-RUNNER-SETUP.md**](HMG-RUNNER-SETUP.md) — falta apenas **registar** com token de administrador do repo e opcionalmente `svc.sh install`.

1. Num **VM ou PC Linux** na **mesma rede** que o servidor HMG (ou no próprio servidor, se instalares o agent lá), instalá-lo conforme a documentação oficial: [Adding self-hosted runners](https://docs.github.com/en/actions/how-tos/hosting-your-own-runners/managing-self-hosted-runners/adding-self-hosted-runners).
2. Ao correr `./config.sh`, define um **label** dedicado para este ambiente — o workflow usa **`hmg-deploy`**:
   ```text
   ./config.sh --url https://github.com/<org>/<repo> --token <token> --labels hmg-deploy
   ```
   (Se já configuraste sem label, podes repetir `./config.cmd remove` no Windows ou reconfigurar e acrescentar o label nas definições do runner no GitHub: **Settings → Actions → Runners → teu runner → etiquetas**.)
3. Instalação de software típica no host do runner (**Linux**): `git`, cliente **OpenSSH** (`ssh`, `scp`), e **Docker** apenas se futuramente moveres passos para o próprio runner; para o fluxo atual basta conseguires **SSH/SCP** até ao utilizador configurado em `SSH_USER`@`SSH_HOST`.
4. Arranca o runner: `./run.sh` (Linux) ou o serviço recomendado na doc.

**Se o runner estiver no próprio servidor** `10.0.0.80`: podes pôr nos secrets `SSH_HOST=127.0.0.1` (e chave autorizada para `SSH_USER`), desde que **sshd** esteja activo para loopback — assim o mesmo job continua igual.

**Pacotes GHCR**: o servidor Docker (onde corre `docker compose pull`) ainda precisa de `GHCR_PULL_USER` / `GHCR_PULL_TOKEN` para autenticar no registry; isto não muda ao usar self-hosted no deploy.

## URLs por defeito nos builds estáticos

Os defaults no workflow apontam para `http://10.0.0.80:5000` (API), `http://10.0.0.80:3000` (Portal Admin), etc. Podes sobrescrever no GitHub em **Settings → Secrets and variables → Actions → Variables**:

| Variable | Uso |
|----------|-----|
| `HMG_NEXT_PUBLIC_API_BASE` | Build Next.js — URL pública da API |
| `HMG_NEXT_PUBLIC_PORTAL_ORIGIN` | Build Next.js — origem do portal admin |
| `HMG_VITE_API_BASE_URL` | Build Vite — base URL da API |
| `HMG_VITE_DEFAULT_TENANT` | Build Vite — tenant por defeito |

## Secrets obrigatórios (repositório)

| Secret | Descrição |
|--------|-----------|
| `SSH_PRIVATE_KEY` | Chave SSH privada (formato OpenSSH), só para deploy — **sem passphrase** ou usa agent no runner com cuidado |
| `SSH_HOST` | Destino SCP/SSH: normalmente `10.0.0.80` (ou `127.0.0.1` se o runner for o próprio servidor e o sshd aceitar loopback) |
| `SSH_USER` | Utilizador SSH (ex.: `administrator`) |
| `GHCR_PULL_USER` | Opcional. Use apenas em deploy manual fora do GitHub Actions |
| `GHCR_PULL_TOKEN` | Opcional. Use apenas em deploy manual fora do GitHub Actions |

O workflow faz login em `ghcr.io` **no servidor** com `${{ github.actor }}` + `${{ secrets.GITHUB_TOKEN }}` para executar `docker compose pull`, igual ao fluxo DEV. Isso evita depender de PAT separado com escopo de pacotes.

**Nota:** Para execução manual do script fora do GitHub Actions, ainda é possível exportar `GHCR_PULL_USER` e `GHCR_PULL_TOKEN` antes de rodar `hmg-compose-pull-up.sh`.

## Primeira configuração no servidor

1. **Docker** e plugin **Compose v2** (`docker compose`).
2. Rede (uma vez):

   ```bash
   docker network create rhportal-net
   ```

   **Integração RM (SQL `172.19.30.3`, REST `172.19.30.37`):** se a rede Docker usar a faixa `172.19.0.0/16`, o host pode deixar de alcançar o segmento corporativo `172.19.30.0/24` (sintoma: `No route to host` no `nc`, telas RM expiram). Configure rota estática no netplan — runbook completo em [**HMG-RM-ROTA-REDE.md**](HMG-RM-ROTA-REDE.md).

3. Ficheiro **`~/.env.hmg`** com variáveis necessárias à **API** (`ConnectionStrings`, `ASPNETCORE_*`, etc.) e ao **RHPortal.Ai** (`DATABASE_URL`, chaves LLM, etc.).  
   Não commits este ficheiro — mantém-se só no servidor.  
   Vê o modelo comentado em [`docs/env.hmg.example`](env.hmg.example).  
   Podes partir das variáveis dos contentores actuais (`docker inspect rhportal-api`) ou da documentação interna de ambiente.

4. **Permissões**: o utilizador SSH deve poder correr `docker` (grupo `docker` ou equivalente).

5. Opcional: criar `~/rhportal-hmg/` antes do primeiro deploy — o workflow já envia `docker-compose.hmg.yml` para `~/rhportal-hmg/`.

6. **Uploads da API (documentos do portal, CV, inbox):** o serviço `api` monta o volume  
   `HMG_API_APP_DATA_DIR` (por defeito `/home/administrator/rhportal-hmg/api-app-data`) em `/app/App_Data`.  
   Sem este volume, cada `docker compose up` apaga os ficheiros no disco do contentor e o download no RH devolve **404**, embora os metadados continuem na base de dados.  
   Após activar o volume, documentos antigos **sem** ficheiro no host precisam ser reenviados pelo candidato ou pelo RH.

## Ficheiros usados pelo workflow no servidor

Após cada deploy, em `~/rhportal-hmg/` ficam (entre outros):

- `docker-compose.hmg.yml` — cópia a partir do repo.
- `hmg-compose-pull-up.sh` — [`__scripts__/deploy/hmg-compose-pull-up.sh`](../__scripts__/deploy/hmg-compose-pull-up.sh) (pull + `compose up`).  
  Durante o job é criado um `.deploy.env` temporário com prefixo de imagem e credenciais GHCR; é removido no fim do passo.

## Modelo local do compose

Na raiz do repo: [`docker-compose.hmg.yml`](../docker-compose.hmg.yml). Variáveis esperadas no shell ao correr manualmente:

- `HMG_REGISTRY_PREFIX` — ex.: `ghcr.io/meu-org/meu-repo`
- `HMG_IMAGE_TAG` — ex.: SHA completo do commit
- `HMG_ENV_FILE` — opcional; por defeito `.env.hmg` ao lado do compose

## Fluxo manual antigo (GUI/tar + docker load)

O fluxo regular de HML deve usar PR para `portalRH-HML` + GitHub Actions.

A ferramenta antiga em [`__scripts__/deploy/gui/deploy_gui.py`](../__scripts__/deploy/gui/deploy_gui.py) deixava artefatos em `~/rh-deploys` e subia a stack a partir de `~/rh-deploys/current-src`. Ao migrar para o fluxo novo:

- Pare/substitua somente a stack `rhportal-hmg`.
- Use `~/rhportal-hmg/` como diretório operacional do workflow.
- Só remova `~/rh-deploys` depois de confirmar que o deploy novo está saudável.

## Segurança

- Rotaciona passwords e PATs expostos por engano.
- Restringe quem pode fazer merge em `main` e considera **Environment** no GitHub com aprovação manual antes do job `deploy-hmg`.
