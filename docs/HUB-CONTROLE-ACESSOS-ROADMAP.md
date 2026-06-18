# Roadmap — Controle de Acessos no Hub Corporativo

Documento de acompanhamento. Plano original: `plano-controle-acessos-hub-corporativo.md`.

---

## Decisão de arquitetura (equipe — jun/2026)

**O Hub é portal de autenticação e launcher. Não governa o que o usuário faz dentro de cada sistema.**

| Responsabilidade | Quem controla |
|------------------|---------------|
| Login corporativo (Entra), sessão no Hub | **Hub** |
| Quais **sistemas/apps** o usuário **pode abrir** | **Hub** |
| O que o usuário **pode fazer dentro** do Portal RH (criar vaga, aprovar candidato, etc.) | **Portal RH** (RBAC por tenant, já existente) |
| O que o usuário faz dentro de TOTVS, BI, etc. | **Cada sistema** |

**Modelo alvo revisado:**

```text
Hub:     Usuário → Perfil → Acesso a Sistema(s)
Portal:  Usuário → Perfil/Role → Permissão de ação (RequirePermission, etc.)
```

O Hub **não** envia `portalrh.vagas.criar` no SSO. O SSO continua repassando identidade (e-mail); o Portal resolve roles/permissões no tenant.

---

## Status geral

| Fase | Escopo original | Status | Próximo passo |
|------|-----------------|--------|--------------|
| **1** | IAM granular (módulos + permissões de ação) | ✅ Entregue (PR #227) | **Simplificar** modelo para acesso a sistemas |
| **2** | APIs de permissões granulares | ✅ Entregue (PR #227) | Ajustado na 2.1 |
| **2.1** | Acesso a sistemas (sem ações in-app) | ✅ Concluída | — |
| **3** | Admin CRUD de permissões por módulo | ✅ Concluída | Usuários, perfis, sistemas, auditoria |
| **4** | SSO com permissões para Portal | ❌ **Fora de escopo** | Manter SSO só identidade |
| **5** | Escopos in-app, solicitações | ⚪ Parcial | Solicitação de **acesso a sistema** no Hub; escopos operacionais no Portal |

---

## O que permanece válido (Fases 1–2 já deployadas)

- Catálogo de **sistemas** (`HubSystem`) e **aplicativos** (`HubApplication` + vínculo `SystemId`)
- **Usuários** IAM (`HubUser`) provisionados no login
- **Perfis** (`HubProfile`) como agrupamento de acessos
- APIs úteis (com semântica a revisar):
  - `GET /api/auth/me` — usuário + perfis
  - `GET /api/hub/meus-sistemas` — **principal** para launcher
- Filtro de tiles em `/Apps`: usuário só vê apps dos sistemas que tem acesso
- Regras legadas `HubApplicationAccessRule` (e-mail/domínio) até migrar todos para IAM

---

## O que muda / simplifica

### Modelo de permissão no Hub

**Antes (plano original):** `{sistema}.{modulo}.{acao}` — ex. `portalrh.vagas.criar`  
**Depois (decisão equipe):** acesso binário ao sistema — ex. `hub.sistema.portalrh` ou perfil → lista de sistemas

| Entidade | Manter | Simplificar / deprecar |
|----------|--------|-------------------------|
| `HubSystem` | ✅ | — |
| `HubUser`, `HubProfile`, `HubUserProfile` | ✅ | — |
| `HubSystemModule` | ⚠️ | Opcional; só se módulos forem do **Hub** (favoritos, admin) |
| `HubPermission` (portalrh.*) | ❌ | Remover seeds de ações do Portal; manter só permissões **de acesso** |
| `HubAccessScope` (filial/unidade) | ❌ no Hub | Escopo operacional fica no **Portal RH** |
| `AuthorizeHubPermission("portalrh…")` | ❌ | Usar só para rotas **do Hub** (ex. admin) |

### Fases replanejadas

#### Fase 2.1 — Ajuste pós-decisão (próxima entrega técnica)

- [x] Entidade `HubProfileSystemAccess` (perfil → sistema)
- [x] Redefinir seeds: perfis concedem **sistemas**, não ações do Portal RH
- [x] `GET /api/hub/meus-acessos` (contrato principal)
- [x] `GET /api/hub/meus-sistemas` filtrado por acesso a sistema
- [x] `GET /api/hub/verificar-acesso-sistema?codigo=portalrh`
- [x] `HubApplicationService`: visibilidade por `ProfileSystemAccess`
- [x] Desativar permissões legadas `portalrh.*` no seed (migração HMG)
- [x] Atualizar `/Admin/Access` para “acesso a sistemas”
- [x] `minhas-permissoes` marcado legado; `verificar-permissao` só `hub.*`

#### Fase 3 — Administração (escopo revisado)

- [x] CRUD Usuários e Perfis
- [x] Tela perfil: checkboxes **por sistema** (Portal RH, TOTVS, Intranet…)
- [x] CRUD Sistemas / vínculo Aplicativo→Sistema no formulário de apps
- [x] Auditoria: quem ganhou/perdeu acesso a qual sistema
- [ ] ~~CRUD módulos/permissões granulares do Portal~~ **removido do Hub**

#### Fase 4 — Integração Portal RH (revisada)

- [ ] SSO Hub → Portal: **somente e-mail + tenant** (como hoje)
- [ ] Portal continua fonte de verdade para roles/`RequirePermission`
- [ ] ~~Token com portalrh.*~~ **cancelado**
- [ ] Opcional: ao primeiro SSO, Portal **provisiona** usuário no tenant se não existir (fluxo Portal, não Hub)

#### Fase 5 — Solicitações (Hub)

- [ ] Usuário solicita **acesso a um sistema** (não a uma ação)
- [ ] Aprovação → perfil/sistema liberado no Hub
- [ ] Notificação + auditoria

---

## Mapeamento: plano original vs decisão

| Plano original | Decisão equipe |
|----------------|----------------|
| Hub = catálogo de permissões de ação | Hub = catálogo de **sistemas** + quem acessa |
| `portalrh.vagas.criar` no Hub | `portalrh.vagas.criar` no **Portal RH** |
| SSO repassa permissões | SSO repassa **identidade** |
| Escopo filial no Hub | Escopo filial no **Portal** (já há claims de escopo) |
| Perfil Analista RH = ações no RH | Perfil no Hub = **pode abrir Portal RH**; perfil no Portal = **o que faz lá** |

---

## Referências no código (estado atual — PR #227)

```
LiotecnicaHub/LiotecnicaHub.Web/
├── Domain/Entities/HubSystem.cs          ← manter (core)
├── Domain/Entities/HubPermission.cs      ← simplificar uso (só acesso)
├── Infrastructure/Data/HubAccessSeedData.cs ← revisar seeds
├── Application/Access/HubAccessService.cs
├── Controllers/AuthApiController.cs
└── Pages/Admin/Access/Index.cshtml
```

Portal RH (sem mudança de responsabilidade):

```
RHPortal.Api/.../Infrastructure/Security/RequirePermissionAttribute.cs
RHPortal.Api/.../RolePermissionManifest.cs
```

---

## Resumo para conversa com PO

> O Hub responde: **“Este usuário pode entrar no Portal RH (ou TOTVS, ou BI)?”**  
> O Portal RH responde: **“Dentro do Portal, este usuário pode criar vaga, aprovar candidato, etc.?”**

Isso evita duplicar RBAC, reduz acoplamento no SSO e mantém cada sistema autônomo — alinhado ao que a equipe definiu.

---

_Última atualização: Fase 3 — administração IAM (usuários, perfis, sistemas, auditoria)._
