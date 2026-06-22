# Hub Corporativo — Integração SSO com sistemas externos

Documento de acompanhamento da iniciativa de **acesso único (SSO)** entre o **Liotecnica Hub** e aplicativos de fornecedores.

**Status:** e-mail enviado aos fornecedores — **aguardando respostas** (jun/2026).

Quando houver retorno dos fornecedores, retomar este tema no repositório / com a equipe técnica.

---

## Contexto

O **Liotecnica Hub** (`https://10.0.0.80:3010/Login`) é o portal corporativo de entrada:

- Login único via **Active Directory (LDAP)** e, quando habilitado, **Microsoft Entra ID**
- Exibe tiles dos aplicativos liberados por usuário
- Controla **quem pode abrir** cada sistema (acesso por aplicativo)
- **Não** governa permissões operacionais dentro de cada sistema (isso fica com cada aplicação)

Hoje:

| Cenário | Comportamento |
|---------|---------------|
| **Portal RH** (interno) | SSO implementado — token HMAC assinado, redirect para `/api/auth/hub-sso` |
| **Sistemas externos sem integração** | Hub abre apenas a URL — usuário precisa logar novamente no sistema do fornecedor |

**Objetivo:** ao clicar no tile no Hub, o colaborador deve entrar automaticamente no sistema do fornecedor, quando tecnicamente viável.

Referências técnicas no repositório:

- `LiotecnicaHub/` — launcher, LDAP, `HubLaunchService`
- `docs/HUB-CONTROLE-ACESSOS-ROADMAP.md` — arquitetura (Hub = identidade + acesso a apps)
- `docs/HUB-DEPLOY.md` — deploy e fluxo SSO Portal RH
- `RHPortal.Api/.../AuthController.cs` — endpoint `GET /api/auth/hub-sso`

---

## O que foi solicitado aos fornecedores

E-mail enviado em **jun/2026** solicitando, para cada sistema que será cadastrado no Hub:

1. **Protocolos SSO suportados** (SAML 2.0, OpenID Connect/OAuth 2.0, JWT assinado, etc.)
2. **Papel na integração** — SP com IdP corporativo (Entra/AD) vs. autenticação iniciada pelo Hub
3. **Documentação técnica** — metadados, redirect URIs, claims/atributos
4. **Identificador do usuário** — e-mail, UPN, matrícula, etc.
5. **Provisionamento** — cadastro prévio vs. JIT no primeiro login federado
6. **Ambientes** — HML/PRD, URLs, requisitos de firewall
7. **Contato técnico** para alinhamento e testes

**Oferecido do nosso lado:**

- Identidade via AD (LDAP) e/ou Microsoft Entra ID
- Hub como launcher com controle de acesso por aplicativo
- Equipe técnica para IdP, certificados, redirect URIs e testes
- Hub HMG: `https://10.0.0.80:3010`

---

## Modelo já operacional (Portal RH — referência interna)

Fluxo resumido:

```text
Usuário autenticado no Hub
  → Hub gera token assinado (e-mail, tenant, returnUrl, nonce; TTL ~60s)
  → Redirect GET {api}/api/auth/hub-sso?token=...&returnUrl=...
  → Portal valida HMAC, cria sessão JWT, redireciona ao app
```

Chave compartilhada: `Hub__StateSigningKey` (Hub) = `HubSso__SigningKey` (API Portal).

Fornecedores externos provavelmente exigirão **SAML** ou **OIDC** em vez de token customizado — avaliar caso a caso conforme respostas.

---

## Próximos passos (quando houver retorno)

- [ ] Consolidar respostas dos fornecedores (protocolo, docs, contato)
- [ ] Definir arquitetura por sistema (SAML IdP Entra vs. OIDC vs. extensão `HubLaunchService`)
- [ ] Cadastrar apps no Hub (`/Admin/Applications`) com URLs de launch
- [ ] Homologação com usuários piloto
- [ ] Go-live produção

---

## Registro de fornecedores / sistemas

Preencher conforme as respostas chegarem.

| Sistema | Fornecedor | SSO suportado | Status | Contato | Observações |
|---------|------------|---------------|--------|---------|-------------|
| *(a preencher)* | | | E-mail enviado | | |

---

## Histórico

| Data | Evento |
|------|--------|
| jun/2026 | Rascunho de e-mail para fornecedores (SSO/LDAP × Hub) |
| jun/2026 | E-mail enviado aos fornecedores — aguardando respostas |
