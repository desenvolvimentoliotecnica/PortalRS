# Roadmap — Controle de Acessos Granulares no Hub Corporativo

Documento de acompanhamento do plano técnico (`plano-controle-acessos-hub-corporativo.md`).

**Modelo alvo:** `Usuário → Perfil → Permissão → Escopo`  
**Padrão de permissão:** `{sistema}.{modulo}.{acao}` (ex.: `portalrh.vagas.criar`)

---

## Status geral

| Fase | Escopo | Status |
|------|--------|--------|
| **1** | Fundação (modelo, seeds, validação) | ✅ Concluída |
| **2** | APIs de consulta e autorização | ✅ Concluída |
| **3** | Admin UI completa (CRUD) | ⚪ Pendente |
| **4** | Integração Portal RH / SSO com permissões | ⚪ Pendente |
| **5** | Escopos operacionais, solicitações, auditoria avançada | ⚪ Pendente |

---

## Fase 1 — Fundação ✅ entrega validável

**Objetivo:** Banco modelado, seeds iniciais, painel de leitura para conferência.

### Entregas

- [x] Entidades: `HubUser`, `HubProfile`, `HubSystem`, `HubSystemModule`, `HubPermission`
- [x] Associações: `HubUserProfile`, `HubProfilePermission`, `HubUserProfileScope`
- [x] `HubAccessScope`, `HubAccessAudit`
- [x] Migration EF `AddControleAcessosFase1`
- [x] Seeds: sistemas, módulos, permissões, perfis e vínculos iniciais
- [x] Migração de `HubAdmins` → usuário + perfil `administrador`
- [x] Página `/Admin/Access` — resumo do catálogo IAM (validação visual)
- [x] Link no painel admin

### Como validar

1. Subir o Hub local (`dotnet run --launch-profile http`).
2. Entrar como admin (Entra ou bootstrap).
3. Acessar **Admin → Controle de Acessos**.
4. Conferir contagens: sistemas (9+), módulos, permissões, perfis (6).
5. Expandir perfis e ver permissões associadas (ex.: `analista-rh`, `coordenador-rh`).
6. Verificar no banco (SQLite `App_Data/liotecnica_hub.db` ou Postgres HMG) tabelas `HubSystems`, `HubPermissions`, etc.

### Fora do escopo da Fase 1

- Endpoints REST (`/api/auth/minhas-permissoes`, etc.)
- CRUD administrativo de usuários/perfis
- Filtro de apps visíveis por perfil (mantém `HubApplicationAccessRule`)
- SSO repassando permissões ao Portal RH
- Solicitações de acesso

---

## Fase 2 — APIs de consulta

**Objetivo:** Hub expõe permissões para frontend e sistemas integrados.

- [x] `GET /api/auth/me`
- [x] `GET /api/auth/minhas-permissoes`
- [x] `GET /api/hub/meus-sistemas`
- [x] `GET /api/auth/verificar-permissao?codigo=...`
- [x] `AuthorizeHubPermissionAttribute` + policy provider + handler
- [x] Sincronizar `HubUser` no login Entra/dev (upsert por e-mail)
- [x] Visibilidade de apps por IAM quando usuário tem perfis (`hub.aplicativos.visualizar`)

**Critério de pronto:** Postman/curl retorna permissões do usuário logado; apps filtrados por perfil.

### Como validar (Fase 2)

1. Login como admin (perfil `administrador` no seed).
2. Com cookie de sessão, chamar:
   - `GET http://localhost:3010/api/auth/me`
   - `GET http://localhost:3010/api/auth/minhas-permissoes`
   - `GET http://localhost:3010/api/hub/meus-sistemas`
   - `GET http://localhost:3010/api/auth/verificar-permissao?codigo=portalrh.vagas.criar`
   - `GET http://localhost:3010/api/hub/access/probe` (exige `hub.auditoria.visualizar`)
3. Usuário **sem** perfis IAM continua com regras legadas de e-mail/domínio nos apps.
4. Usuário **com** perfis IAM precisa de `hub.aplicativos.visualizar` para ver tiles em `/Apps`.

---

## Fase 3 — Admin UI completa

**Objetivo:** Operação sem SQL.

- [ ] Seção **Administração de Acessos** na sidebar
- [ ] CRUD Usuários, Perfis, Sistemas, Módulos, Permissões
- [ ] Tela de perfil com checkboxes por sistema/módulo
- [ ] Listagem de auditoria (`HubAccessAudit`)

**Critério de pronto:** Admin altera perfil de um usuário e vê reflexo em `/api/auth/minhas-permissoes`.

---

## Fase 4 — Integração Portal RH

**Decisão pendente:** Hub como fonte única (A), só visibilidade (B) ou sync (C).

- [ ] Definir opção A/B/C com PO
- [ ] Mapear permissões `portalrh.*` ↔ chaves atuais do Portal (`RequirePermission`)
- [ ] Estender token SSO Hub → Portal com claims de permissão/escopo
- [ ] Portal valida `portalrh.*` ou sincroniza roles por tenant

**Critério de pronto:** Usuário sem `portalrh.vagas.criar` recebe 403 ao criar vaga.

---

## Fase 5 — Escopos, solicitações e auditoria

- [ ] Validação `PossuiEscopo(tipo, codigo)` nos backends
- [ ] Tabela `HubAccessRequest` (solicitações de acesso)
- [ ] Fluxo aprovação gestor → TI/admin
- [ ] Auditoria automática em toda alteração de perfil/permissão

---

## Decisões em aberto

| # | Tema | Opções | Decisão |
|---|------|--------|---------|
| 1 | Hub vs Portal RBAC | A centraliza / B coexistem / C sync | _Pendente_ |
| 2 | Formato permissões Portal | Adotar `portalrh.*` ou mapear chaves atuais | _Pendente_ |
| 3 | Provisioning usuários | Auto no login Entra vs cadastro manual | _Pendente_ |
| 4 | Origem dos escopos | RM/TOTVS vs cadastro Hub | _Pendente_ |

---

## Referências no código

```
LiotecnicaHub/LiotecnicaHub.Web/
├── Domain/Entities/HubUser.cs, HubProfile.cs, HubSystem.cs, ...
├── Domain/Enums/HubAccessScopeType.cs, HubAccessAuditAction.cs
├── Infrastructure/Data/HubAccessSeedData.cs
├── Application/Access/HubAccessCatalogService.cs
└── Pages/Admin/Access/Index.cshtml
```

---

_Última atualização: Fase 1 concluída (migration `AddControleAcessosFase1`, página `/Admin/Access`)._
