# Paridade de rotas (Legado x Next)

Este documento lista as **rotas/telas do legado** (ASP.NET MVC/Razor) e as **APIs** já existentes no próprio `LioTecnica.Web` (ex.: `/api/*`, `/*/_api/*`, `/bff/*`) que podem ser consumidas pelo Next para migrar tela por tela.

## Convenções

- **Legado UI**: `Voltage.RenderRH/LioTecnica.Web/Views/*`
- **Legado endpoints JSON**: `Voltage.RenderRH/LioTecnica.Web/Controllers/*Controller.cs`
- **Next UI**: `Voltage.RenderRH/LioTecnica.Web.Next/src/app/*`
- **Next SSR/BFF client**: `Voltage.RenderRH/LioTecnica.Web.Next/src/server/*`

## App interno (menu principal)

> Fonte do agrupamento por módulo: `Views/Shared/Components/MainMenu/Default.cshtml`.

| Módulo | Rota (UI) | Legado (controller/view) | Endpoints JSON existentes (legado) | Next (status) |
|---|---|---|---|---|
| Recrutamento | `/dashboard` | `DashboardController` + `Views/Dashboard/Index.cshtml` | `/bff/dashboard/kpis` | **Implementado** (`src/app/(app)/dashboard/page.tsx`) |
| Recrutamento | `/vagas` | `VagasController` + `Views/Vagas/Index.cshtml` | `GET/POST /api/vagas`, `GET/PUT/DELETE /api/vagas/{id}`, `GET /api/vagas/{id}/matching-*`, `PATCH /api/vagas/{id}/matching-filtros` | Placeholder (`src/app/(app)/vagas/page.tsx`) |
| Recrutamento | `/candidatos` | `CandidatosController` + `Views/Candidatos/Index.cshtml` | `GET /api/candidatos` (q/statuses/vagaIds/page/pageSize), `GET/PUT/DELETE /api/candidatos/{id}`, uploads/downloads em `/api/candidatos/{id}/documentos/*` | Placeholder (`src/app/(app)/candidatos/page.tsx`) |
| Recrutamento | `/notificacoes` (UI é `/Notificacoes`) | `NotificationsController` + `Views/Notifications/Index.cshtml` | `GET /Notifications/_api/list`, `POST /Notifications/_api/send`, `POST /Notifications/_api/seen/{id}`, `POST /Notifications/_api/read/{id}`, `GET /Notifications/_api/receipts/{id}`; além de `GET /bff/notifications` | Placeholder (`src/app/(app)/notificacoes/page.tsx`) |
| Recrutamento | `/agendas` | `AgendasController` + `Views/Agendas/Index.cshtml` | `GET /Agendas/_api/types`, `GET/POST/PUT/DELETE /Agendas/_api/events*` | **Pendente** |
| Recrutamento | `/talentos` | `TalentosController` + `Views/Talentos/Index.cshtml` | `GET /Talentos/_api/list`, CRUD em `/Talentos/_api/*`, import PDF, downloads | **Pendente** |
| Recrutamento | `/triagem` | `TriagemController` + `Views/Triagem/Index.cshtml` | `GET /Triagem/_api/vagas*`, `GET /Triagem/_api/candidatos*`, `PUT /Triagem/_api/candidatos/{id}` | **Pendente** |
| Recrutamento | `/matching` | `MatchingController` + `Views/Matching/Index.cshtml` | `POST /api/matching/recalculate?candidatoId=&vagaId=` | **Pendente** |
| Recrutamento | `/entradaemailpasta` | `EntradaEmailPastaController` + `Views/EntradaEmailPasta/Index.cshtml` | `GET/POST/PUT/DELETE /EntradaEmailPasta/_api/inbox*`, upload, `add-to-talentos`, `GET /EntradaEmailPasta/_api/vagas` | **Pendente** |
| Cadastros | `/areas` | `AreasController` + `Views/Areas/Index.cshtml` | CRUD em `/Areas/_api*` | **Pendente** |
| Cadastros | `/categorias` (e `/Funcoes`) | `CategoriasController` + `Views/Categorias/Index.cshtml` | CRUD em `/Categorias/_api*` e `/Funcoes/_api*` | **Pendente** |
| Cadastros | `/cargos` | `CargosController` + `Views/Cargos/Index.cshtml` | CRUD/paginação em `/Cargos/_api*` | **Pendente** |
| Cadastros | `/unidades` | `UnidadesController` + `Views/Unidades/Index.cshtml` | CRUD em `/Unidades/_api*`, lookup em `/api/lookup/units` | **Pendente** |
| Cadastros | `/funcionarios` | `FuncionariosController` + `Views/Funcionarios/Index.cshtml` | `GET /Funcionarios/_api` (+ filtros), CRUD em `/Funcionarios/_api*` | **Pendente** |
| Cadastros | `/pessoas` | `PessoasController` + `Views/Pessoas/Index.cshtml` | `GET /api/pessoas`, `GET /api/pessoas/{id}`, `PUT /api/pessoas/{id}` | **Pendente** |
| Cadastros | `/cadastro/funcoes` | `CadastroController` + `Views/Cadastro/Funcoes/Index.cshtml` | CRUD em `/Cadastro/Funcoes/_api*` | **Pendente** |
| Cadastros | `/cadastro/cargos` | `CadastroController` + `Views/Cadastro/Cargos/Index.cshtml` | CRUD em `/Cadastro/Cargos/_api*` | **Pendente** |
| Relatórios | `/relatorios` | `RelatoriosController` + `Views/Relatorios/Index.cshtml` | `GET /Relatorios/_api/*` (catalog, entradas, funil, sla, ranking, etc.) | **Pendente** |
| Feedback | `/feedback/*`, `/gestao/*`, `/desempenho/*`, `/pesquisas` | `FeedbackController`, `GestaoController`, `DesempenhoController` + respectivas views | Muitos endpoints em `/Feedback/_api/*` (celebrações, planos, 1:1, gamificação, etc.) | **Pendente** |
| Admin | `/admin/*` | diversos controllers/views `Views/Admin*` | endpoints variados `.../_api/...` | **Pendente** |
| Admin | `/usuariosperfis` | `UsuariosPerfisController` + `Views/UsuariosPerfis/Index.cshtml` | muitos endpoints em `/UsuariosPerfis/_api/*` (users, roles, menus) | **Pendente** |
| Owner | `/owner/*` | `OwnerController` + `Views/Owner/*` | muitos endpoints em `/Owner/.../_api/*` | **Pendente** |

## Portal Vagas (público)

| Rota (UI) | Legado (controller/view) | Endpoints existentes (legado) | Next (status) |
|---|---|---|---|
| `/PortalVagas` | `PortalVagasController.Index` + `Views/PortalVagas/Index.cshtml` | múltiplos `GET/PUT/POST/DELETE /PortalVagas/*` (Profile, Docs, Agenda, LGPD, etc.) | **Pendente** |
| `/PortalVagas/Acesso` | `PortalVagasController.Access` + `Views/PortalVagas/Acesso.cshtml` | `POST /PortalVagas/Auth/Login`, `POST /PortalVagas/Auth/Register`, `POST /PortalVagas/Logout` | **Pendente** |
| `/PortalVagas/Locations/*` | `PortalLocationsController` | `GET /PortalVagas/Locations/Ufs`, `GET /PortalVagas/Locations/Ufs/{uf}/Cities` | **Pendente** |

## Próximo passo imediato

1. Criar um **fallback global** no Next para que qualquer rota ainda não migrada:\n+   - use o shell (quando aplicável)\n+   - e redirecione para o legado (ou mostre instrução quando `LEGACY_ORIGIN` não estiver setado).\n+2. Implementar clients no Next para consumir as APIs do legado em SSR/Client conforme a rota (ex.: `/api/vagas`, `/Agendas/_api/events`, `/Feedback/_api/*`).\n+
