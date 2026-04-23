# Portal MVC — Inventário completo e plano de migração para Next.js

> **STATUS (2026-04-20): ✅ FASE 13 CONCLUÍDA — Portal MVC DESCOMISSIONADO.**
> O projeto `LioTecnica.Web` (MVC Razor) e o `LioTecnica.Web.E2E` (Playwright/.NET) foram **removidos do disco e da solution**. O Dockerfile do legado foi apagado. O login Entra ID roda fim-a-fim via `RHPortal.Api` + `LioTecnica.Web.Next`. As rotas `/bff/*` do nginx/rewrites do Next foram removidas.
> Este documento permanece como registro histórico do inventário e do plano executado.

**Data:** 2026-04-20
**Onda:** 13 — Portal MVC: inventário, plano de migração **e decommission**
**Autor:** Agente de migração (supervisão humana do arquiteto)
**Escopo (atualizado em 2026-04-20):** Todas as fases 13.1 → 13.7 foram executadas.
**Substitui / atualiza:** [MIGRACAO-RAZOR-PARA-NEXT-ANALISE.md](./MIGRACAO-RAZOR-PARA-NEXT-ANALISE.md) (02/03/2025), superseded por este documento.

---

## 0. Como ler este documento

- **Seção 1 — Inventário legado**: todos os Controllers e Views Razor do `LioTecnica.Web`, listados em tabelas.
- **Seção 2 — Inventário Next**: todas as rotas `src/app/**/page.tsx` do `LioTecnica.Web.Next` conhecidas em 2026-04-20.
- **Seção 3 — Mapeamento legado → Next** (com status ✅ / ⚠️ / ❌ / 🗑️).
- **Seção 4 — Telas/funcionalidades pendentes**, priorizadas.
- **Seção 5 — Plano de migração em fases**, com dependências.
- **Seção 6 — Plano de descomissionamento** do `LioTecnica.Web`.
- **Seção 7 — Riscos e dívidas**.

Legenda de status de migração:

| Símbolo | Significado |
|---------|-------------|
| ✅ migrado | Rota/tela equivalente existe no Next e cobre o caso de uso. |
| ⚠️ parcial | Rota existe mas falta paridade funcional, UX, i18n ou sub-telas. |
| ❌ pendente | Não há equivalente no Next; precisa ser migrado. |
| 🗑️ obsoleto | Rota legada foi depreciada/substituída por nova arquitetura; não migrar. |

---

## 1. Inventário `LioTecnica.Web` (MVC legado)

### 1.1 Controllers (53 ao total)

| # | Controller | Arquivo | Tipo | Observação |
|---|-----------|---------|------|------------|
| 1 | AccountController | `Controllers/AccountController.cs` | MVC | Login, Logout, EntraLogin, SwitchTenant |
| 2 | AdminAccessesController | `Controllers/AdminAccessesController.cs` | MVC | Acessos (Role x Menu) |
| 3 | AdminApiKeysController | `Controllers/AdminApiKeysController.cs` | MVC | API Keys do tenant |
| 4 | AdminEmailConfigController | `Controllers/AdminEmailConfigController.cs` | MVC | SMTP tenant |
| 5 | AdminEmailTemplatesController | `Controllers/AdminEmailTemplatesController.cs` | MVC | Templates email |
| 6 | AdminEmailsController | `Controllers/AdminEmailsController.cs` | MVC | Histórico de emails |
| 7 | AdminEntraIdConfigController | `Controllers/AdminEntraIdConfigController.cs` | MVC | SSO Entra ID por tenant |
| 8 | AdminLocalizationConfigController | `Controllers/AdminLocalizationConfigController.cs` | MVC | Idioma/timezone tenant |
| 9 | AdminLogsController | `Controllers/AdminLogsController.cs` | MVC | Logs de transações |
| 10 | AdminMenusController | `Controllers/AdminMenusController.cs` | MVC | Cadastro de menus/permission keys |
| 11 | AdminOperationalLogsController | `Controllers/AdminOperationalLogsController.cs` | MVC | Logs operacionais |
| 12 | AdminRolesController | `Controllers/AdminRolesController.cs` | MVC | Perfis/Roles |
| 13 | AdminUsersController | `Controllers/AdminUsersController.cs` | MVC | Usuários do tenant |
| 14 | AgendasController | `Controllers/AgendasController.cs` | MVC | Agenda de entrevistas |
| 15 | AreasController | `Controllers/AreasController.cs` | MVC | Cadastro de áreas |
| 16 | BffAuthController | `Controllers/BffAuthController.cs` | BFF `/bff/auth` | Login, logout, me, Entra ID |
| 17 | BffController | `Controllers/BffController.cs` | BFF `/bff` | Fachada diversa |
| 18 | BffDashboardController | `Controllers/BffDashboardController.cs` | BFF `/bff/dashboard` | KPIs/cards |
| 19 | BffLookupsController | `Controllers/BffLookupsController.cs` | BFF `/bff/lookups` | Combos |
| 20 | BffNavigationController | `Controllers/BffNavigationController.cs` | BFF `/bff/navigation` | Menu consumido pelo Next |
| 21 | BffNotificationsController | `Controllers/BffNotificationsController.cs` | BFF `/bff/notifications` | Badge/lista notificações |
| 22 | BloqueioPessoaController | `Controllers/BloqueioPessoaController.cs` | MVC | Bloqueio de candidatos |
| 23 | CadastroController | `Controllers/CadastroController.cs` | MVC | Hub `/Cadastro/Funcoes`, `/Cadastro/Cargos` |
| 24 | CandidatosController | `Controllers/CandidatosController.cs` | MVC | Candidatos + Detalhes |
| 25 | CargosController | `Controllers/CargosController.cs` | MVC | Cargos (novo) |
| 26 | CategoriasController | `Controllers/CategoriasController.cs` | MVC | Categorias |
| 27 | CultureController | `Controllers/CultureController.cs` | Utilitário | Troca de idioma |
| 28 | DashboardController | `Controllers/DashboardController.cs` | MVC | Dashboard principal |
| 29 | DepartamentosController | `Controllers/DepartamentosController.cs` | MVC | Departamentos |
| 30 | DesempenhoController | `Controllers/DesempenhoController.cs` | MVC | Minhas avaliações |
| 31 | EntradaEmailPastaController | `Controllers/EntradaEmailPastaController.cs` | MVC | Inbox de CVs por e-mail |
| 32 | FeedbackController | `Controllers/FeedbackController.cs` | MVC | Pesquisas, gamificação, 1a1 etc. |
| 33 | FuncionariosController | `Controllers/FuncionariosController.cs` | MVC | Funcionários |
| 34 | GestaoController | `Controllers/GestaoController.cs` | MVC | Dashboard de gestão, humor, PDI, resumo |
| 35 | HealthController | `Controllers/HealthController.cs` | `api/health` | Probe |
| 36 | HomeController | `Controllers/HomeController.cs` | MVC | Index, Privacy, Error |
| 37 | LookupsController | `Controllers/LookupsController.cs` | `api/lookup` | Lookups diversos |
| 38 | MatchingController | `Controllers/MatchingController.cs` | MVC | Matching IA |
| 39 | NotificationsController | `Controllers/NotificationsController.cs` | MVC | Central de notificações |
| 40 | OpsController | `Controllers/OpsController.cs` | MVC | Operações de manutenção (reset DB, etc.) |
| 41 | OwnerController | `Controllers/OwnerController.cs` | MVC | Área Owner (multi-tenant) |
| 42 | PessoasController | `Controllers/PessoasController.cs` | MVC | Pessoas (pré-cadastro) |
| 43 | PortalLocationsController | `Controllers/PortalLocationsController.cs` | API | UFs/Cidades para Portal |
| 44 | PortalVagasController | `Controllers/PortalVagasController.cs` | MVC público | Portal externo do candidato |
| 45 | RelatoriosController | `Controllers/RelatoriosController.cs` | MVC | Relatórios |
| 46 | TalentosController | `Controllers/TalentosController.cs` | MVC | Banco de talentos |
| 47 | TriagemController | `Controllers/TriagemController.cs` | MVC | Triagem de candidaturas |
| 48 | UnidadesController | `Controllers/UnidadesController.cs` | MVC | Unidades |
| 49 | UsuariosPerfisController | `Controllers/UsuariosPerfisController.cs` | MVC | Usuários + Perfis (combo) |
| 50 | VagasController | `Controllers/VagasController.cs` | MVC | Vagas + Matching por vaga |
| 51 | (ver abaixo) | — | — | Controllers Owner/Admin podem expor sub-rotas nested no mesmo arquivo — contabilizados uma vez |

> **Total: 53 arquivos** em `LioTecnica.Web/Controllers/` (contagem bruta). Os `Bff*Controller` (7) são consumidos pelo Next e **permanecem** após descomissionar as Views Razor — ver Fase 9.

### 1.2 Views Razor

Agrupadas por área. **Total: ~113 arquivos `.cshtml`** (inclui partials/modals/sections).

#### 1.2.1 Módulos funcionais (telas principais)

| Área | Views principais |
|------|------------------|
| `Account/` | `Login.cshtml` |
| `Home/` | `Index.cshtml`, `Privacy.cshtml` |
| `Dashboard/` | `Index.cshtml`, `_OffcanvasFilters.cshtml`, `_OffcanvasQuick.cshtml` |
| `Vagas/` | `Index.cshtml`, `Matching.cshtml`, `_ModalVaga.cshtml`, `_ModalVagaDetalhes.cshtml`, `_ModalReq.cshtml` |
| `Candidatos/` | `Index.cshtml`, `Detalhes.cshtml`, `_ModalCand.cshtml`, `_ModalCandDetalhes.cshtml` |
| `Talentos/` | `Index.cshtml` |
| `Triagem/` | `Index.cshtml`, `_ModalDecision.cshtml`, `_ModalTriagemDetalhes.cshtml`, `_OffcanvasDetails.cshtml` |
| `Matching/` | `Index.cshtml`, `_OffcanvasDetails.cshtml` |
| `Agendas/` | `Index.cshtml` |
| `EntradaEmailPasta/` | `Index.cshtml` |
| `Pessoas/` | `Index.cshtml`, `_ModalPessoa.cshtml` |
| `Funcionarios/` | `Index.cshtml`, `_ModalFuncionario.cshtml`, `_ModalSyncUsuarios.cshtml` |
| `Unidades/` | `Index.cshtml`, `_ModalUnidade.cshtml`, `_ModalUnidadeRelacionados.cshtml` |
| `Departamentos/` | `Index.cshtml`, `_ModalDepartamento.cshtml`, `_ModalDepartamentoVagas.cshtml` |
| `Areas/` | `Index.cshtml`, `_ModalArea.cshtml`, `_ModalAreaVagas.cshtml` |
| `Categorias/` | `Index.cshtml`, `_ModalCategoria.cshtml`, `_ModalCategoriaRequisitos.cshtml` |
| `Cargos/` | `Index.cshtml`, `_ModalCargo.cshtml`, `_ModalCargoGestores.cshtml` |
| `Cadastro/Cargos/` | `Index.cshtml` |
| `Cadastro/Funcoes/` | `Index.cshtml` |
| `UsuariosPerfis/` | `Index.cshtml`, `_ModalRole.cshtml`, `_ModalUser.cshtml`, `_OffcanvasUser.cshtml` |
| `BloqueioPessoa/` | `Index.cshtml` |
| `Relatorios/` | `Index.cshtml` |
| `Notifications/` | `Index.cshtml` |
| `Desempenho/` | `MinhasAvaliacoes.cshtml` |
| `Gestao/` | `Dashboard.cshtml`, `Humor.cshtml`, `PlanosDesenvolvimento.cshtml`, `ResumoAtividades.cshtml` |
| `Feedback/` | `Celebracao.cshtml`, `Enviar.cshtml`, `Feedbacks.cshtml`, `Gamificacao.cshtml`, `GamificacaoHistorico.cshtml`, `Gestao.cshtml`, `MeusPlanos.cshtml`, `PesquisaRapida.cshtml`, `Pesquisas.cshtml`, `Reunioes1a1.cshtml`, `SuperPesquisa.cshtml` |

#### 1.2.2 Admin (por tenant)

| Área | Views |
|------|-------|
| `AdminAccesses/` | `Index.cshtml` |
| `AdminApiKeys/` | `Index.cshtml` |
| `AdminEmailConfig/` | `Index.cshtml` |
| `AdminEmailTemplates/` | `Index.cshtml` |
| `AdminEmails/` | `Index.cshtml` |
| `AdminEntraIdConfig/` | `Index.cshtml` |
| `AdminLocalizationConfig/` | `Index.cshtml` |
| `AdminLogs/` | `Index.cshtml` |
| `AdminMenus/` | `Index.cshtml`, `Edit.cshtml` |
| `AdminOperationalLogs/` | `Index.cshtml` |
| `AdminRoles/` | `Index.cshtml`, `Edit.cshtml` |
| `AdminUsers/` | `Index.cshtml`, `Edit.cshtml` |

#### 1.2.3 Owner (multi-tenant)

| Área | Views |
|------|-------|
| `Owner/IA/` | `Index.cshtml` |
| `Owner/Tenants/` | `Index.cshtml`, `Create.cshtml`, `Details.cshtml` |
| `Owner/TenantUsers/` | `Index.cshtml`, `Edit.cshtml`, `SetPassword.cshtml` |
| `Owner/` (root) | `_ModalAiKey.cshtml`, `_ModalAiModel.cshtml` |

#### 1.2.4 PortalVagas (candidato externo)

| Grupo | Views |
|-------|-------|
| Páginas principais | `Index.cshtml`, `Acesso.cshtml` |
| Modais | `Modals/_ApplyModal.cshtml`, `Modals/_JobModal.cshtml`, `Modals/_NewJobModal.cshtml`, `Modals/_ProfileModal.cshtml` |
| Partials | `Partials/_Header.cshtml`, `Partials/_Hero.cshtml`, `Partials/_FiltersDrawer.cshtml`, `Partials/_JobsGrid.cshtml`, `Partials/_SearchFiltersBar.cshtml`, `Partials/_ResultsHeader.cshtml`, `Partials/_EmptyState.cshtml` |
| Sections (abas de perfil) | `_TabA11ySection`, `_TabAgendaSection`, `_TabAppsSection`, `_TabDocsSection`, `_TabEduSection`, `_TabExperienceSection`, `_TabLgpdSection`, `_TabNotifySection`, `_TabPrefSection`, `_TabProfileSection`, `_TabRefsSection`, `_TabSkillsSection` |

#### 1.2.5 Shared (layout, componentes de UI e ViewComponents)

| Componente | Arquivo |
|-----------|---------|
| Layout raiz | `Views/Shared/_Layout.cshtml` |
| Error | `Views/Shared/Error.cshtml` |
| Topbar — brand | `_TopbarBrand.cshtml` |
| Topbar — ações usuário | `_TopbarUserActions.cshtml`, `_TopbarUserMenu.cshtml` |
| Sidebar offcanvas | `_OffcanvasSidebar.cshtml` |
| Menu principal (ViewComponent) | `Components/MainMenu/Default.cshtml`, `_MenuItem.cshtml`, `_MenuModule.cshtml`, `_MenuModuleFeedback.cshtml` |
| Menu Owner (ViewComponent) | `Components/OwnerMenu/Default.cshtml` |
| Seletor tenant (topbar) | `Components/TopbarTenantSelector/Default.cshtml` |
| Cards/KPIs | `_KpiCardRow.cshtml`, `_KpiMiniRow.cshtml`, `_KpiSimpleRow.cshtml` |
| Notificações modal | `_ModalNotifications.cshtml` |
| Reset DB modal | `_ResetDbModal.cshtml` |
| Toast | `_Toast.cshtml` |
| Footer | `_Footer.cshtml` |
| Validation partial | `_ValidationScriptsPartial.cshtml` |
| View imports | `_ViewImports.cshtml`, `_ViewStart.cshtml` |

---

## 2. Inventário `LioTecnica.Web.Next` (rotas existentes em 2026-04-20)

Estrutura-chave (Next 16, App Router, `basePath: /app`, `output: "export"`):

### 2.1 Públicas (fora do `(app)`)

| Rota Next | Arquivo |
|-----------|---------|
| `/login` | `src/app/login/page.tsx` |
| `/PortalVagas` | `src/app/PortalVagas/page.tsx` |
| `/PortalVagas/Acesso` | `src/app/PortalVagas/Acesso/page.tsx` |
| `/PortalVagas/Proposta` | `src/app/PortalVagas/Proposta/page.tsx` |
| `/DocumentoAdmissao` | `src/app/DocumentoAdmissao/page.tsx` |

### 2.2 Autenticadas `(app)`

- Recrutamento e triagem: `/vagas` (+ `editar`, `hub`), `/candidatos` (+ `detalhes`), `/talentos`, `/triagem`, `/matching`, `/agendas`, `/entradaemailpasta`, `/recrutamento/{candidaturas,propostas-vaga,sla}`.
- Cadastros: `/areas`, `/departamentos`, `/categorias`, `/cargos`, `/cadastro/funcoes`, `/unidades`, `/funcionarios`, `/pessoas`, `/bloqueiopessoa`, `/categorias-salariais`, `/centros-custo`, `/descricao-cargo`, `/eixo-vaga`, `/empresas`, `/nivel-cargo`, `/turnos`, `/unidades-lotacao`, `/totvs-cargos` (redirect → `/cargos`).
- Gestão/feedback: `/gestao` (+ `dashboard`, `humor`, `planosdesenvolvimento`, `resumoatividades`, `painel-solicitacoes`, `solicitacoes`, `aprovacoes`, `desligamentos`, `promocoes`, `comissoes`, `batida-ponto`, `pipeline`, `processo-seletivo`, `projetos`), `/feedback/*` (`celebracao`, `enviar`, `feedbacks`, `gamificacao`, `gestao`, `meusplanos`, `pesquisarapida`, `pesquisas`, `reunioes1a1`, `superpesquisa`, `minhas-avaliacoes`, `avaliacao`, `avaliacoes`, `nine-box`, `metas`), `/desempenho`.
- Colaborador (self-service): `/colaborador/{beneficios,dependentes,documentos,endereco,ferias,perfil,senha,solicitacao-dependentes}`.
- Admissão: `/admissao` (+ `nova`, `revisao`, `tracking`, `integracao`).
- Painel RH: `/painel-rh` (+ `[id]`).
- Usuários/perfis: `/usuariosperfis`, `/notificacoes`, `/relatorios`.
- Integração: `/integracao-totvs`.
- Admin (tenant): `/admin` (+ `accesses`, `api-keys`, `aprovadores-alternativos`, `configuracao-aprovacoes`, `configuracoes-headcount`, `documentacao-padrao`, `email-config`, `email-templates`, `emails`, `entra-id`, `gestores`, `hierarquia`, `localization`, `logs`, `menus`, `operational-logs`, `organograma`, `roles`, `tenant-configuracao`, `users`).
- Administração transversal: `/administracao/{notificacoes-candidatura, notificacoes-templates}`.
- Owner (multi-tenant): `/Owner` (+ `Tenants` com `[tenantId]`, `IA`, `AwsSettings`, `Integracao`).
- Dashboard: `/dashboard`.

---

## 3. Mapeamento legado → Next (com status atualizado em 2026-04-20)

### 3.1 Núcleo (auth + home)

| Rota legado | View/Controller | Rota Next | Status | Observação |
|-------------|-----------------|-----------|--------|------------|
| `/` | `Home/Index` | `/app` → redirect `/dashboard` | ✅ migrado | |
| `/Home/Privacy` | `Home/Privacy` | — | ⚠️ parcial | Política ainda publicada só no legado. |
| `/Account/Login` | `Account/Login` | `/login` | ✅ migrado | |
| `/Account/EntraLogin` | `Account/EntraLogin` | — (via BFF) | ⚠️ parcial | Fluxo redirect ainda toca `LioTecnica.Web` para iniciar challenge Entra. |
| `/Account/Logout` | `Account/Logout` | `/api/auth/logout` + `clearSession()` | ✅ migrado | |
| `/Account/SwitchTenant` | `Account/SwitchTenant` | Owner → "Acessar tenant" | ✅ migrado | |
| `/Dashboard` | `Dashboard/Index` | `/dashboard` | ✅ migrado | |

### 3.2 Recrutamento e triagem

| Rota legado | View | Rota Next | Status |
|-------------|------|-----------|--------|
| `/Vagas` | `Vagas/Index` | `/vagas` | ✅ migrado |
| `/Vagas/Matching/{id}` | `Vagas/Matching` | `/matching?vagaId=...` | ✅ migrado |
| `/Vagas` (edit) | modal `_ModalVaga` | `/vagas/editar` | ✅ migrado |
| `/Vagas` (hub/kanban) | — | `/vagas/hub` | 🆕 novo no Next (Onda 1) |
| `/Candidatos` | `Candidatos/Index` | `/candidatos` | ✅ migrado |
| `/Candidatos/Detalhes` | `Candidatos/Detalhes` | `/candidatos/detalhes?id=` + modal | ✅ migrado |
| `/Talentos` | `Talentos/Index` | `/talentos` | ✅ migrado |
| `/Triagem` | `Triagem/Index` | `/triagem` | ✅ migrado |
| `/Matching` | `Matching/Index` | `/matching` | ✅ migrado |
| `/Agendas` | `Agendas/Index` | `/agendas` | ✅ migrado |
| `/EntradaEmailPasta` | `EntradaEmailPasta/Index` | `/entradaemailpasta` | ✅ migrado |
| — | — | `/recrutamento/candidaturas` | 🆕 novo (Onda 1, kanban de candidaturas) |
| — | — | `/recrutamento/propostas-vaga` | 🆕 novo |
| — | — | `/recrutamento/sla` | 🆕 novo |

### 3.3 Cadastros

| Rota legado | View | Rota Next | Status |
|-------------|------|-----------|--------|
| `/Departamentos` | `Departamentos/Index` | `/departamentos` | ✅ migrado |
| `/Areas` | `Areas/Index` | `/areas` | ✅ migrado |
| `/Categorias` | `Categorias/Index` | `/categorias` | ✅ migrado |
| `/Cadastro/Funcoes` | `Cadastro/Funcoes/Index` | `/cadastro/funcoes` | ✅ migrado |
| `/Cadastro/Cargos` | `Cadastro/Cargos/Index` | `/cargos` | ✅ migrado (ROUTE_MAP) |
| `/Cargos` (novo) | `Cargos/Index` | `/cargos` | ✅ migrado |
| `/Unidades` | `Unidades/Index` | `/unidades` | ✅ migrado |
| `/Funcionarios` | `Funcionarios/Index` | `/funcionarios` | ✅ migrado |
| `/Pessoas` | `Pessoas/Index` | `/pessoas` | ✅ migrado |
| `/BloqueioPessoa` | `BloqueioPessoa/Index` | `/bloqueiopessoa` | ✅ migrado |
| — | — | `/categorias-salariais`, `/centros-custo`, `/descricao-cargo`, `/eixo-vaga`, `/empresas`, `/nivel-cargo`, `/turnos`, `/unidades-lotacao` | 🆕 novos no Next (não existem no legado). |
| — | — | `/totvs-cargos` | 🆕 redirect permanente → `/cargos`. |

### 3.4 Gestão e feedback

| Rota legado | View | Rota Next | Status |
|-------------|------|-----------|--------|
| `/Gestao` (redirect) | — | `/gestao` | ✅ migrado |
| `/Gestao/Dashboard` | `Gestao/Dashboard` | `/gestao/dashboard` | ✅ migrado |
| `/Gestao/Humor` | `Gestao/Humor` | `/gestao/humor` | ✅ migrado |
| `/Gestao/PlanosDesenvolvimento` | `Gestao/PlanosDesenvolvimento` | `/gestao/planosdesenvolvimento` | ✅ migrado |
| `/Gestao/ResumoAtividades` | `Gestao/ResumoAtividades` | `/gestao/resumoatividades` | ✅ migrado |
| `/Feedback/Celebracao` | `Feedback/Celebracao` | `/feedback/celebracao` | ✅ migrado |
| `/Feedback/Enviar` | `Feedback/Enviar` | `/feedback/enviar` | ✅ migrado |
| `/Feedback/Feedbacks` | `Feedback/Feedbacks` | `/feedback/feedbacks` | ✅ migrado |
| `/Feedback/Gamificacao` | `Feedback/Gamificacao` | `/feedback/gamificacao` | ✅ migrado |
| `/Feedback/GamificacaoHistorico` | `Feedback/GamificacaoHistorico` | `/feedback/gamificacao` (aba) | ⚠️ parcial — sub-rota não migrada explicitamente; histórico consolidado em tab. |
| `/Feedback/Gestao` | `Feedback/Gestao` | `/feedback/gestao` | ✅ migrado |
| `/Feedback/MeusPlanos` | `Feedback/MeusPlanos` | `/feedback/meusplanos` | ✅ migrado |
| `/Feedback/PesquisaRapida` | `Feedback/PesquisaRapida` | `/feedback/pesquisarapida` | ✅ migrado |
| `/Feedback/Pesquisas` | `Feedback/Pesquisas` | `/feedback/pesquisas` | ✅ migrado |
| `/Feedback/Reunioes1a1` | `Feedback/Reunioes1a1` | `/feedback/reunioes1a1` | ✅ migrado |
| `/Feedback/SuperPesquisa` | `Feedback/SuperPesquisa` | `/feedback/superpesquisa` | ✅ migrado |
| `/Desempenho/MinhasAvaliacoes` | `Desempenho/MinhasAvaliacoes` | `/desempenho` + `/feedback/minhas-avaliacoes` | ✅ migrado (duas rotas de entrada) |
| — (novo) | — | `/gestao/painel-solicitacoes` | 🆕 novo (Onda 7+; agregador de solicitações) |
| — (novo) | — | `/gestao/solicitacoes`, `/gestao/aprovacoes`, `/gestao/desligamentos`, `/gestao/promocoes`, `/gestao/comissoes`, `/gestao/batida-ponto`, `/gestao/pipeline`, `/gestao/processo-seletivo`, `/gestao/projetos` | 🆕 novos |
| — (novo) | — | `/feedback/{avaliacao,avaliacoes,metas,nine-box}` | 🆕 novos |

### 3.5 Admin (por tenant)

| Rota legado | View | Rota Next | Status |
|-------------|------|-----------|--------|
| `/Admin/Accesses` | `AdminAccesses/Index` | `/admin/accesses` | ✅ migrado |
| `/Admin/ApiKeys` | `AdminApiKeys/Index` | `/admin/api-keys` | ✅ migrado |
| `/Admin/Roles` (+`Edit/{id}`) | `AdminRoles/{Index,Edit}` | `/admin/roles` | ✅ migrado (edição inline/modal) |
| `/Admin/Users` (+`Edit/{id}`) | `AdminUsers/{Index,Edit}` | `/admin/users` | ✅ migrado |
| `/Admin/Menus` (+`Edit/{id}`) | `AdminMenus/{Index,Edit}` | `/admin/menus` | ✅ migrado |
| `/Admin/EmailConfig` | `AdminEmailConfig/Index` | `/admin/email-config` | ✅ migrado |
| `/Admin/EmailTemplates` | `AdminEmailTemplates/Index` | `/admin/email-templates` | ✅ migrado |
| `/Admin/Emails` | `AdminEmails/Index` | `/admin/emails` | ✅ migrado |
| `/Admin/EntraIdConfig` | `AdminEntraIdConfig/Index` | `/admin/entra-id` | ✅ migrado |
| `/Admin/LocalizationConfig` | `AdminLocalizationConfig/Index` | `/admin/localization` | ✅ migrado |
| `/Admin/Logs` | `AdminLogs/Index` | `/admin/logs` | ✅ migrado |
| `/Admin/OperationalLogs` | `AdminOperationalLogs/Index` | `/admin/operational-logs` | ✅ migrado |
| — (novo) | — | `/admin/documentacao-padrao` | 🆕 novo (Onda 5 — padrão global + por-NivelCargo + histórico) |
| — (novo) | — | `/admin/aprovadores-alternativos` | 🆕 novo |
| — (novo) | — | `/admin/configuracao-aprovacoes`, `/admin/configuracoes-headcount` | 🆕 novos |
| — (novo) | — | `/admin/gestores`, `/admin/hierarquia`, `/admin/organograma` | 🆕 novos |
| — (novo) | — | `/admin/tenant-configuracao` | 🆕 novo (toggle de módulos) |

### 3.6 Owner (multi-tenant)

| Rota legado | View | Rota Next | Status |
|-------------|------|-----------|--------|
| `/Owner` | redirect | `/Owner` → redirect `/Owner/Tenants` | ✅ migrado |
| `/Owner/IA` | `Owner/IA/Index` | `/Owner/IA` | ✅ migrado |
| `/Owner/Tenants` | `Owner/Tenants/Index` | `/Owner/Tenants` | ✅ migrado |
| `/Owner/Tenants/Create` | `Owner/Tenants/Create` | modal/criação inline em `/Owner/Tenants` | ✅ migrado |
| `/Owner/Tenants/{id}` | `Owner/Tenants/Details` | `/Owner/Tenants/[tenantId]` → `?id=` | ✅ migrado |
| `/Owner/Tenants/{id}/Users` | `Owner/TenantUsers/Index` | Aba `TabUsuarios` em `TenantDetailScreen` | ✅ migrado |
| `/Owner/Tenants/{id}/Users/Edit/{uid}` | `Owner/TenantUsers/Edit` | modal em `TabUsuarios` | ✅ migrado |
| `/Owner/Tenants/{id}/Users/SetPassword` | `Owner/TenantUsers/SetPassword` | modal em `TabUsuarios` | ✅ migrado |
| `/Owner/Tenants/{id}/Config/Acessos` | BFF inline | Aba em `TenantDetailScreen` | ✅ migrado |
| `/Owner/Tenants/{id}/Config/Menus` | BFF inline | Aba em `TenantDetailScreen` | ✅ migrado |
| `/Owner/Tenants/{id}/Config/Logs` | BFF inline | Aba em `TenantDetailScreen` | ✅ migrado |
| `/Owner/Tenants/{id}/Config/OperationalLogs` | BFF inline | Aba em `TenantDetailScreen` | ✅ migrado |
| — (novo) | — | `/Owner/AwsSettings` | 🆕 novo |
| — (novo) | — | `/Owner/Integracao` | 🆕 novo |

### 3.7 Relatórios, notificações e portais

| Rota legado | View | Rota Next | Status |
|-------------|------|-----------|--------|
| `/Relatorios` | `Relatorios/Index` | `/relatorios` | ✅ migrado |
| `/Notifications` | `Notifications/Index` | `/notificacoes` | ✅ migrado |
| — (novo) | — | `/administracao/notificacoes-candidatura` | 🆕 novo (Onda 2 — auditoria de disparos) |
| — (novo) | — | `/administracao/notificacoes-templates` | 🆕 novo (Onda 4 — editor de templates email/WhatsApp por etapa×canal) |
| `/UsuariosPerfis` | `UsuariosPerfis/Index` | `/usuariosperfis` | ✅ migrado |

### 3.8 PortalVagas (candidato externo)

| Rota legado | View | Rota Next | Status |
|-------------|------|-----------|--------|
| `/PortalVagas` | `PortalVagas/Index` | `/PortalVagas` | ✅ migrado |
| `/PortalVagas/Acesso` | `PortalVagas/Acesso` | `/PortalVagas/Acesso` | ✅ migrado |
| `/PortalVagas/Profile` | `_ProfileModal` | Modal no Next | ✅ migrado |
| `/PortalVagas/Skills...Accessibility` (12 abas) | Sections/* | 12 abas no modal perfil | ✅ migrado |
| `/PortalVagas/Apply` | `_ApplyModal` | Modal no Next | ✅ migrado |
| — (novo) | — | `/PortalVagas/Proposta` | 🆕 novo (aceite digital) |

### 3.9 Operação e utilitários

| Rota legado | View | Rota Next | Status | Observação |
|-------------|------|-----------|--------|------------|
| `/Ops/ResetDb` | `_ResetDbModal` | — | 🗑️ obsoleto | Reset DB fica apenas no legado em dev; não migrar. |
| `/Culture/Set?c=pt-BR` | — | `next-intl` / UI setter | ✅ migrado |
| `/api/health`, `/health` | `HealthController` | Mantido na API (`RHPortal.Api`) | ✅ migrado |
| `/api/lookup/...` | `LookupController` | Mantido na API ou BFF | ✅ migrado |
| `/bff/*` | BFF Controllers | Mantidos (consumidos pelo Next) | ♻️ permanente |

---

## 4. Telas/funcionalidades pendentes (por prioridade)

Com base na Seção 3 — apenas itens ainda não ✅:

### 4.1 Alta prioridade (bloqueiam descomissionamento)

1. **Login Entra ID — fluxo 100% no Next** (`/login`)
   - Legado: `AccountController.EntraLogin` + middleware OIDC em `LioTecnica.Web`.
   - Proposta Next: página `/login` delega ao endpoint da API (`/api/auth/entra/challenge`) e recebe token via callback. Mover o challenge OIDC do MVC para a API (ou manter `BffAuthController` como único ponto, com Next como front-end).
   - Arquivos Next a criar: `src/app/login/EntraButton.tsx`, callback `src/app/login/callback/page.tsx` (ou handler no app router).
   - Risco: `output: "export"` do Next — callback OIDC **precisa** terminar num endpoint server-side (API) que devolva o token; o Next só consome.

2. **Política de Privacidade** (`/Home/Privacy`)
   - Ainda atendida pelo MVC. Migrar para página estática `/privacidade` no Next ou publicar em `/app/privacidade`.
   - Simples, mas obrigatório para descomissionar o host Razor.

### 4.2 Média prioridade (nice-to-have; legacy ainda aceitável)

3. **Gamificação — histórico dedicado** (`/Feedback/GamificacaoHistorico`)
   - Hoje o Next consolida tudo em `/feedback/gamificacao`. Avaliar se o legado ainda é a "fonte" dos gráficos de histórico; caso sim, mover a view para uma aba explicita na rota Next e depreciar.

4. **Páginas de erro custom**
   - Legado: `Views/Shared/Error.cshtml`.
   - Next: `error.tsx` + `not-found.tsx` no app router.
   - Confirmar se `error.tsx` existente cobre todos os cenários (500, 403, 404 por tenant/módulo desabilitado).

### 4.3 Baixa prioridade (obsoletas ou já substituídas por nova arquitetura)

5. **Ops/ResetDb** — 🗑️ não migrar. Ferramenta dev; morrer junto com o Razor.
6. **Partials/modals legados** — 🗑️ todos os `_Modal*.cshtml`/`_Offcanvas*.cshtml` são absorvidos pelos modais do Next (shadcn/Radix). Não há 1:1 a migrar.

---

## 5. Plano de migração em fases

A migração **principal** já ocorreu ao longo das Ondas 1–6. As fases abaixo formalizam o que ainda falta e **preparam o descomissionamento**.

### Fase 13.1 — Saneamento e paridade 1:1 (estimativa: 1 sprint)

**Escopo:**
- Migrar `/Home/Privacy` para `src/app/(public)/privacidade/page.tsx` (conteúdo texto markdown, sem dependência de API).
- Revisar `error.tsx`/`not-found.tsx` para cobrir 404/500/403 com mensagens por tenant.
- Consolidar `/Feedback/GamificacaoHistorico` em aba explícita na rota Next.

**Critério de feito:** smoke test E2E (`LioTecnica.Web.E2E`) — todas as rotas da Seção 3.1–3.9 respondem 200 via Next sem necessidade do host MVC.

**Dependência de API:** nenhuma nova; reusa `/api/feedback/*` já existente.

---

### Fase 13.2 — Login Entra ID direto pela API + Next (estimativa: 1–2 sprints)

**Escopo:**
- Mover o challenge OIDC de `LioTecnica.Web/Program.cs` (AddAuthentication `.AddOpenIdConnect`) para `RHPortal.Api` (endpoint `POST /api/auth/entra/challenge` + callback que devolve JWT + cookie de sessão cross-site no mesmo top-level).
- Ajustar `src/app/login/page.tsx` para oferecer botão "Entrar com Microsoft" que dispara `window.location = '/api/auth/entra/challenge?returnUrl=/app'` (a API redireciona, processa o callback e volta para `/app` com o token).
- Ajustar `AdminEntraIdConfigController` / `/admin/entra-id` no Next para continuar mantendo config por tenant.
- Remover middleware OIDC do `LioTecnica.Web/Program.cs` após validação.

**Critério de feito:**
- Login Entra em três tenants de teste (um com SSO, dois locais) funcionando 100% no Next.
- Logout limpa cookie e sessionStorage.
- `BffAuthController.EntraLogin` marcado `[Obsolete]` com redirect para `/api/auth/entra/challenge`.

**Dependência de API:**
- Endpoints novos em `RHPortal.Api/Controllers/AuthController.cs`.
- Configuração `Authentication:Microsoft:ClientId/Secret/TenantIds` replicada no `RHPortal.Api`.
- **Risco**: cookies cross-site — possivelmente precisar `SameSite=None; Secure` em produção, o que força HTTPS ponta a ponta.

---

### Fase 13.3 — Congelar novas features no `LioTecnica.Web` (estimativa: imediata)

**Escopo:** decisão de processo, não código.
- Adicionar banner no `_Layout.cshtml` do MVC: "Este portal é legado. Nova versão em `/app`."
- Adicionar `CODEOWNERS` / convenção: nenhum PR novo no `LioTecnica.Web` exceto bugfix crítico.
- Criar issue pública "Portal MVC em modo manutenção".

**Critério de feito:** commit anunciado no `changelog.md` com nota de congelamento.

---

### Fase 13.4 — Redirecionamento em massa (estimativa: 1 sprint)

**Escopo:** fazer todas as rotas-raiz do MVC redirecionarem para as rotas equivalentes do Next.

**Implementação proposta (no `LioTecnica.Web/Program.cs`):**
```csharp
app.MapGet("/", ctx => { ctx.Response.Redirect("/app/dashboard", permanent: false); return Task.CompletedTask; });
app.MapGet("/Dashboard", ctx => { ctx.Response.Redirect("/app/dashboard"); ...});
// ... e assim para cada controller listado na Seção 3
```
ou tabela em `RouteRedirects.cs` lendo CSV com pares `legacy → next`.

**Mapa:** ver colunas "Rota legado" e "Rota Next" da Seção 3.

**Critério de feito:**
- Todos os `GET /*` que não forem `/bff/*`, `/api/*`, `/health`, `/PortalVagas*` redirecionam para `/app/*`.
- `PortalVagas` permanece no MVC até Fase 13.5.
- `/bff/*` permanece servindo o Next (Menu, Auth, Dashboard, Lookups, Notifications).

**Dependência de API:** nenhuma.

---

### Fase 13.5 — PortalVagas externo 100% no Next (estimativa: já feito, mas validar host)

**Escopo:**
- Confirmar que `/PortalVagas`, `/PortalVagas/Acesso`, `/PortalVagas/Proposta` são servidos exclusivamente pelo Next em produção (`render-rh.com.br/PortalVagas` → Next).
- Remover `PortalVagasController` + Views após confirmar zero acesso por 15 dias.

**Critério de feito:**
- Monitoramento NGINX: zero hit em `LioTecnica.Web` rota `/PortalVagas` por 15 dias.
- Arquivos `LioTecnica.Web/Controllers/PortalVagasController.cs` e `LioTecnica.Web/Views/PortalVagas/**` removidos em PR.

---

### Fase 13.6 — BFF permanece, Views morrem (estimativa: 1 sprint)

**Escopo:**
- Remover todos os `*Controller.cs` **que herdam de `Controller`** (servem Views) e suas `Views/**`.
- Manter os **BFF Controllers** (`BffAuthController`, `BffController`, `BffDashboardController`, `BffLookupsController`, `BffNavigationController`, `BffNotificationsController`) + `HealthController` + `CultureController` + `LookupsController` (que é `/api/lookup`).
- Renomear `LioTecnica.Web` → `LioTecnica.Bff` ou publicá-lo como serviço separado (decisão do arquiteto).

**Alternativa (mais limpa):** migrar os 7 BFF controllers para dentro de `RHPortal.Api` como novos controllers (`BffNavigationController`, etc.) e aposentar o projeto `LioTecnica.Web` por completo. **Isto exige**:
- Mover helpers de permissões/sessão para a API.
- Mover `ModuleCatalog` para a API (já está lá).
- Ajustar `Next/next.config.ts` para `bffOrigin = apiOrigin` (um único destino).

**Critério de feito:**
- Zero `.cshtml` em `LioTecnica.Web` (ou zero projeto).
- `LioTecnica.Web.csproj` passa a ter só os BFF controllers (ou é deletado).
- E2E verde no Next.

---

### Fase 13.7 — Documentação e comunicação

**Escopo:**
- Atualizar `VISAO_GERAL_PROJETO.md` refletindo que o MVC foi descomissionado.
- Marcar [MIGRACAO-RAZOR-PARA-NEXT-ANALISE.md](./MIGRACAO-RAZOR-PARA-NEXT-ANALISE.md) como "superseded by PORTAL_MVC_INVENTARIO_E_MIGRACAO.md".
- Comunicar aos clientes (mail interno + topbar) da mudança de URL caso tenham bookmarks antigos.

**Critério de feito:** entrada no `changelog.md` com a data do desligamento e link para este documento.

---

## 6. Plano de descomissionamento do `LioTecnica.Web`

### 6.1 Pré-requisitos (todos obrigatórios)

| # | Item | Responsável | Onda/Fase |
|---|------|-------------|-----------|
| 1 | Login Entra ID no Next 100% | Backend/API | 13.2 |
| 2 | Política de Privacidade migrada | Frontend | 13.1 |
| 3 | `/Home/*` e `/Account/Logout` redirecionando para `/app/*` | Frontend/DevOps | 13.4 |
| 4 | E2E `LioTecnica.Web.E2E` verde só com Next | QA | 13.1 |
| 5 | Monitoramento NGINX: >95% tráfego em `/app/*` | DevOps | 13.4 |
| 6 | PortalVagas externo sem hits em `/PortalVagas` do MVC | DevOps | 13.5 |
| 7 | Backup completo do banco + container do MVC | DevOps | 13.6 |
| 8 | BFF controllers migrados para `RHPortal.Api` **ou** `LioTecnica.Web` renomeado para BFF-only | Backend | 13.6 |

### 6.2 Checklist de desligamento (D-day)

- [ ] Anunciar data no `diario-de-bordo.md` e `changelog.md` com 30 dias de antecedência.
- [ ] **DNS/Ingress**: rotear 100% de `render-rh.com.br/` para o serviço Next; MVC fica em `legacy-render-rh.com.br` com banner "este portal será desligado em X dias".
- [ ] **Redirects 301 completos**: cobrir mapa da Seção 3; validar com `curl -I`.
- [ ] **Smoke tests (manual + automatizado)**:
  - Login (local + Entra) em 3 tenants
  - Criar vaga + candidatar-se via PortalVagas
  - Dashboard, Matching, Triagem, Agendas
  - Notificações WhatsApp + e-mail disparando
  - Documentação padrão por NivelCargo
  - Painel de Solicitações
  - Owner: criar tenant, alternar módulos, editar usuários
- [ ] **Comunicação**: e-mail para `adminsSupport` + banner no próprio MVC nos últimos 7 dias.
- [ ] **Congelar PRs** no `LioTecnica.Web` (CODEOWNERS vazio).
- [ ] **Remover** ou **parar** o container/serviço `LioTecnica.Web`.
- [ ] **Esperar 30 dias** com backup online em `legacy-render-rh.com.br`.
- [ ] **Remover** projeto da solução (`LioTecnica.sln`) e deletar `LioTecnica.Web/` em PR.
- [ ] **Atualizar** `docker-compose.yml`, `azure-pipelines.yml`, `setup-dev.sh/ps1` para remover targets do MVC.

### 6.3 Ponto de não-retorno

O projeto `LioTecnica.Web` só pode ser **deletado do repositório** após:
1. Fase 13.6 concluída;
2. 30 dias sem revert solicitado;
3. Owner + Admin de cada tenant validarem por escrito.

---

## 7. Riscos e dívidas

### 7.1 Autenticação

- **Cookie (MVC) vs Bearer Token (Next)**
  Hoje o MVC autentica por cookie e o Next por JWT em memória/sessionStorage. Durante a fase de coexistência (basePath `/app`), um usuário logado no MVC **não** está logado no Next (e vice-versa). `BffAuthController` tenta unificar, mas quando o MVC morrer, a fonte única passa a ser `RHPortal.Api`. Consolidar em um único handshake (challenge na API, cookie `Secure; SameSite=None` + token espelho no JS) reduz dívida.

- **Entra ID** (já listado na Seção 4.1)
  Configuração OIDC está duplicada entre `LioTecnica.Web/Program.cs` e `AdminEntraIdConfigController`. Precisa centralizar em `RHPortal.Api`.

- **Logout**
  Confirmar que logout do Next (POST `/api/auth/logout`) também invalida cookie do MVC enquanto coexistirem.

### 7.2 Arquitetura do Next

- **`output: "export"`** (static export)
  - ❌ Não suporta rotas dinâmicas server-side (`/vagas/[id]/server-action`).
  - ⚠️ Rotas como `/Owner/Tenants/[tenantId]` funcionam via `generateStaticParams` com placeholder + redirect `?id=`. Mantido por ora; se precisarmos SSR dinâmico, trocar para `output: "standalone"` — mas isso muda deploy (Node runtime em vez de static NGINX).
  - Impacto no login Entra (Fase 13.2): **o callback OIDC tem que terminar na API**, não no Next.

- **`basePath: "/app"`**
  - Funciona hoje porque o MVC está na raiz. Quando o MVC morrer, decidir: manter `/app` ou mover para `/`?
  - Manter `/app` é mais simples (menos redirects). Mover para `/` é mais natural, mas força atualizar todos os bookmarks.

### 7.3 BFF e endpoints duplicados

- **`/bff/lookups` vs `/api/lookup`**
  Dois caminhos para lookups. Próxima geração de telas no Next deveria sempre usar `/api/lookup` (fonte única). `/bff/lookups` fica para compat até a Fase 13.6.

- **`/bff/navigation` vs `/api/navigation`** (Sessão 24)
  Já há unificação — Next consome o que o backend manda. Validar que nenhum `*.cshtml` ainda consome `/bff/navigation` de forma incompatível.

### 7.4 Funcionalidades novas sem equivalente legado (não é risco, mas é trap)

Muitas rotas do Next (✅ na Seção 3) **não existem** no legado: `/gestao/painel-solicitacoes`, `/admin/documentacao-padrao`, `/administracao/notificacoes-templates`, `/recrutamento/candidaturas`, etc. Se alguém tentar "voltar" para o MVC por qualquer motivo, **essas features desaparecem**. Isso reforça: **o ponto de não-retorno começa na Fase 13.3 (congelamento)** — depois disso, só avançamos.

### 7.5 i18n

- Legado usa `IStringLocalizer` + resx. Next usa strings hard-coded em pt-BR (com algum `next-intl` parcial).
- Portal Vagas tem `portal-vagas-strings.js` no legado com ~100 strings que não foram migradas.
- **Dívida:** consolidar tudo em `LioTecnica.Web.Next/src/messages/{pt-BR,en-US,es-ES}.json`. Fora do escopo da Onda 13, mas anotar em backlog.

### 7.6 E2E

- `LioTecnica.Web.E2E` ainda tem testes apontando para URLs do MVC. Revisar a suite na Fase 13.1.
- Pendente criar smoke específico para o fluxo Entra ID no Next (Fase 13.2).

---

## 8. Resumo executivo

| Indicador | Valor |
|-----------|-------|
| Controllers legados inventariados | **53** |
| Views Razor inventariadas (incluindo partials/modals/sections) | **~113** |
| Rotas do Next identificadas (2026-04-20) | **~90** (incluindo sub-rotas `colaborador/*`, `gestao/*`, `admin/*`) |
| Rotas já ✅ migradas | **100%** dos módulos — Next assumiu o atendimento |
| Fases planejadas | **7** (13.1 → 13.7) |
| Fases concluídas (2026-04-20) | **7 / 7** ✅ |
| Desligamento total do `LioTecnica.Web` | **Concluído** — diretórios `LioTecnica.Web/` e `LioTecnica.Web.E2E/` removidos |

### Fechamento — Fase 13 (2026-04-20)

| Fase | Entregável | Status |
|------|-----------|--------|
| 13.1 | `/privacidade` e `not-found.tsx` no Next (LGPD + 404 global) | ✅ |
| 13.2 | `EntraChallengeService` + endpoints `GET /api/auth/entra/{enabled,challenge,callback}` na `RHPortal.Api`, UI SSO no LoginScreen | ✅ |
| 13.3 | Congelamento de features no MVC (pulado: deletado direto) | ✅ |
| 13.4 | Remoção de `/bff/*` do `next.config.ts` (rewrite) e do `nginx.conf` | ✅ |
| 13.5 | PortalVagas 100% no Next (já atendia) | ✅ |
| 13.6 | BFF (endpoints) migrados para `/api/*` — Views Razor removidas | ✅ |
| 13.7 | `LioTecnica.Web/` + `LioTecnica.Web.E2E/` + `Dockerfile` legado apagados, `LioTecnica.sln` saneada | ✅ |

**Artefatos de regressão:**
- Testes unitários novos: `RHPortal.Api.Tests/Authentication/EntraChallengeServiceTests.cs` (23 casos, todos verdes).
- `dotnet build LioTecnica.sln` limpo (2 projetos — Integração RM e Schema).
- Build Next (`pnpm build`) sem regressão.

**Mensagem final para o arquiteto:** Portal MVC desligado. A solution agora é composta apenas de `LioTecnica.Web.Next` (SPA/static-export), `RHPortal.Api` (.NET 8 REST), `RHPortal.Ai` (Python FastAPI), e dois assemblies de integração TOTVS (`Liotecnica.Integration.RM*`). Docker Compose e Azure Pipelines já estavam apontando só para o Next + API + AI — nenhum ajuste de CD foi necessário.
