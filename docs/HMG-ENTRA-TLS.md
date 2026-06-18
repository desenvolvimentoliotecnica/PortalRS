# HTTPS na API HMG (Entra ID / SSO Microsoft)

Ambiente: **10.0.0.80** (HML)

O Azure AD exige redirect URI **HTTPS**. A stack Docker expõe a API em HTTP; o TLS fica no **Nginx do host** na porta **5000**.

## Arquitetura

```text
Browser / Microsoft OAuth
        │
        ▼
https://10.0.0.80:5000  ──►  Nginx (TLS, cert autoassinado)
        │
        ▼
http://127.0.0.1:5001  ──►  Docker rhportal-api (HTTP interno)
```

## Configuração no servidor (já aplicada em 15/06/2026)

| Item | Valor |
|------|--------|
| Redirect URI Azure | `https://10.0.0.80:5000/api/auth/entra/callback` |
| Credenciais Entra (tenant/client/secret) | **Admin → Entra ID** (`/app/admin/entra-id`) — tabela `EntraIdConfigs` |
| Redirect URI + URL do Portal pós-login | **Mesma tela** — não usar `Authentication__ApiBaseUrl` no `.env.hmg` |
| Docker API ports | `127.0.0.1:5001:80` (sem HTTP público na 5000) |
| Nginx site | `/etc/nginx/sites-enabled/rhportal-api-tls` |
| Certificado | `/etc/nginx/ssl/rhportal-api.crt` (autoassinado, SAN IP 10.0.0.80) |

### Campos salvos no banco (por tenant)

| Campo na tela | Uso |
|---------------|-----|
| Directory (tenant) ID | Authority Microsoft |
| Application (client) ID | OAuth `client_id` |
| Client secret | OAuth `client_secret` (valor, não Id Secreto) |
| Redirect URI (URL completa) | Deve ser **idêntica** ao Azure e usada no challenge + troca de token |
| URL do Portal | Retorno após SSO (`http://10.0.0.80:3000/app/login#entra_token=...`) |

## Validação

```bash
# No servidor
curl -fsS http://127.0.0.1:5001/health
curl -kfsS https://127.0.0.1:5000/health
curl -kfsS 'https://10.0.0.80:5000/api/auth/entra/enabled?tenantId=liotecnica'
```

Na sua máquina (rede corporativa):

```bash
curl -k https://10.0.0.80:5000/health
```

## Certificado autoassinado

Na primeira vez, abra no browser:

`https://10.0.0.80:5000/health`

e aceite o aviso de segurança (ou peça à infra certificado da CA interna).

Sem isso, o callback do Microsoft pode falhar no browser do usuário.

## Impacto

| Antes | Depois |
|-------|--------|
| `http://10.0.0.80:5000` | **Não funciona** na 5000 |
| Portal `:3000` | **Inalterado** (proxy interno Docker) |
| Scripts que chamavam HTTP na 5000 | Usar **`https://10.0.0.80:5000`** (`curl -k` ou cert confiável) |

## CORS / `NEXT_PUBLIC_API_BASE`

O build HMG do Portal Admin deve usar **`NEXT_PUBLIC_API_BASE` vazio** (padrão no workflow).
Assim o browser chama `/api/...` em `http://10.0.0.80:3000` (mesmo origin) e o nginx do container faz proxy para a API.

Se o bundle tiver `NEXT_PUBLIC_API_BASE=http://10.0.0.80:5000`, o PUT em `/admin/entra-id` falha com CORS:
a porta 5000 pública só aceita **HTTPS** (Nginx), não HTTP.

Portal de Vagas (`:3050`) continua usando `https://10.0.0.80:5000` no build (origem diferente → CORS na API).

## Próximo deploy GitHub

O `docker-compose.hmg.yml` no repo já publica a API só em `127.0.0.1:5001`.
Mantenha o Nginx TLS na 5000 no host (ver scripts em `__scripts__/deploy/hmg-tls/`).
