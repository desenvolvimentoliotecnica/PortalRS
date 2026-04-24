# Análise da migração LioTecnica.Web (Razor) → LioTecnica.Web.Next (Next.js)

> **⚠️ DOCUMENTO SUPERSEDED (2026-04-20).**
> A migração descrita aqui foi concluída na **Fase 13** (ver [`PORTAL_MVC_INVENTARIO_E_MIGRACAO.md`](./PORTAL_MVC_INVENTARIO_E_MIGRACAO.md)).
> O projeto `LioTecnica.Web` **não existe mais** no repositório — foi removido junto com `LioTecnica.Web.E2E` e o `Dockerfile` legado. O login Entra ID roda 100% via `RHPortal.Api` + `LioTecnica.Web.Next`.
> Este arquivo é mantido por registro histórico; consulte `PORTAL_MVC_INVENTARIO_E_MIGRACAO.md` para o estado atual da arquitetura.

**Data:** 02/03/2025
**Objetivo (histórico):** Ter o Next funcionando igual ao legado Razor — mesma funcionalidade, mesma experiência.

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
| `/Candidatos/Detalhes?id=...` | Candidatos/Detalhes | `/candidatos/detalhes?id=...` + modal na lista | ✅ Modal + link "Abrir em página" |
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
| `/Admin/Roles/Edit/{id}` | AdminRoles/Edit | Form inline em `/admin/roles` | ✅ |
| `/Admin/Users` | AdminUsers/Index | `/admin/users` | ✅ |
| `/Admin/Users/Edit/{id}` | AdminUsers/Edit | Form inline em `/admin/users` | ✅ |
| `/Admin/Menus` | AdminMenus/Index | `/admin/menus` | ✅ |
| `/Admin/Menus/Edit/{id}` | AdminMenus/Edit | Form inline em `/admin/menus` | ✅ |
| Demais Admin (Acessos, Logs, Emails, EmailConfig, etc.) | Várias | `/admin/*` | ✅ |

### 2.8 Owner (multi-tenant)

| Rota legado | View | Rota Next | Status |
|-------------|------|-----------|--------|
| `/Owner` | Redirect | `/Owner` → redirect `/Owner/Tenants` | ✅ |
| `/Owner/IA` | Owner/IA/Index | `/Owner/IA` | ✅ |
| `/Owner/Tenants` | Owner/Tenants/Index | `/Owner/Tenants` | ✅ |
| `/Owner/Tenants/Create` | Owner/Tenants/Create | Criar tenant na lista (TenantsScreen) | ✅ (fluxo na mesma tela) |
| `/Owner/Tenants/{tenantId}` | Owner/Tenants/Details | `/Owner/Tenants/[tenantId]` (redireciona para `?id=`) | ✅ Rota criada; links BFF convertidos via `normalizeHref` |
| `/Owner/Tenants/{tenantId}/Users` | Owner/TenantUsers/Index | — | Dentro de TenantDetailScreen (TabUsuarios) |
| `/Owner/Tenants/{tenantId}/Users/New` | Owner/TenantUsers/New | — | Idem |
| `/Owner/Tenants/{tenantId}/Users/Edit/{id}` | Owner/TenantUsers/Edit | — | Idem |
| `/Owner/Tenants/{tenantId}/Config/*` | Várias (Acessos, Menus, Logs, etc.) | — | Abas em TenantDetailScreen |

**Resolvido:** Criada rota `Owner/Tenants/[tenantId]` que redireciona para `?id=`. Links no formato `/Owner/Tenants/{id}` (BFF) são convertidos para `?id=` via `normalizeHref` no SidebarNavClient. Com `output: "export"`, usa `generateStaticParams` com placeholder.

---

## 3. Portal do Candidato (PortalVagas)

No legado, o **PortalVagas** é um fluxo completo com cookie próprio (`CandidateAuthDefaults.Scheme`), várias rotas e abas.

| Rota legado | Descrição | Next | Status |
|-------------|-----------|------|--------|
| `/PortalVagas` | Index (lista de vagas, catálogo, candidatura) | `/app/PortalVagas` | ✅ |
| `/PortalVagas/Acesso` | Login/registro candidato | `/app/PortalVagas/Acesso` | ✅ |
| `/PortalVagas/Profile` | Perfil do candidato | Modal no PortalVagas | ✅ |
| `/PortalVagas/SkillsPortfolio` | Skills e certificações | Aba no modal perfil | ✅ |
| `/PortalVagas/Education` | Formação | Aba no modal perfil | ✅ |
| `/PortalVagas/Preferences` | Preferências | Aba no modal perfil | ✅ |
| `/PortalVagas/Lgpd` | LGPD | Aba no modal perfil | ✅ |
| `/PortalVagas/Agenda` | Agenda/disponibilidade | Aba principal + seção | ✅ |
| `/PortalVagas/Notifications` | Notificações | Aba no modal perfil | ✅ |
| `/PortalVagas/Documents` | Documentos | Aba no modal perfil | ✅ |
| `/PortalVagas/ExperienceProjects` | Experiência e projetos | Aba no modal perfil | ✅ |
| `/PortalVagas/References` | Referências | Aba no modal perfil | ✅ |
| `/PortalVagas/Accessibility` | Acessibilidade | Aba no modal perfil | ✅ |
| Histórico candidaturas (TabApps) | localStorage | Aba no modal perfil | ✅ |
| Testes de RH (TabTests) | localStorage | Aba no modal perfil | ✅ |

No Next hoje:

- **PortalVagas** (`/app/PortalVagas`): catálogo de vagas, filtros, candidatura, modal de perfil com 12 seções.
- **PortalVagas/Acesso** (`/app/PortalVagas/Acesso`): login e registro com UFs/cidades dinâmicos.
- **Modal de perfil**: Perfil, Competências, Formação, Preferências, LGPD, Notificações, Documentos, Experiência, Referências, Acessibilidade, Candidaturas (histórico), Testes RH.

**Conclusão:** O Portal do Candidato no Next está **~95% migrado**. Funcionalidades principais cobertas; alguns detalhes de UX/visual e i18n pendentes.

### Itens finalizados na migração
- [x] Admin Nova vaga (NewJobModal + botão para Admin)
- [x] Apply: UF/Cidade e Disponibilidade como selects dinâmicos (API Locations)
- [x] Filtro minSalary na listagem
- [x] Drawer de filtros (mobile) + FAB
- [x] Acesso: Help modal "Como funciona o processo", VLibras, troca de idioma (pt-BR, en-US, es-ES)
- [x] Apps: Timeline (CRUD de eventos por candidatura) + Importar do Minhas candidaturas (myApps)
- [x] Layout: Hero, back-to-top, FAB filtros
- [x] Vagas agrupadas por área com seções e hero (getSectionInfo)
- [x] Job cards com hero gradient e badges (JobCard.tsx)
- [x] Modal detalhes: tags, resumo (buildSummary), responsabilidades (parseTagsResponsabilidades), copiar link interno
- [x] Filtros como selects (Location, Type, Level, Area)
- [x] Search box dedicada com Buscar e Limpar

---

## 3.1 PortalVagas — Análise detalhada legado vs Next

Análise completa do legado (`LioTecnica.Web/Views/PortalVagas`, `wwwroot/js/views/portal-vagas`, `wwwroot/css/portal-vagas.css`) para identificar o que falta migrar.

### Estrutura legado (referência)

| Componente | Legado | Next |
|------------|--------|------|
| **Index** | `Index.cshtml` + `_Layout.cshtml` | `PortalVagasScreen.tsx` |
| **Header** | `Partials/_Header.cshtml` (navbar, dropdown usuário, Nova vaga) | Inline no PortalVagasScreen |
| **Hero** | `Partials/_Hero.cshtml` (gradient, título) | Hero simplificado |
| **Busca** | `search-box` dedicada (Buscar/Limpar) | Input na grade de filtros |
| **Filtros** | `_FiltersDrawer.cshtml` (offcanvas) | Drawer mobile + grade inline |
| **Vagas** | `jobs-data.js` + `jobs-render.js` (agrupadas por área) | Grid flat |
| **Job card** | Card com hero gradient, badges, tags | Card simples |
| **Job modal** | `_JobModal.cshtml` (detalhes, tags, resumo, responsabilidades, Copiar link) | Modal simplificado |
| **Apply** | `_ApplyModal.cshtml` + `apply.js` | Modal no PortalVagasScreen |
| **NewJob** | `_NewJobModal.cshtml` + `admin-newjob.js` | `NewJobModal.tsx` |
| **Profile** | `_ProfileModal.cshtml` (12 abas) | Modal com 12 seções |
| **Acesso** | `Acesso.cshtml` (login + register em modal) | `PortalVagasAccessScreen.tsx` (tabs) |

### O que falta para paridade 100%

#### Alta prioridade (UX/visual) — ✅ Implementado

| Item | Legado | Next | Status |
|------|--------|------|--------|
| **Vagas agrupadas por área** | `jobs-data.js` agrupa por `job.area`, `buildSection` com hero por área | Agrupamento por área, seções com hero (`getSectionInfo`) | ✅ |
| **Job cards com hero gradient** | Card com `job-hero` (gradiente), título sobre hero, badges | `JobCard.tsx` com hero gradient, badges (modalidade, tipo, senioridade) | ✅ |
| **Modal detalhes da vaga** | Tags, Resumo, responsabilidades, Copiar link | Tags, `buildSummary`, `parseTagsResponsabilidades`, botão Copiar link | ✅ |
| **API base / tenantName** | Legado usa `apiBase`, `tenantName` no card | `empresaNome \|\| tenantName` em cards e modais | ✅ |

#### Média prioridade — ✅ Implementado

| Item | Legado | Next | Status |
|------|--------|------|--------|
| **Filtros como selects** | Location, Mode, Type, Level, Area como `<select>` | Selects para Local, Formato, Tipo, Senioridade, Área | ✅ |
| **Search box dedicada** | Caixa de busca com ícone, Buscar, Limpar | Caixa destacada com Buscar e Limpar | ✅ |
| **i18n (portal-vagas-strings.js)** | ~100 strings (common, apply, newJob, jobs, index, filters, profile, etc.) | Textos hardcoded em pt-BR | Extrair strings para i18n (opcional) |
| **CSS portal-vagas.css** | ~1000 linhas (header, hero, search-box, job-card, job-section, filters-fab, back-to-top, etc.) | Tailwind/classes genéricas | Replicar estilos principais se quiser visual idêntico |
| **Acesso: login vs register** | Login no main, Register em modal | Tabs Entrar / Criar acesso | Avaliar se manter tabs ou replicar modal |

#### Baixa prioridade

| Item | Legado | Next | Status |
|------|--------|------|--------|
| **Responsabilidades no job modal** | Legado usa array hardcoded (job-modal.js) | `parseTagsResponsabilidades(tagsResponsabilidadesRaw)` no modal | ✅ |
| **Baixar resumo (Apps)** | Botão `downloadAppsSummary` (hidden no legado) | Não existe | Implementar se necessário |
| **SweetAlert2** | Usado em modais de confirmação | `toast` (sonner) | Equivalente funcional |
| **Bootstrap/Font Awesome** | Layout Bootstrap, ícones FA | Tailwind, ícones via classes | Estética diferente, não bloqueante |

### API e dados

- **`/api/public/vagas`**: Retorna `PortalVagaCardResponse` com `tagsKeywordsRaw`, `tagsStackRaw`, `tagsResponsabilidadesRaw`. **Não** retorna `descricaoPublica`.
- **Resumo no modal**: Legado usa `buildSummary` (título + empresa + tags). Next pode usar o mesmo.
- **Responsabilidades**: `tagsResponsabilidadesRaw` é string (ex.: separada por `;` ou `,`). Pode ser parseada para lista no modal.

### Resumo executivo

| Categoria | Status | Itens |
|-----------|--------|-------|
| **Funcional** | ✅ | Fluxos principais (vagas, apply, perfil, agenda, acesso, admin) |
| **Visual/UX** | ✅ | Vagas agrupadas por área, job cards com hero, modal detalhes completo, search box dedicada, filtros como selects |
| **i18n** | ⚠️ | Strings hardcoded; legado tem portal-vagas-strings.js |
| **Estética** | ⚠️ | portal-vagas.css não migrado; Next usa Tailwind |

**Paridade visual/funcional do Portal de Vagas:** concluída. Itens de alta e média prioridade implementados.

---

## 4. Subtelas e modais (paridade de UX)

No legado várias coisas são feitas em **modais** ou **telas de edição**. No Next é preciso garantir que exista o mesmo fluxo (modal ou página).

- **Candidatos:** Detalhes (modal no legado + página Detalhes) → Next: modal na lista + link "Abrir em página" para `/candidatos/detalhes?id=`.
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

- [x] Rota `Owner/Tenants/[tenantId]` criada (redireciona para `?id=`).
- [x] PortalVagas: Acesso (login/registro), Profile, SkillsPortfolio, Education, Preferences, Lgpd, Agenda, Notifications, Documents, ExperienceProjects, References, Accessibility, Histórico candidaturas, Testes RH.
- [x] Candidatos: modal de detalhes + link "Abrir em página" para `/candidatos/detalhes?id=`.
- [x] Login (token) e logout (clearSession + POST /api/auth/logout se existir) equivalentes ao legado.
- [x] Admin: edição de Roles, Users e Menus em modal (equivalente ao legado).
- [x] Testes E2E: login-redirect e portalvagas passam; dashboard, vagas, candidatos, owner-tenants exigem API/auth (test.skip até mock ou fixture).
- [x] Documentação de deploy: `docs/PARIDADE-1-1.md` com variáveis, checklist e troubleshooting.

---

## 9. Estrutura de pastas de referência

**Legado (views principais):**  
`Views/{Controller}/{Action}.cshtml` (ex.: Vagas/Index, Candidatos/Detalhes, Owner/Tenants/Details, PortalVagas/*).

**Next (app router):**  
`src/app/(app)/{module}/page.tsx` e, quando houver, `[id]/page.tsx` ou `[tenantId]/page.tsx`.  
Features em `src/features/{module}/` (ex.: owner/TenantDetailScreen, portalvagas/agenda/PortalVagasAgendaScreen).

Com o preenchimento dos itens críticos e importantes acima, o Next fica com paridade funcional em relação ao legado Razor.
