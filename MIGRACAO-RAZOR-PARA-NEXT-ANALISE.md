# Análise da migração LioTecnica.Web (Razor) → LioTecnica.Web.Next (Next.js)

**Data:** 02/03/2025  
**Objetivo:** Ter o Next funcionando igual ao legado Razor — mesma funcionalidade, mesma experiência.

---

## 1. Visão geral

| Aspecto | Legado (Razor) | Next.js | Status |
|--------|----------------|---------|--------|
| **Projeto** | `LioTecnica.Web` (.NET, MVC, cshtml) | `LioTecnica.Web.Next` (Next 16, React 19, TS) | — |
| **Autenticação** | Cookie + Entra ID opcional, BFF em LioTecnica.Web | Login via API (`/api/auth/login`, `/api/owner/auth/login`), token em memória/sessionStorage | ⚠️ Verificar fluxo e persistência |
| **API** | LioTecnica.Web chama RHPortal.Api (BFF + API clients) | Next chama `NEXT_PUBLIC_API_BASE` (rewrite em dev para backend) | ✅ Desenho ok |
| **Base path** | Raiz `/` | `/app` (coexistência com legado) | ✅ |
| **Build** | — | `output: "export"` (static export) | ⚠️ Impacta rotas dinâmicas |

---

## 2. Rotas e páginas — comparação

### 2.1 Módulo principal (app autenticado)

| Rota legado | View/Controller | Rota Next | Página Next | Observação |
|-------------|------------------|-----------|-------------|------------|
| `/` → Dashboard | Home/Index → Dashboard | `/app` → redirect `/dashboard` | `(app)/page.tsx` → `(app)/dashboard/page.tsx` | ✅ |
| `/Dashboard` | Dashboard/Index | `/dashboard` | `(app)/dashboard/page.tsx` | ✅ |
| `/Account/Login` | Account/Login | `/login` | `login/page.tsx` | ✅ |
| `/Account/EntraLogin` | Account/EntraLogin | — | — | ⚠️ Login Entra ID: verificar se existe no Next |
| `/Account/Logout` | Account/Logout | — | Via API / session | ⚠️ Conferir se logout cobre todos os casos |
| `/Account/SwitchTenant` | Account/SwitchTenant | — | Owner: “Acessar tenant” (Switch) | ✅ (Owner) |

### 2.2 Recrutamento

| Rota legado | View | Rota Next | Status |
|-------------|------|-----------|--------|
| `/Vagas` | Vagas/Index | `/vagas` | ✅ |
| `/Vagas/Matching/{id}` | Vagas/Matching | `/matching?vagaId=...` | ✅ (MatchingClient usa `fixedVagaId`) |
| `/Candidatos` | Candidatos/Index | `/candidatos` | ✅ |
| `/Candidatos/Detalhes?id=...` | Candidatos/Detalhes | — | ❌ **Falta:** tela ou modal de detalhes do candidato (página dedicada ou rota `/candidatos/[id]`) |
| `/Talentos` | Talentos/Index | `/talentos` | ✅ |
| `/Triagem` | Triagem/Index | `/triagem` | ✅ |
| `/Matching` | Matching/Index | `/matching` | ✅ |
| `/Agendas` | Agendas/Index | `/agendas` | ✅ |
| `/EntradaEmailPasta` | EntradaEmailPasta/Index | `/entradaemailpasta` | ✅ |

### 2.3 Cadastros

| Rota legado | View | Rota Next | Status |
|-------------|------|-----------|--------|
| `/Departamentos` | Departamentos/Index | `/departamentos` | ✅ |
| `/Areas` | Areas/Index | `/areas` | ✅ |
| `/Categorias` | Categorias/Index | `/categorias` | ✅ |
| `/Cadastro/Funcoes` | Cadastro/Funcoes/Index | `/cadastro/funcoes` | ✅ |
| `/Cadastro/Cargos` | Cadastro/Cargos/Index | `/cargos` | ✅ (ROUTE_MAP cadastro/cargos → cargos) |
| `/Unidades` | Unidades/Index | `/unidades` | ✅ |
| `/Funcionarios` | Funcionarios/Index | `/funcionarios` | ✅ |
| `/Pessoas` | Pessoas/Index | `/pessoas` | ✅ |

### 2.4 Gestão e feedback

| Rota legado | View | Rota Next | Status |
|-------------|------|-----------|--------|
| `/Gestao` | Gestao (redirect) | `/gestao` | ✅ |
| `/Gestao/Dashboard` | Gestao/Dashboard | `/gestao/dashboard` | ✅ |
| `/Gestao/Humor` | Gestao/Humor | `/gestao/humor` | ✅ |
| `/Gestao/PlanosDesenvolvimento` | Gestao/PlanosDesenvolvimento | `/gestao/planosdesenvolvimento` | ✅ |
| `/Gestao/ResumoAtividades` | Gestao/ResumoAtividades | `/gestao/resumoatividades` | ✅ |
| `/Feedback/*` (Celebracao, Enviar, Feedbacks, Gamificacao, etc.) | Várias views Feedback | `/feedback/*` | ✅ |
| `/Desempenho/MinhasAvaliacoes` | Desempenho/MinhasAvaliacoes | `/desempenho` | ✅ |

### 2.5 Relatórios e notificações

| Rota legado | View | Rota Next | Status |
|-------------|------|-----------|--------|
| `/Relatorios` | Relatorios/Index | `/relatorios` | ✅ |
| `/Notificacoes` | Notifications/Index | `/notificacoes` | ✅ |

### 2.6 Usuários e perfis

| Rota legado | View | Rota Next | Status |
|-------------|------|-----------|--------|
| `/UsuariosPerfis` | UsuariosPerfis/Index | `/usuariosperfis` | ✅ |
| `/BloqueioPessoa` | BloqueioPessoa/Index | `/bloqueiopessoa` | ✅ |

### 2.7 Admin (por tenant)

| Rota legado | View | Rota Next | Status |
|-------------|------|-----------|--------|
| `/Admin/ApiKeys` | AdminApiKeys/Index | `/admin/api-keys` | ✅ |
| `/Admin/Roles` | AdminRoles/Index | `/admin/roles` | ✅ |
| `/Admin/Roles/Edit/{id}` | AdminRoles/Edit | — | ⚠️ **Verificar:** edição de perfil em modal ou tela separada |
| `/Admin/Users` | AdminUsers/Index | `/admin/users` | ✅ |
| `/Admin/Users/Edit/{id}` | AdminUsers/Edit | — | ⚠️ **Verificar:** edição de usuário em modal ou tela |
| `/Admin/Menus` | AdminMenus/Index | `/admin/menus` | ✅ |
| `/Admin/Menus/Edit/{id}` | AdminMenus/Edit | — | ⚠️ **Verificar:** edição de menu |
| Demais Admin (Acessos, Logs, Emails, EmailConfig, etc.) | Várias | `/admin/*` | ✅ |

### 2.8 Owner (multi-tenant)

| Rota legado | View | Rota Next | Status |
|-------------|------|-----------|--------|
| `/Owner` | Redirect | — | — |
| `/Owner/IA` | Owner/IA/Index | `/Owner/IA` | ✅ |
| `/Owner/Tenants` | Owner/Tenants/Index | `/Owner/Tenants` | ✅ |
| `/Owner/Tenants/Create` | Owner/Tenants/Create | Criar tenant na lista (TenantsScreen) | ✅ (fluxo na mesma tela) |
| `/Owner/Tenants/{tenantId}` | Owner/Tenants/Details | **Não existe** | ❌ **Falta:** rota dinâmica que use `TenantDetailScreen` |
| `/Owner/Tenants/{tenantId}/Users` | Owner/TenantUsers/Index | — | Dentro de TenantDetailScreen (TabUsuarios) |
| `/Owner/Tenants/{tenantId}/Users/New` | Owner/TenantUsers/New | — | Idem |
| `/Owner/Tenants/{tenantId}/Users/Edit/{id}` | Owner/TenantUsers/Edit | — | Idem |
| `/Owner/Tenants/{tenantId}/Config/*` | Várias (Acessos, Menus, Logs, etc.) | — | Abas em TenantDetailScreen |

**Problema:** O Next tem `TenantDetailScreen` e os links em `TenantsScreen` apontam para `/Owner/Tenants/{tenantId}`, mas **não existe** `(app)/Owner/Tenants/[tenantId]/page.tsx`. Ou seja, ao clicar num tenant dá 404 (ou comportamento indefinido).  
**Ação:** Criar `src/app/(app)/Owner/Tenants/[tenantId]/page.tsx` que renderize `TenantDetailScreen` com o `tenantId` da URL. Com `output: "export"`, avaliar `generateStaticParams` ou exceção para essa rota se não for estática.

---

## 3. Portal do Candidato (PortalVagas)

No legado, o **PortalVagas** é um fluxo completo com cookie próprio (`CandidateAuthDefaults.Scheme`), várias rotas e abas.

| Rota legado | Descrição | Next | Status |
|-------------|-----------|------|--------|
| `/PortalVagas` | Index (lista de vagas ou redirect) | `/PortalVagas` | ⚠️ Ver abaixo |
| `/PortalVagas/Acesso` | Login/registro candidato | — | ❌ **Falta** |
| `/PortalVagas/Profile` | Perfil do candidato | — | ❌ **Falta** |
| `/PortalVagas/SkillsPortfolio` | Skills e certificações | — | ❌ **Falta** |
| `/PortalVagas/Education` | Formação | — | ❌ **Falta** |
| `/PortalVagas/Preferences` | Preferências | — | ❌ **Falta** |
| `/PortalVagas/Lgpd` | LGPD | — | ❌ **Falta** |
| `/PortalVagas/Agenda` | Agenda/disponibilidade | — | Parcial (veja abaixo) |
| `/PortalVagas/Notifications` | Notificações | — | ❌ **Falta** |
| `/PortalVagas/Documents` | Documentos | — | ❌ **Falta** |
| `/PortalVagas/ExperienceProjects` | Experiência e projetos | — | ❌ **Falta** |
| `/PortalVagas/References` | Referências | — | ❌ **Falta** |
| `/PortalVagas/Accessibility` | Acessibilidade | — | ❌ **Falta** |

No Next hoje:

- Existe apenas **uma** página: `PortalVagas/page.tsx` → `PortalVagasAgendaScreen` (agenda).
- Não há rotas para Acesso, Profile, SkillsPortfolio, Education, Preferences, Lgpd, Notifications, Documents, ExperienceProjects, References, Accessibility.

**Conclusão:** O Portal do Candidato no Next está **muito incompleto**. Para ficar igual ao legado é necessário:

1. Autenticação do candidato (Acesso, logout, cookie/session).
2. Todas as telas acima como rotas ou abas equivalentes ao legado.
3. Layout e navegação do portal (menu/abas) alinhados ao Razor.

---

## 4. Subtelas e modais (paridade de UX)

No legado várias coisas são feitas em **modais** ou **telas de edição**. No Next é preciso garantir que exista o mesmo fluxo (modal ou página).

- **Candidatos:** Detalhes (modal no legado + página Detalhes) → Next: definir se será página `/candidatos/[id]` ou modal na lista.
- **Vagas:** Detalhes da vaga, Matching por vaga → Next: VagasScreen + Matching com `vagaId` já coberto.
- **Admin Roles/Users/Menus:** Editar (Edit) → Next: verificar se cada tela Admin tem fluxo de edição (modal ou rota) equivalente.
- **Owner Tenant Users:** New/Edit/Password → já previsto nas abas de TenantDetailScreen; falta só a rota `[tenantId]`.

---

## 5. API e BFF

- **Legado:** LioTecnica.Web usa vários `*ApiClient` contra RHPortal.Api; rotas Owner são em `/Owner/...` (MVC) e a API real em RHPortal.Api é `api/owner/*`.
- **Next:** Usa `apiFetch` com `NEXT_PUBLIC_API_BASE`; em dev, rewrites mandam `/api/*` para `DEV_API_ORIGIN` (ex.: localhost:5056). Ou seja, Next espera que o backend (ex.: RHPortal.Api) exponha `api/owner/*`, `api/auth/*`, etc.
- **Conferir:** Que `NEXT_PUBLIC_API_BASE` aponte para o host que realmente serve essas APIs (RHPortal.Api ou BFF que as repasse).

---

## 6. Navegação e menu

- **Legado:** Menu por permissão (MainMenu Default + _MenuModule + _MenuModuleFeedback), módulos Recrutamento, Cadastros, Relatórios, Feedback, Admin; PortalVagas e Matching com regras especiais.
- **Next:** `SidebarNavClient` usa `bff/navigation` (BffNavigationController) e `ROUTE_MAP` para converter paths Razor em paths Next. Mapeamento está coerente com as rotas existentes.

---

## 7. Resumo do que falta para ficar igual ao legado

### Crítico (impede paridade)

1. **Owner/Tenants/[tenantId]:** Criar `(app)/Owner/Tenants/[tenantId]/page.tsx` e renderizar `TenantDetailScreen({ tenantId })`. Ajustar estático export se necessário.
2. **Portal do Candidato (PortalVagas):** Implementar todas as rotas/fluxos listados na seção 3 (Acesso, Profile, Skills, Education, Preferences, Lgpd, Agenda completa, Notifications, Documents, Experience/Projects, References, Accessibility) e autenticação do candidato.

### Importante (paridade de funcionalidade)

3. **Candidatos – Detalhes:** Página ou modal de detalhes do candidato (equivalente a `Candidatos/Detalhes` + modal).
4. **Login Entra ID:** Garantir fluxo de login com Entra ID no Next (se o legado usar).
5. **Logout:** Garantir que logout limpe token/cookie e redirecione como no legado.

### Verificar (telas de edição Admin)

6. **Admin Roles/Users/Menus:** Confirmar se as telas de edição (Roles/Edit, Users/Edit, Menus/Edit) existem no Next (modal ou rota) com a mesma capacidade do legado.

---

## 8. Checklist de conclusão da migração

- [ ] Rota `Owner/Tenants/[tenantId]` criada e funcionando.
- [ ] PortalVagas: Acesso (login/registro), Profile, SkillsPortfolio, Education, Preferences, Lgpd, Agenda, Notifications, Documents, ExperienceProjects, References, Accessibility.
- [ ] Candidatos: tela ou modal de detalhes do candidato.
- [ ] Login (cookie/session + Entra ID se aplicável) e logout iguais ao legado.
- [ ] Admin: edição de Roles, Users e Menus equivalente ao legado.
- [ ] Testes E2E cobrindo fluxos principais (login, vagas, candidatos, owner, portal candidato).
- [ ] Documentação de deploy: `NEXT_PUBLIC_API_BASE`, proxy/rewrites, e (se mantido) reverse proxy do legado para `/app/*` (Next).

---

## 9. Estrutura de pastas de referência

**Legado (views principais):**  
`Views/{Controller}/{Action}.cshtml` (ex.: Vagas/Index, Candidatos/Detalhes, Owner/Tenants/Details, PortalVagas/*).

**Next (app router):**  
`src/app/(app)/{module}/page.tsx` e, quando houver, `[id]/page.tsx` ou `[tenantId]/page.tsx`.  
Features em `src/features/{module}/` (ex.: owner/TenantDetailScreen, portalvagas/agenda/PortalVagasAgendaScreen).

Com o preenchimento dos itens críticos e importantes acima, o Next fica com paridade funcional em relação ao legado Razor.
