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
| `Authentication__ApiBaseUrl` | `https://10.0.0.80:5000` |
| Docker API ports | `127.0.0.1:5001:80` (sem HTTP público na 5000) |
| Nginx site | `/etc/nginx/sites-enabled/rhportal-api-tls` |
| Certificado | `/etc/nginx/ssl/rhportal-api.crt` (autoassinado, SAN IP 10.0.0.80) |

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

## Próximo deploy GitHub

O workflow copia `docker-compose.hmg.yml` do repo, que ainda mapeia `5000:80`.
**Após cada deploy**, conferir se a API voltou a publicar HTTP na 5000 (conflito com Nginx).

Scripts de reaplicação: [`__scripts__/deploy/hmg-tls/`](../__scripts__/deploy/hmg-tls/)

## Pendente para SSO funcionar

1. Gravar config Entra no tenant `liotecnica` (tela admin ou API)
2. Corrigir bug da tela admin (`entraTenantId` vs `tenantId`)
3. Testar login em `/app/login` → Entrar com Microsoft
