# Deploy via GUI local (DEV e HMG)

Ferramenta Windows para publicar no servidor **sem depender do GitHub Actions** (útil quando billing/runners hosted estão bloqueados).

| Ambiente | Servidor | Branch | Compose |
| --- | --- | --- | --- |
| **DEV** | `10.0.0.79` | `portalRH-DEV` | `docker-compose.portalrh-dev.yml` |
| **HMG** | `10.0.0.80` | `portalRH-HML` | `docker-compose.hmg.yml` |

Guia DEV: [DEV-DEPLOY-SSH.md](../DEV-DEPLOY-SSH.md)

## O que ela faz (HMG ou DEV)

1. Executa `git fetch origin portalRH-HML` no repositorio local.
2. Gera um snapshot limpo de `origin/portalRH-HML` com `git archive`.
3. Envia o snapshot ao servidor por SSH/SFTP.
4. Builda no servidor as imagens da API, Web Next, Portal Vagas e RHPortal.Ai.
5. Sobe a stack com `docker compose`.
6. Exibe todos os comandos e logs em tempo real na propria GUI.

As imagens ficam locais no Docker do servidor. A ferramenta nao faz push para GHCR.

## Modos de deploy

- **Inteligente**: compara a `portalRH-HML` atual com o ultimo SHA registrado no servidor
  e builda somente os servicos afetados. Servicos sem mudanca sao retagueados a
  partir da imagem em execucao para que a stack inteira suba com a tag do SHA novo.
- **Completo**: builda API, Web Next, Portal Vagas e RHPortal.Ai sempre. Use quando
  houver duvida, mudanca grande ou erro de cache.

Regras principais do modo inteligente:

- `RHPortal.Api/**`, `Liotecnica.Integration.RM/**` ou `Liotecnica.Integration.RM.Schema/**`
  buildam a API.
- `LioTecnica.Web.Next/**` builda o Portal Admin.
- `LioTecnica.PortalVagas.React/**` builda o Portal de Vagas.
- `RHPortal.Ai/**` builda o RHPortal.Ai.
- Dockerfiles, `.dockerignore`, compose ou arquivos globais relevantes forcam deploy completo.

## Como rodar em modo desenvolvimento

```powershell
cd __scripts__\deploy\gui
python -m pip install -r requirements.txt
python deploy_gui.py
```

Preencha:

- Host: `10.0.0.80`
- Usuario: `administrator`
- Senha: senha SSH do servidor
- Repo local: raiz do repositorio RH
- Dir remoto: `/home/administrator/rh-deploys`

A senha nao e salva em arquivo.

## API URL e validacao de health (HMG)

| Campo | Valor HMG | Observacao |
| --- | --- | --- |
| **API URL (publica)** | `https://10.0.0.80:5000` | Entra ID e acesso externo. **Nao use HTTP** — a porta 5000 do host so aceita HTTPS (Nginx TLS). |
| Health pos-deploy | `http://127.0.0.1:5001/health` | Automatico na GUI: API Docker publicada em `127.0.0.1:5001`, nao na 5000. |

Ao trocar o ambiente para **HMG** na combo, os defaults recarregam (`https://…:5000`). O build do Portal Admin **nao** embute essa URL — as chamadas vao por `/api/` no `:3000`.

## Como gerar o .exe

```powershell
cd __scripts__\deploy\gui
.\build_exe.ps1
```

O executavel sera gerado em:

```text
__scripts__\deploy\gui\dist\RHPortalHmgDeploy.exe
```

## Configuracao local opcional

A GUI pode salvar `deploy_gui_config.json` ao lado do script em modo Python, ou
ao lado do `.exe` quando empacotada. Esse arquivo nao guarda senha.

Exemplo:

```json
{
  "host": "10.0.0.80",
  "user": "administrator",
  "repo_path": "D:\\Projetos\\PortalRH\\RH-devops-Lucas",
  "remote_deploy_dir": "/home/administrator/rh-deploys",
  "api_url": "https://10.0.0.80:5000",
  "admin_url": "http://10.0.0.80:3000",
  "tenant": "liotecnica"
}
```

## Rollback

Antes de subir uma nova versao, a ferramenta salva as imagens atuais dos
containers em:

```text
/home/administrator/rh-deploys/deploy-state.json
```

O botao Rollback tenta voltar para essas imagens anteriores. Ele nao rebuilda
codigo e so continua se todas as imagens anteriores ainda existirem no Docker
do servidor.

## Performance

A raiz do repo possui `.dockerignore` para reduzir o contexto enviado ao Docker.
A ferramenta tambem extrai o snapshot atual em:

```text
/home/administrator/rh-deploys/current-src
```

Isso evita depender de Git no servidor e melhora o reaproveitamento de cache em
comparacao com um diretorio novo a cada SHA.

Quando `docker buildx` estiver disponivel no servidor, a ferramenta usa cache
persistente por servico em:

```text
/home/administrator/rh-deploys/build-cache/
```

Esse cache acelera `dotnet restore`, `pnpm install`, `npm install` e `pip install`
entre deploys. A exportacao usa `mode=min` para reduzir o tempo gasto gravando
cache apos cada build. Para um rebuild totalmente limpo, use o modo **Completo**
e, se necessario, remova manualmente esse diretorio de cache no servidor.

## Observacao sobre RHPortal.Ai

Se `DATABASE_URL` ou `OPENAI_API_KEY` nao estiverem presentes em `~/.env.hmg`,
o container `rhportal-ai` pode ficar `unhealthy` e o endpoint agregado da API
`/health` pode retornar `503`. A GUI mostra esse caso como alerta, continua
automaticamente e destaca o `503` novamente na validacao final.
