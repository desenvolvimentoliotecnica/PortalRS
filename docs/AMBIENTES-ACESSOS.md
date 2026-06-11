# PortalRH - Ambientes e Acessos

Documento operacional com URLs, branches de deploy e acessos conhecidos dos ambientes DEV, HMG/HML e PRD.

> Nao registrar neste arquivo PATs, API keys, senhas de banco, chaves JWT, senhas SSH ou segredos reais. Esses valores ficam nos arquivos `.env` dos servidores ou nos secrets/variables do GitHub Actions.

## Resumo dos Ambientes

| Ambiente | Servidor | Branch de deploy | Workflow | Portal Admin | Portal de Vagas | API | AI |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DEV | `10.0.0.79` | `portalRH-DEV` | `.github/workflows/deploy-portalrh-dev.yml` | `http://10.0.0.79:3000/app` | `http://10.0.0.79:3050` | `http://10.0.0.79:5000` | `http://10.0.0.79:8000` |
| HMG/HML | `10.0.0.80` | `portalRH-HML` | `.github/workflows/deploy-hmg.yml` | `http://10.0.0.80:3000/app` | `http://10.0.0.80:3050` | `http://10.0.0.80:5000` | `http://10.0.0.80:8000` |
| PRD | `10.0.0.88` | `portalRH-PRD` | `.github/workflows/deploy-prd.yml` | `http://10.0.0.88:3000/app` | `http://10.0.0.88:3050` | `http://10.0.0.88:5000` | `http://10.0.0.88:8000` |

## URLs Operacionais

Use o host do ambiente correspondente:

| Tela/endpoint | DEV | HMG/HML | PRD |
| --- | --- | --- | --- |
| Login / Portal Admin | `http://10.0.0.79:3000/app` | `http://10.0.0.80:3000/app` | `http://10.0.0.88:3000/app` |
| Integracao TOTVS Owner | `http://10.0.0.79:3000/app/Owner/Integracao` | `http://10.0.0.80:3000/app/Owner/Integracao` | `http://10.0.0.88:3000/app/Owner/Integracao` |
| Requisicoes RM | `http://10.0.0.79:3000/app/admin/requisicoes-rm` | `http://10.0.0.80:3000/app/admin/requisicoes-rm` | `http://10.0.0.88:3000/app/admin/requisicoes-rm` |
| Health API | `http://10.0.0.79:5000/health` | `http://10.0.0.80:5000/health` | `http://10.0.0.88:5000/health` |
| Health AI | `http://10.0.0.79:8000/health/live` | `http://10.0.0.80:8000/health/live` | `http://10.0.0.88:8000/health/live` |

## Acesso ao Portal

### Owner

| Ambiente | Email | Perfil | Senha |
| --- | --- | --- | --- |
| DEV | `owner@dev.local` | Owner global | Definida no `.env` do servidor em `Seed__OwnerPassword` |
| HMG/HML | `owner@dev.local` | Owner global | Definida no `.env` do servidor em `Seed__OwnerPassword` |
| PRD | `owner@dev.local` | Owner global | Definida no `.env` do servidor em `Seed__OwnerPassword` |

### Tenant Liotecnica

Tenant padrão dos tres ambientes: `liotecnica`.

Usuários bootstrap configurados nos `docker-compose.*.yml`:

| Usuario | Email | Perfil |
| --- | --- | --- |
| Lucas Muniz Machado | `lucas.machado@liotecnica.com.br` | Gestor |
| Julia Machado Silva | `julia.machado@liotecnica.com.br` | Analista de RH |
| TELMA LIGIA DA SILVA ANTONELLI MONTINI | `telma.montini@liotecnica.com.br` | Especialista de RH |
| Fabio Barreto Diniz | `fabio@liotecnica.com.br` | Gestor |
| LioTecnica Administrador | `admin@dev.local` | Admin |

Senha dos usuarios bootstrap:

- Definida por ambiente via configuracao `BootstrapUsers` / `Seed__AdminPassword` no `.env` do servidor.
- Como `BootstrapUsers__ResetPassword=true`, a senha pode ser reaplicada durante o bootstrap conforme o valor configurado no ambiente.
- Nao versionar a senha real neste documento.

## Bancos de Dados

| Ambiente | Host | Porta | Master DB | Tenant template | Usuario DB | Senha |
| --- | --- | --- | --- | --- | --- | --- |
| DEV | `10.0.0.79` | `5432` | `portalrh_dev_master` | `portalrh_dev_{tenantId}` | `usr-portalrh-dev` | Ver `.env.portalrh-dev` no servidor |
| HMG/HML | `10.0.0.80` | `5434` | `dev_render_master` | `dev_render_{tenantId}` | `portalrh_restore` | Ver `.env.hmg` no servidor |
| PRD | `10.0.0.88` | `5434` | `portalrh_prd_master` | `portalrh_prd_{tenantId}` | `usr_portalrh_prd` | Ver `.env.prd` no servidor |

Banco tenant da Liotecnica:

| Ambiente | Database |
| --- | --- |
| DEV | `portalrh_dev_liotecnica` |
| HMG/HML | `dev_render_liotecnica` |
| PRD | `portalrh_prd_liotecnica` |

## Deploy e Promocao

Fluxo de promocao aprovado:

1. Desenvolvimento e fixes entram primeiro em `portalRH-DEV`.
2. Após validar DEV, abrir/mergear PR de `portalRH-DEV` para `portalRH-HML`.
3. Após validar HMG/HML, abrir/mergear PR de `portalRH-HML` para `portalRH-PRD`.

Deploy automatico:

| Ambiente | Disparo | Runner label |
| --- | --- | --- |
| DEV | Push em `portalRH-DEV` | self-hosted no ambiente DEV |
| HMG/HML | Push/merge em `portalRH-HML` | `hmg-deploy` |
| PRD | Push/merge em `portalRH-PRD` | `prd-deploy` |

## Observacoes de Seguranca

- PATs temporarios do GitHub nunca devem ser salvos em docs, `.env`, scripts ou commits.
- Senhas reais devem ficar apenas nos `.env` dos servidores ou em cofres/secrets apropriados.
- API keys de integracao RM devem ficar em `Seed__ApiKeys` / `Portal__ApiKey` dos ambientes, nunca neste documento.
- Antes de PRD, validar HMG/HML com login, health checks, `Owner/Integracao` e `admin/requisicoes-rm`.
- Se telas RM falharem com timeout ou `nc` para `172.19.30.3:1433` der `No route to host`, ver runbook [**HMG-RM-ROTA-REDE.md**](HMG-RM-ROTA-REDE.md) (conflito rota Docker × rede corporativa no `dev-hmg`).
