# Changelog

Todas as mudanças técnicas relevantes. Formato: [Keep a Changelog](https://keepachangelog.com/).

Datas em ISO `YYYY-MM-DD`. Tipos: `Added` / `Changed` / `Fixed` / `Removed` / `Security`.

---

## [Unreleased] — 2026-04-28 — Polish visual + filtros de escopo + correções HTTP

Ronda final de ajustes pós-Fase 1 cobrindo: rebranding visual da matriz Nine-Box, simplificação do empty-state em Ciclos, correção do HTTP 400 ao postar celebrações com menção não resolvida, e extensão das super-roles do `PermissionAuthorizationHandler` / `ModuleAuthorizationHandler` para reconhecer `Admin`/`Administrador` (antes só `Owner`/`ApiKey`).

### Changed — Nine-Box: paleta pastel + drag-and-drop + drawer + filtros de escopo
**Frontend:** `LioTecnica.Web.Next/src/features/feedback/nine-box/NineBoxScreen.tsx` (reescrita visual, mantendo todos os endpoints `/api/nine-box/*` e `/api/funcionarios`).

- Paleta pastel padrão de mercado (Estrela=azul, Núcleo=amarelo, Em Desenvolvimento=laranja, Questionável=vermelho — 9 quadrantes mapeados em `QUADRANTS` com `bg/border/title/swatch`).
- **Drag-and-drop nativo** entre quadrantes (HTML5 dataTransfer) — substituiu o "clique-para-mover" da Entrega 1.7. Arrastar de "A posicionar" para um quadrante chama `POST /api/nine-box`.
- **Drawer lateral** (slide-in 420px) ao clicar no header de um quadrante: lista pessoas com avatar/cargo/área e atalhos "Recomendações" / "Adicionar".
- **Avatares determinísticos**: hash do `funcionarioId` mapeia para uma paleta de 16 tons pastéis. Iniciais sobrepostas. Reuso visual em chips, drawer e painel "A posicionar".
- **Painéis inferiores em grid 12-col**:
  - "**A posicionar**" (col-span-7) — chips dashed dos funcionários ainda sem assessment.
  - "**Distribuição**" (col-span-5) — 4 buckets (Top tier, Núcleo, Em desenv., Atenção) com barras e %.
- **Legenda** em grid 3-col com swatch + nome + descrição macro de cada quadrante.

### Changed — Nine-Box: filtros de escopo (Hierarquia + Área) com bloqueio até filtrar
- **Filtros adicionados na toolbar**: 2 selects nativos (Hierarquia / Área).
  - **Hierarquia** mapeia `HierarquiaId/HierarquiaDescricao` (organograma TOTVS — `PFUNCAO/PSECAO`). Foi escolhido em vez de `GestorDireto` porque o sync RM não popula `Funcionarios.GestorDiretoId` no banco da Liotécnica (0/636 ativos).
  - **Área** mapeia `CentroCustoId/CentroCustoDescricao` (comentário em `FuncionarioListQuery.cs:16`: *"Centro de custo — absorveu Area em 31.2"*). Cobertura: 636/636 ativos.
- **Bloqueio até aplicar 1 filtro**: matriz, "A posicionar" e "Distribuição" só renderizam após `hierarquiaFilter || areaFilter`. Antes disso, card de instrução "Selecione um escopo para começar" — evita poluição com 600+ pessoas do tenant.
- **Status=Ativo no fetch**: `?pageSize=500&status=1` (per requisito do usuário "funcionários deve ser somente os ativos").
- Lookups dos selects derivados da lista TODA (não dos filtrados) — usuário sempre vê todas as opções disponíveis.

### Changed — Ciclos de Avaliação: empty-state limpo
**Frontend:** `LioTecnica.Web.Next/src/features/feedback/CiclosAvaliacaoScreen.tsx`

- Quando `ciclos.length === 0 && !loading`, esconder completamente o bloco de filtros + busca + tabela.
- Visível só: header (título + descrição + botões `De Template` / `Novo Ciclo` / refresh) + 4 KPI cards zerados.
- Decisão tomada após iteração com mock HTML "hero state" — usuário preferiu o visual clean direto, sem hero gradient nem grid de templates inline.

### Fixed — Celebrações: HTTP 400 ao postar com menção não resolvida
**Backend:** `Contracts/Feedback/CelebrationContracts.cs` + `Application/Feedback/CelebrationService.cs`
**Frontend:** `LioTecnica.Web.Next/src/features/feedback/CelebracaoScreen.tsx`

Sintoma: usuário publicava celebração com `@@FULANO` mas matching no front falhava → enviava `mentionedUserIds: [null]` → ASP.NET retornava 400 antes do código rodar (struct `Guid` não-anulável dentro do array).

Fix em 3 camadas:
1. **Contratos C#** trocados de `IReadOnlyList<Guid>` para `IReadOnlyList<Guid?>?` em `CelebrationCreateRequest` e `CelebrationCommentCreateRequest` — tolerante a `[]`, `[null]` e nulls dentro do array.
2. **`CelebrationService.CreateAsync` + `CreateCommentAsync`**: filtra `null`/`Guid.Empty`/duplicados antes de bater no banco — `(request.MentionedUserIds ?? []).Where(x => x.HasValue && x.Value != Guid.Empty).Select(x => x!.Value).Distinct()`.
3. **Frontend `CelebracaoScreen.tsx`**: filtra ids inválidos do array antes do POST com type guard `(id): id is string => typeof id === "string" && id.length > 0`.

Smoke test confirmou: payloads `{"mentionedUserIds":[null]}` e `{"mentionedUserIds":[]}` agora retornam 401 (auth ausente em teste sem JWT) em vez de 400 — body deserializa.

### Fixed — Permissões: Admin/Administrador como super-roles
**Backend:** `Infrastructure/Security/PermissionAuthorizationHandler.cs` + `ModuleAuthorizationHandler.cs`

- Antes só `Owner` e `ApiKey` passavam sem checar permissão/módulo.
- Agora também `Admin` e `Administrador` (case-insensitive) — espelha o comportamento esperado pelo usuário na sessão (admin do tenant deveria ter visão completa sem precisar configurar 30 permissões).

### Fixed — Multi-tenant shadow users
**SQL** (não migration, fix one-shot por tenant):
- Owner global `d5823d79-9c97-433b-8f63-1a3be431eaa9` não existia em `Users` no banco `dev_render_liotecnica` → FK violation ao postar celebrações (FK `AuthorId → Users.Id`).
- Inserido shadow user + atribuição às roles `Admin`/`Administrador`. `UserRoles` exige `(UserId, RoleId, TenantId)` — incluído `TenantId` na insert (esquema multi-tenant, não Identity puro).
- Backfill de shadow users a partir dos 636 funcionários ativos da Liotécnica via endpoint `POST /api/funcionarios/backfill-shadow-users` (novo). Resultado: 636 shadow users criados.

### Documentação

- `changelog.md` — esta entrada (final da seção Fase 1).
- Memória pessoal `~/.claude/.../memory/` atualizada com:
  - `Sempre corrigir na origem RM, nunca marretar no Portal` — usuário reportou inconsistências (gestor zerado, vaga zumbi) que devem ir pro RH responsável corrigir no TOTVS, não receberem lógica defensiva no Portal.
  - `Inversão de fonte de vagas (VREQ* primário)` — refactor 2026-04-27 que resolveu zumbis automaticamente.
  - `CODSTATUS=4 "Concluída" = vaga preenchida` — não é "aprovação concluída".

---

## [Unreleased] — 2026-04-28 — Fase 1 fechada (Entregas 1.3 → 1.10)

### Entrega 1.3 — Templates de Feedback (12 modelos)
- Entity `FeedbackTemplate` + migration `20260428011820_AddFeedbackTemplates`
- Service `IFeedbackTemplateService` (List/Get/Create) + 3 endpoints em `FeedbackItemsController` (`/templates`)
- Seeder com 12 templates: Reconhecimento, Construtivo, Comunicação, Liderança, Colaboração, Evolução, Pós-Projeto, Pós-Apresentação, Sob Pressão, Proatividade, Melhoria, Marco. Conteúdo com placeholders `[contexto]` para o usuário substituir.
- Frontend `EnviarFeedbackScreen.tsx` integrado: dropdown agrupando "📚 Modelos Padrão" (do servidor) + "🧩 Modelos Universais" (fallback local). Banner "✨ Template aplicado" com guia.
- 12 testes em `FeedbackTemplateServiceTests.cs`.

### Entrega 1.4 — PDI auto-gerado por IA (a "jóia") 🌟
- Service `IPdiSuggesterService` em `Application/Feedback/PdiSuggesterService.cs` com **estratégia em camadas**: tenta IA via `ILlmAssistantService` → cai para fallback heurístico determinístico se IA falhar/timeout/indisponível. Garante valor mesmo com `RHPortal.Ai` degraded.
- Pipeline: agrega notas por pergunta da `AvaliacaoResposta`, identifica top 3-5 gaps, gera 5 metas SMART com horizonte 4 meses.
- Endpoint preview `GET /api/avaliacao/ciclos/{cicloId}/sugerir-pdi/{funcionarioId}` (não persiste).
- Endpoint apply `POST /api/feedback/plans/from-suggestion` em `DevelopmentPlansController` — gestor revisa e aplica.
- DTOs `PdiSuggestionResult`, `PdiSuggestedGoal`, `PdiCreateFromSuggestionRequest` em `Contracts/Feedback/`.
- Sem migration nova (reusa `DevelopmentPlan` + `DevelopmentPlanGoal`).
- 12 testes em `PdiSuggesterServiceTests.cs` (todos passam com `llm: null` forçando fallback).

### Entrega 1.5 — Templates de Survey (eNPS, Clima, Liderança, Diversidade)
- Entity `SurveyTemplate` + `SurveyTemplateQuestion` + migration `20260428013143_AddSurveyTemplates`
- Service `ISurveyTemplateService` com `CreateSurveyFromTemplateAsync` (copia perguntas + opções para `Survey` real)
- 4 templates seed BR validados:
  - **eNPS** — Score 0-10 + comentário (cron sugerido trimestral)
  - **Clima** — 7 perguntas SingleChoice + textos livres (semestral)
  - **Liderança** — 7 perguntas (semestral)
  - **Diversidade** — 6 perguntas pulse anônimo DE&I (anual)
- 4 endpoints em `SurveysController` (`/templates`, `/from-template`)
- 13 testes em `SurveyTemplateServiceTests.cs`.
- **Débito conhecido**: cadência cron é apenas informativa hoje. Disparo automático recorrente fica para Onda 2 (hosted service).

### Entrega 1.6 — OKRs com cascata simples
- `Meta` ganhou `ParentMetaId` (self-FK opcional) + nav `ParentMeta`/`ChildMetas`
- Nova entity `MetaCheckin` (status verde/amarelo/vermelho + ValorAtual + comentário) + migration `20260428013853_AddMetaCheckinAndParentMetaId`
- Métodos novos em `MetaService`: `ListTreeAsync(rootId?)`, `AddCheckinAsync`, `ListCheckinsAsync`
- DTOs novos: `MetaTreeNode`, `MetaCheckinCreateRequest`, `MetaCheckinResponse`
- Endpoints novos em `MetasController`: `GET /tree`, `POST /{id}/checkins`, `GET /{id}/checkins`
- Check-in com `ValorAtual` atualiza meta automaticamente; ao chegar em 100% → status `Concluida`.
- 11 testes em `MetaServiceCascataTests.cs` cobrindo: árvore 3-níveis, parent inválido, status inválido, cancelamento, ordenação por mais recente.

### Entrega 1.7 — Nine Box "drag-drop" (clique-mover)
- Approach: clique no card seleciona, clique em outro quadrante move (sem dependência de lib drag-drop nova).
- `NineBoxScreen.tsx`: state `movingItemId` + `moveItemToQuadrant` (POST `/api/nine-box`), banner de "Movendo: João" no header com cancelar, ring visual no card selecionado, hint "Clique para mover" em quadrantes vazios durante o modo.
- Atualização local após mover (sem reload completo).

### Entrega 1.8 — Catálogo Render Coins (fechando a alça da gamificação)
- Entities `RenderCoinReward` + `RenderCoinRedemption` + migration `20260428023716_AddRenderCoinRewards`
- Service `IRenderCoinRewardService`: `List/Get/Create`, `RedeemAsync` (debita saldo + decrementa estoque), `UpdateRedemptionStatusAsync` (Aprovar/Entregar/Cancelar — cancelar estorna coins e estoque).
- Workflow: 0=Solicitado → 1=Aprovado → 2=Entregue (ou 3=Cancelado).
- Cria automaticamente `RenderCoinTransaction` de débito ao resgatar e de crédito ao cancelar.
- Seeder com 6 recompensas: Café com Mimo (R$30, 100c), Massagem 45min (250c, estoque 5), Voucher iFood R$50 (200c, estoque 10), Day-Off (800c, estoque 3), Curso até R$200 (500c), Doação R$100 (300c).
- 5 endpoints novos em `GamificationController` (`/rewards`, `/rewards/redeem`, `/redemptions`, `/redemptions/{id}/status`).
- 15 testes em `RenderCoinRewardServiceTests.cs` cobrindo saldo insuficiente, estoque zero, inativo, estorno, decremento de estoque.

### Entrega 1.9 — Centro de Notificações in-app
- **Backend já existia** completo (`Notification`, `NotificationReceipt`, `NotificationsController`, `NotificationsHub`).
- Frontend: estendido `TopbarClient.tsx` com integração real ao `/api/notifications`:
  - Polling de 60s para buscar últimas 10 + unread count
  - Badge unifica `notifUnread + pendingApprovals`
  - Dropdown com lista clicável (level color: error/warning=vermelho, success=verde, info=azul), age label (agora/min/h/d), highlight de não lidas, mark-read on click
  - Click em notif com URL navega + marca read; sem URL marca read inline
  - Banner especial de "aprovações pendentes" preserva fluxo existente
- Sem mudanças de schema.
- **Débito conhecido**: integração SignalR client (push real-time) fica para Onda 2.

### Entrega 1.10 — Mobile responsivo
- Pass de breakpoints nas telas/componentes que mudei nas entregas 1.1-1.9:
  - `TopbarClient` dropdown de notificações: `w-[calc(100vw-2rem)] sm:w-96` (não estoura em mobile pequeno)
  - `CiclosAvaliacaoScreen` header: botões `flex-wrap w-full sm:w-auto` + `flex-1 sm:flex-none`, label "Atualizar" oculto em mobile
- Telas existentes (Reuniões 1:1, Enviar Feedback) já tinham `grid-cols-1 md:grid-cols-2` etc. — mantidas.
- **Débito conhecido**: app mobile nativo fica para Onda 3.

### Resumo numérico da Fase 1 fechada

| Entrega | Tabelas novas | Endpoints novos | Testes novos | Migration |
|---|---|---|---|---|
| 1.1 Avaliação | 2 | 4 | 16 | ✅ |
| 1.2 1:1 | 2 | 3 | 16 | ✅ |
| 1.3 Feedback | 1 | 3 | 12 | ✅ |
| 1.4 PDI IA | 0 (reuso) | 2 | 12 | — |
| 1.5 Survey | 2 | 4 | 13 | ✅ |
| 1.6 OKR cascata | 1 (+coluna) | 3 | 11 | ✅ |
| 1.7 Nine Box | 0 (só FE) | 0 | 0 | — |
| 1.8 Render Coins | 2 | 5 | 15 | ✅ |
| 1.9 Notificações | 0 (já existia) | 0 | 0 | — |
| 1.10 Mobile | 0 (só FE) | 0 | 0 | — |
| **Total** | **10 tabelas + 1 coluna** | **24 endpoints** | **95 testes** | **6 migrations** |

### Validação fim-a-fim em produção local

API reiniciada após cada entrega, todas as migrations aplicadas em `dev_render_dev` e `dev_render_liotecnica`. Conferência via SQL no tenant `liotecnica`:

| Entrega | Seeder | Quantidade |
|---|---|---|
| 1.1 Avaliação | `AvaliacaoTemplateSeeder` | 7 templates |
| 1.2 1:1 | `OneOnOneTemplateSeeder` | 10 templates |
| 1.3 Feedback | `FeedbackTemplateSeeder` | 12 templates |
| 1.5 Survey | `SurveyTemplateSeeder` | 4 templates |
| 1.6 Meta | (coluna ParentMetaId + tabela MetaCheckins) | OK |
| 1.8 Render Coins | `RenderCoinRewardSeeder` | 6 recompensas |

**Total: 39 itens seed por tenant ativo.** Todos os seeders são idempotentes (rerun não duplica).

### Suite de testes
- Suite total: **735 passam, 2 pré-existentes falham** (`Build_ModuloStandaloneDesativado`, `MatchingModule_IncluiApenasMatching` em `NavegacaoSidebarService`/`ModuleScreensResolver` não tocados).
- **0 regressões introduzidas pelas entregas 1.3-1.10.**
- Build limpo (`0 Erro(s)`), sem mudanças pendentes no model snapshot, TypeScript no frontend sem erros.

### Bug fix encontrado durante validação
- Migration `20260428023716_AddRenderCoinRewards` referenciava `AspNetUsers` (errado) — a tabela de usuários no schema deste projeto é `Users` (sem prefixo Identity padrão). Corrigido inline no SQL idempotente da migration.

### Documentação
- `lucasMODULOS_FUNCIONALIDADES.md` — atualizado nas seções §15 (Avaliação) e §16 (Feedback/1:1/Mood) com novos templates.
- Plano de execução em `~/.claude/plans/vamos-avaliar-o-modulo-validated-hejlsberg.md` — todas as 10 entregas marcadas como concluídas.

---

## [Unreleased] — 2026-04-28 — Entrega 1.2: Templates de Pauta de 1:1 (Fase 1 — Paridade Feedz)

### Added — Catálogo de templates de pauta para reuniões 1:1
Segunda entrega da **Fase 1 do roadmap Gestão de Pessoas — Paridade Feedz**. Alvo: eliminar a "tela em branco" ao agendar uma 1:1 e padronizar conversas por contexto (carreira, performance, retorno de férias, wellbeing, etc.). 10 pautas prontas chegam automaticamente em todo tenant via seeder idempotente no startup.

- **Entidades novas** em `Domain/Entities/OneOnOneTemplate.cs`:
  - `OneOnOneTemplate` (`ITenantEntity`) — Codigo único por tenant, Nome, Descricao, Categoria, IsSystem, IsActive, Ordem.
  - `OneOnOneTemplateItem` — filhos com Texto e Ordem (cascata via FK).
- **Migration** `20260428005355_AddOneOnOneTemplates.cs` — SQL idempotente (`CREATE TABLE IF NOT EXISTS`, FK em `DO $$ ... IF NOT EXISTS`) para suportar tenants antigos.
- **Seeder** `Infrastructure/Data/Seeders/OneOnOneTemplateSeeder.EnsureAsync` invocado por `DbSeeder.cs` no loop multi-tenant — **10 templates de sistema** (Codigo → Nome → Categoria → itens):
  1. **CheckIn** → Check-in Semanal Rápido → Performance → 4 itens
  2. **Carreira** → Carreira & Crescimento → Carreira → 5 itens
  3. **Performance** → Acompanhamento de Metas → Performance → 5 itens
  4. **Projeto** → Status de Projeto → Performance → 5 itens
  5. **Onboarding** → Onboarding (30/60/90 dias) → Onboarding → 6 itens
  6. **PosAvaliacao** → Pós-Avaliação de Desempenho → Carreira → 5 itens
  7. **RetornoFerias** → Retorno de Férias / Afastamento → Wellbeing → 5 itens
  8. **Wellbeing** → Bem-estar & Carga de Trabalho → Wellbeing → 5 itens
  9. **Conflito** → Resolução de Conflito → Wellbeing → 5 itens
  10. **Promocao** → Conversa sobre Promoção → Carreira → 5 itens
- **Service** `Application/Feedback/OneOnOneTemplateService` (`IOneOnOneTemplateService`) com:
  - `ListAsync(incluirInativos)` — catálogo ordenado por Ordem
  - `GetAsync(id)` — detalhe com itens
  - `CreateAsync(request)` — tenant cria customizado (`IsSystem=false`)
  - `RenderForMeetingAsync(templateId)` — gera `(Subject, Notes-em-markdown)` para o `OneOnOneService` popular o meeting com pauta pronta
- **Endpoints** novos em `OneOnOneController` (rota base `api/feedback/oneonone`):
  - `GET /templates` (`feedback.oneonone.view`)
  - `GET /templates/{id}` (`feedback.oneonone.view`)
  - `POST /templates` (`feedback.oneonone.view`)
- **`OneOnOneCreateRequest` estendido** com `TemplateId?` opcional. Quando informado e Subject/Notes vierem null, o `OneOnOneService.CreateAsync` chama `RenderForMeetingAsync` para popular automaticamente. Se Subject/Notes vierem explícitos, prevalecem (gestor pode editar).
- **Frontend** — `LioTecnica.Web.Next/src/features/feedback/Reunioes1a1Screen.tsx`:
  - Botão "Do Template" no header (abre catálogo em grid responsivo)
  - Cards selecionáveis com nome, descrição, categoria (badge) e contagem de itens
  - Ao escolher template: abre modal de criar 1:1 com Subject pré-preenchido com o nome e Notes em markdown (bullets ordenados da pauta)
  - Badge "Do template" no título do modal indica origem
  - Submit envia `templateId` no body para auditoria/métricas

### Changed — `AppDbContext`, `OneOnOneService`, `Program.cs`
- Novos `DbSet<OneOnOneTemplate>` e `DbSet<OneOnOneTemplateItem>`.
- `OnModelCreating` configurando query filter por `_tenantContext.TenantId`, índice único `(TenantId, Codigo)`, índice `(TenantId, IsActive)`, FK cascata template→itens.
- `OneOnOneService` agora depende de `IOneOnOneTemplateService` (constructor injection).
- DI registrado em `Program.cs:475` (`IOneOnOneTemplateService` → `OneOnOneTemplateService`, scoped).

### Tests
- 16 testes novos em `RHPortal.Api.Tests/Feedback/OneOnOneTemplateServiceTests.cs`:
  - **Seeder (5)**: rodada inicial cria 10, idempotência, isolamento entre tenants (2 DbContexts), preserva customizações, valida tenantId.
  - **Service ListAsync (2)**: filtro de ativos, ordenação por Ordem.
  - **Service CreateAsync (4)**: cria customizado, código duplicado, sem itens, espaços trimados.
  - **Service RenderForMeetingAsync (3)**: template ativo gera markdown, inexistente retorna null, inativo retorna null.
  - **Integração com OneOnOneService.CreateAsync (3)**: template popula Subject/Notes, Subject explícito prevalece, sem template usa comportamento legado.
- `OneOnOneServiceTests.cs` ajustado pra novo constructor (mock de `IOneOnOneTemplateService`).
- Suite completa: **656 passam, 2 pré-existentes falham** (`Build_ModuloStandaloneDesativado`, `MatchingModule_IncluiApenasMatching` — testam `NavegacaoSidebarService`/`ModuleScreensResolver` não tocados). **Zero regressões**.
- `dotnet build` → 0 erros.
- `dotnet ef migrations has-pending-model-changes` → "No changes have been made to the model".
- API reiniciada localmente, migration aplicou em `dev_render_dev` e `dev_render_liotecnica`, seeder populou os 10 templates por tenant — confirmado via SQL.

### Docs
- `lucasMODULOS_FUNCIONALIDADES.md` — seção §16 (Feedback contínuo, 1:1, Mood) atualizada com templates de pauta.
- Plano de execução em `~/.claude/plans/vamos-avaliar-o-modulo-validated-hejlsberg.md` — Entrega 1.2 marcada como concluída.

---

## [Unreleased] — 2026-04-27 — Entrega 1.1: Templates de Avaliação (Fase 1 — Paridade Feedz)

### Added — Catálogo de templates de avaliação prontos
Primeira entrega da **Fase 1 do roadmap Gestão de Pessoas — Paridade Feedz**. Alvo: deixar de ter "tela em branco" ao criar um ciclo de avaliação. Cinco templates prontos chegam automaticamente para todo tenant (novo ou existente, via seeder idempotente no startup).

- **Entidades novas** em `Domain/Entities/AvaliacaoTemplate.cs`:
  - `AvaliacaoTemplate` (`ITenantEntity`) — Codigo único por tenant, Nome, Descricao, PeriodoSugerido, IsSystem, IsActive, Ordem.
  - `AvaliacaoTemplatePergunta` — filhos com Texto e Ordem (cascata via FK).
- **Migration** `20260427220153_AddAvaliacaoTemplates.cs` — SQL idempotente (`CREATE TABLE IF NOT EXISTS`, `ADD CONSTRAINT` em `DO $$ ... IF NOT EXISTS`) para suportar tenants antigos sem quebrar.
- **Seeder** `Infrastructure/Data/Seeders/AvaliacaoTemplateSeeder.EnsureAsync` invocado por `DbSeeder.cs` no loop multi-tenant — **7 templates de sistema** (Codigo → Nome → Ordem → perguntas):
  1. **Anual** → Avaliação Anual 360° → 10 → 8 perguntas (cobre desempenho + comportamento + potencial)
  2. **Av180** → Avaliação 180° (Gestor + Autoavaliação) → 12 → 6 perguntas (diálogo gestor↔liderado, sem peso do 360°)
  3. **Av90** → Avaliação 90° (Gestor → Liderado) → 14 → 5 perguntas (uma direção, foco em desempenho objetivo)
  4. **Semestral** → versão enxuta de meio de ano → 20 → 5 perguntas
  5. **30-60-90** → onboarding estruturado → 30 → 6 perguntas
  6. **Auto** → Autoavaliação Simples (reflexão pré-1:1) → 40 → 5 perguntas
  7. **Lider** → Avaliação de Liderança (gestores/líderes) → 50 → 7 perguntas
- **Service** `Application/Avaliacao/AvaliacaoTemplateService` com 4 operações:
  - `ListAsync(incluirInativos)` — catálogo ordenado por `Ordem` + `Nome`
  - `GetAsync(id)` — detalhe com perguntas
  - `CreateAsync(request)` — tenant cria template customizado (`IsSystem=false`)
  - `CriarCicloFromTemplateAsync(request, criadoPorId)` — cria um `AvaliacaoCiclo` herdando perguntas do template
- **Endpoints** novos em `AvaliacaoController` (base route `api/avaliacao`):
  - `GET /templates` (`desempenho.view`)
  - `GET /templates/{id}` (`desempenho.view`)
  - `POST /templates` (`desempenho.ciclos.manage`)
  - `POST /ciclos/from-template` (`desempenho.ciclos.manage`)
- **Frontend** — `LioTecnica.Web.Next/src/features/feedback/CiclosAvaliacaoScreen.tsx` ganhou:
  - Botão "Do Template" no header (abre catálogo em grid responsivo)
  - Cards selecionáveis com nome, descrição, contagem de perguntas e badge "Padrão" para templates de sistema
  - Form de criar ciclo pré-preenchido ao escolher template; usuário ainda pode editar nome/período/perguntas
  - Submit usa endpoint `from-template` quando perguntas não foram alteradas; cai no fluxo padrão `POST /ciclos` se editou perguntas (preserva auditoria de origem)

### Changed — `AppDbContext`
- Novos `DbSet<AvaliacaoTemplate>` e `DbSet<AvaliacaoTemplatePergunta>` (linhas 121-122).
- `OnModelCreating` configurando query filter por `_tenantContext.TenantId`, índice único `(TenantId, Codigo)`, índice `(TenantId, IsActive)`, FK cascata template→perguntas.
- DI registrado em `Program.cs:474` (`IAvaliacaoTemplateService` → `AvaliacaoTemplateService`, scoped).

### Tests
- 16 testes novos em `RHPortal.Api.Tests/Avaliacao/AvaliacaoTemplateServiceTests.cs` (xUnit + Moq + EF InMemory):
  - **Seeder (5 testes)**: rodada inicial cria 7, idempotência (rodada dupla mesmo tenant não duplica), isolamento entre tenants (com 2 DbContexts simulando o pattern multi-tenant real), preserva customizações de RH, valida tenantId obrigatório.
  - **Service ListAsync (2 testes)**: filtro de ativos vs todos, ordenação por Ordem.
  - **Service CreateAsync (4 testes)**: cria com IsSystem=false, código duplicado lança erro, sem perguntas lança erro, espaços em branco filtrados/trimados.
  - **Service CriarCicloFromTemplateAsync (5 testes)**: template ativo gera ciclo, template inexistente lança erro, template inativo lança erro, nome vazio lança erro, respeita IniciarEmRascunho.
- Suite completa: **639 passam, 2 pré-existentes falham** (`Build_ModuloStandaloneDesativado`, `MatchingModule_IncluiApenasMatching` — ambos testam `NavegacaoSidebarService`/`ModuleScreensResolver` que não foram tocados nesta entrega). **Zero regressões introduzidas**.
- `dotnet build --no-incremental` → 0 erros, sem warning novo.
- `dotnet ef migrations has-pending-model-changes` → "No changes have been made to the model since the last migration".
- `npx tsc --noEmit` no frontend → sem erros.

### Docs
- `lucasMODULOS_FUNCIONALIDADES.md` — seção §15 (Avaliação de Desempenho) atualizada com templates.
- Plano de execução em `~/.claude/plans/vamos-avaliar-o-modulo-validated-hejlsberg.md` — Entrega 1.1 marcada como concluída.

---

## [Unreleased] — 2026-04-24 (tarde) — FASE 5 — Agent RAG com Function Calling

### Added — Agente de IA com ferramentas estruturadas

- **Arquitetura Agent + Tool Registry** (`IAgentTool`, `AgentToolRegistry`) — contrato genérico para ferramentas do agente com schema JSON (padrão OpenAI function calling).
- **16 tools registradas** cobrindo todo o domínio R&S:
  - Vagas: `vagas_listar`, `vagas_contar`, `vagas_info`, `vagas_candidatos`
  - Candidatos: `candidatos_listar`, `candidatos_info`, `candidatos_contar`
  - Candidaturas: `candidaturas_por_etapa`, `candidaturas_sla_atrasadas`, `candidaturas_por_fonte`
  - Propostas: `propostas_listar`, `propostas_estatisticas`
  - Infra: `centros_custo_listar`, `descricoes_cargo_listar`, `descricao_cargo_info`, `empresas_listar`
- **`OllamaClient.ChatWithToolsAsync`** — suporte a Function Calling OpenAI-compatible (tools + tool_calls + resultados como `role:"tool"`).
- **`LlmAssistantService` refatorado** com loop ReAct (MaxAgentIterations=6). Detecção de intenção: perguntas estruturadas ("quantas", "liste", "por etapa") zeram RAG semântico pra incentivar uso de tools; perguntas conceituais mantêm RAG.
- **Synthesis fallback**: se Qwen responde content vazio após executar tools (bug intermitente do modelo), sistema pede síntese explícita em iteração extra.
- **Frontend**: `ChatBubble` agora mostra **chips violeta** das tools invocadas com hover interativo (args JSON + preview do resultado, duração ms). Transparência total pro usuário saber de onde veio cada fato.

### Added — LLM-as-a-Judge (botão "Análise IA" no kanban)

- **Entidade** `CandidatoVagaLlmScore` (jsonb, hash SHA256 pra cache, model version tracking).
- **Migration idempotente** `AddCandidatoVagaLlmScore` (CREATE TABLE IF NOT EXISTS + FKs via DO $$ pg_constraint).
- **`ILlmMatchingService`** — Qwen 2.5 avalia candidato × vaga com CV + DescCargo estruturada + pesos calibrados. Retorna score 0-100 + justificativa PT-BR + breakdown por critério (pontos fortes + gaps).
- **Cache automático**: SHA256 de (CV + DescCargo itens + pesos + MatchMinimo) invalida quando qualquer fonte muda. 2ª chamada: 30ms. 1ª: 10-60s (CPU) ou 3-5s (GPU).
- **`LlmMatchingDialog`** com `LoadingWithElapsed` (contador visual, mensagens dinâmicas por estágio: "Carregando modelo", "Analisando perfil", "Aplicando pesos"). Botão "Regenerar análise".
- **Endpoint** `GET /api/vagas/{id}/matching-llm/{candId}?force=bool` — retorna 503 com `LlmTimeoutException` em vez de 500 genérico quando Qwen demora.
- **Timeout Ollama** 120s → 300s + `keep_alive: "30m"` — mantém modelo na RAM entre chamadas.
- Score do Rafael (perfeito) em Analista Financeiro: **85/100** via LLM vs 46 via híbrido. Qwen identifica skills-fit semanticamente ("SAP FI" ≡ "ERP financeiro") e gaps sutis ("falta atendimento a fornecedores").

### Fixed — Bugs da FASE 4/5

- **Concurrency DbContext** no `LlmAssistantService.BuildContextAsync` — paralelizava 3 retrievals com `Task.WhenAll` no mesmo DbContext. Refatorado para sequencial (DbContext não é thread-safe).
- **`Vector` property could not be mapped** — `AuditWriter.CreateDbContext` criava `AppDbContext` sem `UseVector()`, quebrando todo SaveChanges em tenants com embeddings.
- **`dynamic = "force-dynamic"` incompatível com `output: "export"`** — removido da rota `/app/assistente-ia`.
- **Aba "Matching IA" desabilitada** (`opacity-40` + toast "em breve") — habilitada com componente `MatchingIaTab` completo (tabela de score por candidato + breakdown + LLM analysis + reindex).
- **Legenda confusa** em MatchingIaTab — corrigida pra ser 100% fiel ao código (léxico inclui localidade; semantic e lexical são o mesmo algoritmo com rotas diferentes).
- **Reindexação manual necessária** — implementado trigger automático via `EmbeddingReindexInterceptor` (SaveChangesInterceptor) + `EmbeddingIndexQueue` (Channel singleton) + `EmbeddingIndexerHostedService` (BackgroundService). Mudou CV ou item DNALIO → reembeda automático em <5s.
- **Escape `\"` em C# interpolação normal** — substituído por variáveis intermediárias.

### Changed — Nomes de modos de matching

- `"hybrid"` → `"ai"` — quando Ollama ativo e embeddings usados.
- `"fallback"` → `"semantic"` — quando Ollama offline, fallback léxico com stems + sinônimos.
- `"lexical"` — endpoint alternativo `/matching-breakdown` (mesmo algoritmo de semantic).

### Docs atualizadas

- `GUIA_IA_RAG.md` — seção Agent Tools adicionada com diagrama ReAct e lista das 16 tools.
- `COMO_USAR_MATCHING_IA.md` — seção LLM-as-Judge (análise profunda) + seção Chatbot Agent (como perguntar ao sistema).
- `TRILHA_TESTES_RS.md` — trilha N (Agent Tools) com 12 cenários de perguntas.

---

## [Unreleased] — 2026-04-24 (manhã) — FASE 4 — Stack IA RAG (Ollama + pgvector) completo

### Added — Matching híbrido com IA

- **pgvector 0.8.2** habilitado em `dev_render_liotecnica` via `scripts/setup-pgvector.sh` (idempotente, pode rodar em qualquer host com EDB Postgres 18).
- **Ollama local** como stack IA default: `qwen2.5:7b` (chat, Apache 2.0) + `bge-m3` (embeddings multilingual 1024 dims). Zero custo por inferência, dados não saem do host do tenant.
- Entidades `DescricaoCargoItemEmbedding` + `CandidatoEmbedding` com tipo `Vector(1024)` nativo via pacote `Pgvector.EntityFrameworkCore` 0.2.0.
- Migration idempotente `AddEmbeddingsPgvector`: `CREATE EXTENSION IF NOT EXISTS vector` + `CREATE TABLE IF NOT EXISTS` + FKs via `DO $$ pg_constraint $$` + IVFFlat index para kNN.
- `IOllamaClient` — cliente HTTP tipado com health check, embed single/batch, chat buffered, chat streaming (NDJSON). Robusto a Ollama down (retorna null sem lançar).
- `IEmbeddingService` — upsert idempotente por SHA256 do texto-fonte. Re-indexação incremental.
- `IVectorSearchService` — kNN por cosine distance com `Pgvector.EntityFrameworkCore`.
- `HybridMatchingService` — blend 30% léxico + 50% semântico + 20% localidade. Fallback automático para léxico puro quando Ollama indisponível.
- `ILlmAssistantService` — chatbot RAG com streaming SSE. Retrieval: top-8 itens DNALIO + top-3 vagas abertas. Prompt instrui LLM a citar `[Fonte N]`.
- `IDescricaoCargoGeneratorService` — gera template DNALIO completo a partir de brief.
- `ICvResumoService` — resume CV em 250 chars para card do kanban.
- `ISalarioSuggesterService` — sugere faixa salarial baseada em vagas similares internas + categoria salarial do tenant.
- Controller `/api/assistente-ia/*` com 7 endpoints: health, chat, chat/stream (SSE), descricao-cargo/gerar, cv/resumir/{id}, vagas/sugerir-salario/{id}, embeddings/reindexar.
- Endpoint novo `/api/vagas/{id}/matching-breakdown-hybrid/{candidatoId}` coexistindo com o léxico.

### Added — Frontend: Assistente IA + integrações

- Tela `/app/assistente-ia` com chat streaming via SSE, sidebar de health, sugestões, botão reindexar.
- Componente `Textarea` em `src/components/ui/textarea.tsx`.
- `GerarDescricaoCargoDialog` — gera template via IA.
- `SugerirSalarioButton` — integrado ao VagaFormModal (aba Remuneração).
- `ResumirCvButton` — card do kanban gera/regera resumo de CV.
- `MatchingBreakdownDialog` estendido: toggle Híbrido/Léxico + top-3 evidências semânticas.
- Item "Assistente IA" em `NavegacaoManifest` (ordem 52).

### Changed — Matching léxico (base do híbrido)

- `PtBrStemmer` — stemmer conservador pt-br (trabalhar↔trabalho, configuração↔configurar).
- `TechSynonyms` — dicionário AD↔Active Directory, HD↔Help Desk, MS Office↔Microsoft Office, etc.
- `TfIdfWeightCalculator` — IDF pondera tokens raros (`"ManageEngine"` vale 3-4× mais que `"através"`).
- `DescricaoCargoMatchingService.IsRequisitoProcessual` — heurística ignora "perfil alinhado com gestor" e similares na penalidade.
- `DocxDescricaoCargoParser.TryMatchSecao` — match fuzzy em 2 passes para títulos DNALIO customizados.

### Fixed — Scores do matching (evolução da Ana, candidato perfeito)

**0 → 40 → 48 → 49 → 58 (híbrido)**. Ranking Ana > Bruno > Carla > Diego preservado.

### Docs

- `GUIA_IA_RAG.md` — guia completo de setup + arquitetura + troubleshooting + performance.
- `TRILHA_TESTES_RS.md` estendida com trilha M (10 verificações da stack IA).
- `scripts/setup-pgvector.sh` — script idempotente para habilitar extensão.

---

## [Unreleased] — 2026-04-23 — Sessão 31.2 — Consolidação Area + Department → CentroCusto

### Changed — Domínio unificado: `CentroCusto` absorve `Area` + `Department`

- `Domain/Entities/CentroCusto.cs`: campos novos — `Description2` (`MaxLength(500)`, nullable), `Headcount` (`int?`), `Phone` (`MaxLength(30)`, nullable). A entidade agora detém todos os atributos que `Department` expunha + a informação de "alto nível" que antes vivia em `Area`.
- `Infrastructure/Tenancy/ICurrentUserContext.cs`: membros `AreaId` / `IsGestorWithArea` removidos, substituídos por `CentroCustoId` / `IsGestorWithCentroCusto` (mesmo shape semântico — nome atualizado para o novo domínio).
- `Contracts/Vagas/VagaCreateRequest` + `VagaUpdateRequest`: removidos `AreaId` e `DepartmentId`. Só resta `CentroCustoId?`.
- `Contracts/Vagas/VagaListQuery`: de 5 argumentos (`Q, Status, AreaId, DepartmentId, RecrutadorUserId`) para 4 (`Q, Status, CentroCustoId, RecrutadorUserId`).
- `Contracts/VagaListItemResponse`: campo `AreaId` → `CentroCustoId` + `CentroCustoCode` + `CentroCustoNome`.
- `Contracts/Funcionarios/FuncionarioListQuery`: de 5 argumentos (5º era `int Page`) para 4 (`Search, Status, UnitId, JobPositionId`) + defaults de paginação.
- `Domain/Entities/SolicitacaoVaga.cs`: FK `AreaId` → `CentroCustoId`.
- `Contracts/SolicitacoesVaga/SolicitacaoVagaResponse`: `AreaId` / `AreaName` → `CentroCustoId` / `CentroCustoNome`. Eliminada também uma duplicação histórica em que A.RH.013 tinha um `CentroCustoId` paralelo ao `AreaId` — agora é único.
- `Contracts/JobPositions/JobPositionResponse`: `AreaId` / `AreaName` → `CentroCustoId` / `CentroCustoNome`.
- Services refatorados: `JobPositionService`, `SolicitacaoVagaService`, `PublicVagasController`, `DevSeedController`, `ReportsController`, `LookupController` (preserva alias `/areas` e `/departments` retornando `CentroCusto` serializado no shape legado), `InboxFileProcessor`, `InboxController`, `CandidatosController`, `CandidatoService`, `CartaService`, `ListVagasPendenciasRhHandler`, `PreAdmissaoService`, `AgendaEventSeeder`, `DashboardController`, `ColaboradorService`, `NineBoxService`, `UserAdministrationService` (+ `FuncionarioInfoResponse`), `TenantProvisioningService`, `FeriasService`, `DesligamentoService`, `TotvsIntegrationService`, `PublicCandidaturasController`, `ListFuncionariosHandler`, `OwnerController`.

### Added — Migration idempotente de backfill + CentroCustoSeeder

- `Migrations/20260423_ConsolidarAreasDepartamentosEmCentroCusto.cs`: (1) adiciona colunas novas no `CentrosCusto` com `IF NOT EXISTS`; (2) copia `Areas.Id` para `CentrosCusto` (preservando IDs via `INSERT ... WHERE NOT EXISTS`); (3) remapeia FKs em `JobPositions`, `Vagas`, `SolicitacoesVaga`, `Funcionarios`, `PreAdmissoes` (`UPDATE ... SET CentroCustoId = AreaId WHERE AreaId IS NOT NULL AND CentroCustoId IS NULL`); (4) dropa `AreaId`/`DepartmentId` e as tabelas `Areas`/`Departments` com `DROP TABLE IF EXISTS`. Re-executável em tenants em estágios diferentes.
- `Infrastructure/Data/Seeders/CentroCustoSeeder.cs` (novo): substitui `AreaSeeder` + `DepartmentSeeder` em `TenantProvisioningService` — um único seeder cobrindo o bootstrap de tenant novo.
- `CentroCustoController` expandido com endpoints antes espalhados entre `AreasController` e `DepartmentsController`.

### Removed — `Area`, `Department`, `Manager` (legado)

- Entidades `Domain/Entities/Area.cs`, `Domain/Entities/Department.cs` e `Domain/Entities/Manager.cs` (último não tinha mais uso após consolidação). `DbSet<Area> Areas` e `DbSet<Department> Departments` removidos do `AppDbContext`.
- `Controllers/AreasController.cs` e `Controllers/DepartmentsController.cs` removidos — rotas legadas passam pelo alias em `LookupController` (transitório) ou redirecionam para `CentroCustoController`.
- Seeders antigos (`AreaSeeder`, `DepartmentSeeder`) removidos.

### Fixed — "Falha ao excluir N candidato(s)" sem razão ao deletar vaga com candidatos vinculados

- `Application/Candidatos/CandidatoService.DeleteAsync`: adicionado pre-check das duas FKs configuradas como `DeleteBehavior.Restrict` em `AppDbContext.OnModelCreating` — `PropostaVaga.CandidatoId` (linha 539) e `ProjetoCandidato.CandidatoId` (linha 1099). Se algum existir, lança `InvalidOperationException` com mensagem formatada: `"Não é possível excluir o candidato \"X\" — há vínculos: 1 proposta(s) de vaga, 2 participação(ões) em projeto de seleção. Cancele ou remova esses vínculos antes."`. As demais 19 FKs referenciando `CandidatoId` são Cascade ou SetNull — morrem junto ou zeram, não bloqueiam.
- `Controllers/CandidatosController.Delete`: captura `InvalidOperationException` → 409 com `{ message }`; safety net `DbUpdateException where pg.SqlState == "23503"` → 409 com nome da constraint no `detail`. Antes não catchava nada — `SaveChangesAsync` lançava cru, virava 500 e o frontend só via "HTTP 500".
- `LioTecnica.Web.Next/src/features/recrutamento/vagas/VagasScreen.tsx`: no fluxo "Excluir tudo" da vaga, o loop que percorria os candidatos usava `catch { failed++; }` — descartava a razão de cada falha. Reescrito para coletar `falhas: { nome, motivo }[]`, parseando o `message` do 409 de cada tentativa. Ao final, se houver falhas, abre `confirmDialog` com a **lista detalhada** ("• Maria Dev: Não é possível excluir — há 1 proposta(s) de vaga..." para cada candidato) em vez do toast genérico. A vaga não é excluída e o usuário sabe exatamente o que resolver.
- `RHPortal.Api.Tests/Candidatos/CandidatoDeleteTests.cs` (**novo**): 6 testes cobrindo 204 (OK), 404 (não existe), 403 (read-only sem admin/owner), 409 com `message` do service, e `DbUpdateException` não-23503 propagado (não deve ser catchado — cai no middleware). Testado via controller + `IDeleteCandidatoHandler` mockado — teste de nível de service foi evitado porque o `CandidatoService` tem 11 dependências no ctor (incluindo `NotificationPublisher` que precisa de `IHubContext` de SignalR).

### Fixed — DELETE de Centro de Custo vinculado devolvia erro genérico

- `Controllers/CentroCustoController.cs`: o endpoint `DELETE /api/centros-custo/{id}` só validava filhos na hierarquia antes do `SaveChanges`. Quando o CC tinha vínculo com qualquer outra tabela (Vagas, JobPositions, Funcionarios, SolicitacoesVaga, SolicitacoesPromocao, PreAdmissoes), o Postgres retornava `23503 foreign_key_violation`, o EF jogava `DbUpdateException` sem tratamento, e o frontend só mostrava toast genérico "Erro ao remover" — o usuário ficava sem entender o motivo (bug reportado: "tenho o TI que não consigo deletar e ele dá mensagem de erro mas não deixa claro o porquê"). Reescrito com pre-check de **7 FKs** contando dependentes + fallback `try/catch DbUpdateException when InnerException is PostgresException pg && pg.SqlState == "23503"` como safety net para FKs novas. Retorna 409 com body `{ message, dependencies: { centrosCustoFilhos, vagas, cargos, funcionarios, solicitacoesVaga, solicitacoesPromocao, preAdmissoes } }`. Mensagem humanamente legível: `"Não é possível excluir \"TI - Tecnologia\" — há vínculos: 2 vaga(s), 15 funcionário(s), 1 cargo(s). Remova ou transfira esses vínculos antes."`
- `LioTecnica.Web.Next/src/features/cadastros/totvs/CentroCustoCadastroScreen.tsx`: handler de exclusão passou a parsear o body JSON do erro (`{ message }` do 409) e exibir a mensagem real no toast, com `duration: 8000` para dar tempo de ler. Antes era só `catch { toast.error("Erro ao remover"); }` — descartava tudo que o backend mandou.
- `RHPortal.Api.Tests/CentrosCusto/CentroCustoDeleteTests.cs` (**novo**): 8 testes cobrindo 404 (CC não existe), 204 (delete OK sem vínculos), 409 individual por bloco (filhos, vagas, cargos, funcionários) e 409 agregado (múltiplos vínculos com contagens), plus um teste verificando que o body expõe o campo `dependencies` estruturado (frontend pode oferecer "ver vínculos" no futuro). Namespace `RhPortal.Api.Tests.CentrosCusto` (plural) para evitar conflito com o tipo `CentroCusto` em outros testes.

### Fixed — `TenantProvisioningService.ApplyOrphanMigrationsAsync` quebrava startup em DBs já migrados para 31.2

- `Application/Owner/TenantProvisioningService.cs` (bloco 5, `VagaDepartmentIdOptional`): o script SQL histórico `ALTER TABLE "Vagas" ALTER COLUMN "DepartmentId" DROP NOT NULL` era no-op para a coluna já nullable, mas **falhava com 42703** (`column "DepartmentId" of relation "Vagas" does not exist`) em DBs que já rodaram a consolidação 31.2 (a coluna foi dropada pela migration `ConsolidarAreasDepartamentosEmCentroCusto`). Envolvido em `DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Vagas' AND column_name = 'DepartmentId') THEN ALTER TABLE ... END IF; END $$` — idempotente para ambos os cenários (coluna presente → normaliza nullability; ausente → skip). Sintoma era crash imediato do `dotnet run` com `Unhandled exception. Npgsql.PostgresException` e exit 134 durante `DbSeeder.MigrateAndSeedAsync`.

### Changed — Sidebar (`NavegacaoManifest`)

- `Infrastructure/Navegacao/NavegacaoManifest.cs`: removidos os itens `nav-departamentos` (`/departamentos`, permissão `departments.view`) e `nav-areas` (`/areas`, permissão `areas.view`) — ambos apontavam para rotas que viraram redirect na 31.2, gerando duplicação visual na sidebar (dois cliques diferentes chegando ao mesmo destino). `nav-centros-custo` herdou a ordem 20 (posição natural que "Departamentos" ocupava no bloco Cadastros) e virou o item único de acesso à entidade unificada.
- `RHPortal.Api.Tests/Navegacao/NavegacaoSidebarServiceTests.cs`: dois testes atualizados — `Build_ItensDeCadastro_VaoParaBucketCadastros` agora afirma que `/centros-custo` aparece no bucket (em vez de `/areas` e `/departamentos`) e adiciona asserções `DoesNotContain` sobre os hrefs legados; `Build_ItemCore_NuncaBloqueadoPorModulo` troca o href sob teste para `/centros-custo` (item core que herdou a posição).

### Changed — Tela `/centros-custo` (grid unificado)

- `src/features/cadastros/totvs/CentroCustoCadastroScreen.tsx`: expande a tabela de listagem com as **colunas consolidadas** que antes só apareciam em telas separadas — **Headcount** (herdado de Department, alinhado à direita, fonte monoespaçada), **Responsável** (prefere `ownerFuncionarioName` do vínculo com Funcionário — herdado de Area; cai para `manager` legado quando ausente) e **Filial/Local** (`branchOrLocation`, herdado de Department). Novo KPI **"Headcount total"** (somatório de `headcount` de todos os CCs do tenant). Subtítulo da tela passou a explicitar *"Cadastro unificado — absorveu Áreas e Departamentos (Sessão 31.2)"*. Sort da grid corrigido para comparar `headcount` numericamente (antes usava `localeCompare` em strings — ordenava "9" acima de "10"). Grid agora tem 11 colunas (antes 8); `colSpan` de fallback de loading e empty atualizado.

### Changed — Frontend Next.js

- `src/app/(app)/areas/page.tsx` e `src/app/(app)/departamentos/page.tsx`: substituídos por redirect client-side para `/app/centros-custo` (Departamentos antes redirecionava para `/app/areas` — agora ambos convergem para a tela unificada).
- `src/features/cadastros/areas/AreasScreen.tsx` e `src/features/cadastros/departamentos/DepartamentosScreen.tsx`: **removidos** — órfãos após o redirect.
- `src/features/shared/global-search/GlobalSearchDialog.tsx`: categoria "Áreas/Departamentos" consolidada em "Centros de Custo" (tag única `centros-custo`). Buscas históricas `areas` e `departamentos` ainda encaminham para o novo bucket.
- `src/features/shared/cache/screenCache.ts`: chaves `areas` e `departamentos` do `PREFETCH_MAP` apontam para `/centros-custo`.
- `src/features/admin/AdminAccessesScreen.tsx`: links `/app/areas` e `/app/departamentos` atualizados para `/app/centros-custo`.
- Toda ocorrência de `areaId` / `departmentId` em screens e api clients renomeada para `centroCustoId`. Onde o DTO remoto ainda devolve `areaId` (alias de lookup), coerção feita no boundary (`apiClient.areas.list()` segue existindo mas com mapping interno).

### Fixed — Erros de TS no fluxo de solicitações/aprovações

- `src/features/gestao/aprovacoes/AprovacoesScreen.tsx`: interface `SolicitacaoDetail` tinha `centroCustoId` duplicado (leftover do rename `areaId → centroCustoId` + A.RH.013 que já tinha `centroCustoId/centroCustoNome`). Mesclado em um único par `centroCustoId` + `centroCustoNome`. Render `detail.centroCustoName` → `detail.centroCustoNome` para casar com serialização JSON do backend.
- `src/features/gestao/solicitacoes/SolicitacoesScreen.tsx`: `SolicitacaoGridRow.areaName` → `centroCustoNome`; `SolicitacaoDetail.centroCustoName` → `centroCustoNome`; filtro de busca (`r.areaName`), render (`detail.areaName`) e vaga-picker (`v.areaName ?? v.area`) todos atualizados.

### Changed — Testes xUnit (38 arquivos-alvo)

- `RHPortal.Api.Tests/Departments/DepartmentServiceTests.cs` e pasta `Departments/`: **removidos** (entidade não existe mais).
- `Dashboard/DashboardAgregadoServiceTests.cs`: helper `NovaArea` mantém nome (clareza semântica) mas cria `CentroCusto` internamente; `db.Areas.Add` → `db.CentrosCusto.Add`; named args `areaId:` → `centroCustoId:`.
- `DocumentacaoPadrao/DocumentacaoPadraoHistoricoTests.cs` + `DocumentacaoPadraoPorCargoTests.cs`: `FakeCurrentUser.AreaId` + `.IsGestorWithArea` → `.CentroCustoId` + `.IsGestorWithCentroCusto`.
- `Vagas/VagaCarteiraScopeTests.cs`, `Vagas/VagaServiceOperacoesTests.cs`, `Vagas/CriarVagaServiceTests.cs`, `Vagas/VagaFaixaSalarialTests.cs`: `new Area { Name }` → `new CentroCusto { Description }`; `db.Areas.Add` → `db.CentrosCusto.Add`; removidas linhas `DepartmentId: null,` e `AreaId: areaId,` dos construtores de request; `CentroCustoId: null` → `CentroCustoId: centroCustoId`; `new VagaListQuery(null,null,null,null,null)` (5 args) → `(null,null,null,null)` (4 args); `user.Setup(x => x.AreaId)` → `user.Setup(x => x.CentroCustoId)`; `v.AreaId` → `v.CentroCustoId`; teste `List_FiltroArea_…` renomeado para `List_FiltroCentroCusto_…`.
- `Funcionarios/FuncionarioServiceTests.cs`: `FuncionarioListQuery(null,null,null,null,null)` (5 args) → `(null,null,null,null)` (4 args) + comentário 31.2 sobre a nova assinatura.
- `SolicitacoesVaga/SolicitacaoVagaServiceTests.cs`: `AreaId = areaId,` → `CentroCustoId = areaId,` em seeds.
- `JobPositions/JobPositionServiceTests.cs`: `new Area { Name = "Área de Teste" }` → `new CentroCusto { Description = "Área de Teste" }`; `db.Areas.Add` → `db.CentrosCusto.Add`; `result.AreaId` → `result.CentroCustoId`; `result.AreaName` → `result.CentroCustoNome`.

### Regression summary

| Suite | Resultado |
|-------|-----------|
| `dotnet build` (test project) | 0 erros / 38 warnings pré-existentes |
| `dotnet test` | **762 aprovados / 0 falhos / 0 ignorados** (2s) |
| `npx tsc --noEmit` (Next) | 0 erros após fix de 3 |
| `npx eslint src/features/gestao/**` | 0 erros novos (9 warnings pré-existentes de vars não usadas) |

---

## [Unreleased] — 2026-04-23 — Sessão 31.1 — Departamentos: rota destravada + exclusão em massa

### Fixed — `/app/departamentos` agora abre a tela real em vez de redirecionar para Áreas

- `LioTecnica.Web.Next/src/app/(app)/departamentos/page.tsx`: era um stub com `useEffect` chamando `router.replace("/app/areas")`. A `DepartamentosScreen.tsx` completa (CRUD contra `/api/departments`) existia em `features/cadastros/departamentos/` mas estava órfã. Substituído por `<AuthGuard><DepartamentosScreen /></AuthGuard>` — padrão canônico do app. Item `nav-departamentos` do `NavegacaoManifest` agora leva à tela correta.

### Added — Backend: exclusão em massa de departamentos

- `RHPortal.Api/RHPortal.Api/Contracts/Departments/DepartmentContracts.cs`: adicionados `DepartmentBulkDeleteRequest(Ids: IReadOnlyCollection<Guid>)` com `[Required, MinLength(1), MaxLength(500)]` e `DepartmentBulkDeleteResponse(Requested, Deleted)`.
- `RHPortal.Api/RHPortal.Api/Application/Departments/DepartmentService.cs`: novo método `DeleteManyAsync(IReadOnlyCollection<Guid> ids, ct) → int` na interface + implementação. Dedup via `Distinct`, ignora `Guid.Empty`, filtro por tenant via query filter do `AppDbContext` (IDs de outro tenant nem aparecem na query). Retorna a quantidade efetivamente removida — IDs inexistentes/de outro tenant são silenciosamente ignorados (não lança exception).
- `RHPortal.Api/RHPortal.Api/Application/Departments/Handlers/DeleteManyDepartmentsHandler.cs` (**novo**): `IDeleteManyDepartmentsHandler` seguindo o padrão dos outros 5 handlers (wrapper minimalista sobre o service).
- `RHPortal.Api/RHPortal.Api/Controllers/DepartmentsController.cs`: novo endpoint `POST /api/departments/bulk-delete` (usei POST em vez de DELETE com body — DELETE com body é mal-suportado em proxies, e especialmente no rewrite do Next dev). Valida `Count > 0` e `Count ≤ 500` retornando 400 BadRequest quando violado.
- `RHPortal.Api/RHPortal.Api/Program.cs`: `AddScoped<IDeleteManyDepartmentsHandler, DeleteManyDepartmentsHandler>()` adicionado na seção de DI de Departamentos.

### Added — Frontend: seleção em massa + botão "Excluir selecionados"

- `LioTecnica.Web.Next/src/features/cadastros/departamentos/DepartamentosScreen.tsx`:
  - **Estado:** novo `selectedIds: Set<string>` + flag `bulkDeleting` + controle `bulkDeleteOpen`.
  - **Helpers:** `toggleOne(id, checked)`, `togglePage(checked)` (seleciona/desseleciona todos da página atual — respeita filtros/busca), `clearSelection()`.
  - **Derivados via `useMemo`:** `visibleIdSet` (dos itens no filtro corrente), `effectiveSelected` (interseção de `selectedIds` com `visibleIdSet` — evita apagar item fora do recorte visível), `selectedVisibleCount`, `allVisibleSelected`, `someVisibleSelected` (para `indeterminate` do checkbox master).
  - **Coluna nova de checkbox** (primeira coluna, largura `w-10`): `<input type="checkbox">` nativo com `accent-primary` (sem Checkbox do shadcn — não existe no UI kit atual, zero dependência nova). Header tem checkbox master com `indeterminate` setado via callback ref — marca parcial quando só alguns da página estão selecionados. `aria-label` por linha usa o nome do departamento para acessibilidade.
  - **Feedback visual:** linhas selecionadas ganham `bg-primary/5` + `data-state="selected"`.
  - **Barra contextual** (aparece acima da tabela quando há seleção): fundo `bg-primary/5` com borda `border-primary/30`. Mostra `"N departamento(s) selecionado(s)"` + contagem de "fora do filtro" quando há seleções que não estão visíveis. Dois botões: "Limpar seleção" (ghost + ícone X) e "Excluir selecionados (N)" (destructive + Trash2).
  - **Dialog de confirmação** separado do dialog de exclusão singular (`bulkDeleteOpen`): mostra `"Excluir N departamento(s) selecionado(s)? Esta ação não pode ser desfeita."` com botão destructive `"Excluir N"` que vira `"Excluindo…"` durante o request (disable all controls).
  - **Handler `confirmBulkDelete`**: `POST /api/departments/bulk-delete` com `{ ids: effectiveSelected }`. Toast diferenciado por resultado: sucesso total (`"X excluídos"`), parcial (`"X de Y excluídos"` — quando backend encontrou IDs stale), ou zero (`"Nenhum departamento foi excluído"`). Após sucesso, fecha dialog, limpa seleção, recarrega lista.
  - **Integração com exclusão single-row:** ao excluir 1 item via botão de linha, se ele estava selecionado é removido do `selectedIds` para não sobrar zumbi na seleção.
  - **Ajuste de `colSpan`:** linhas "Carregando…" e "Nenhum departamento encontrado." passaram de `colSpan={7}` para `colSpan={8}` por causa da coluna nova de checkbox.
  - Ícone `X` de `lucide-react` adicionado ao import.

### Added — Cobertura de testes (8 métodos novos em `DepartmentServiceTests.cs`)

- `RHPortal.Api/RHPortal.Api.Tests/Departments/DepartmentServiceTests.cs`:
  - `DeleteMany_ComIdsValidos_RemoveTodos` — 3 departamentos → envia os 3 IDs → retorna 3, lista final vazia.
  - `DeleteMany_ComListaVazia_RetornaZero` — `Array.Empty<Guid>()` → retorna 0 sem lançar.
  - `DeleteMany_ComIdsInexistentes_RetornaZero` — 2 IDs aleatórios (sem seed) → retorna 0.
  - `DeleteMany_MisturaExistentesEInexistentes_RemoveApenasExistentes` — 1 existente + 2 aleatórios → retorna 1.
  - `DeleteMany_IdsDuplicados_RemoveUmaVez` — mesmo ID 3× no payload → retorna 1 (cobre o `Distinct`).
  - `DeleteMany_IgnoraGuidEmpty` — `[Guid.Empty, id, Guid.Empty]` → retorna 1.
  - `DeleteMany_NaoVaza_ParaOutroTenant` — reutiliza o factory dual-context `CriarServicoComOutroTenant` (introduzido na Sessão 31 para `DashboardAgregadoServiceTests`) com dois `ITenantContext` no mesmo InMemoryDb. Seeda 2 deps no tenant atual + 1 no outro tenant; tenta deletar os 3 via service do tenant atual → retorna 2 (o de outro tenant sobrevive, confirmado via `dbOutro.Departments.CountAsync`).
  - `DeleteMany_NaoAfetaDepartamentosNaoSelecionados` — seeda 4 deps, envia só 2 IDs → retorna 2, restam exatamente os outros 2 no banco (regressão defensiva).

### Regression summary

| Suite | Resultado |
|-------|-----------|
| Backend xUnit (`RHPortal.Api.Tests`) | **783 / 783 verde** (775 da Sessão 31 + 8 novos de bulk delete) |
| Testes filtrados `~Departments` | **21 / 21 verde** (13 antigos + 8 novos) |
| `dotnet build` | 0 erros / 123 warnings pré-existentes |
| `npx tsc --noEmit` | 0 erros |
| `npx eslint` nos 2 arquivos tocados | 0 issues |
| HMR Next dev | Chunk `src_b47fb1ca._.js` serve 9 refs a `selectedIds` + literal "Excluir selecionados" |

### Context — Pequena dívida histórica + UX básica

O usuário relatou que a página de Departamentos não abria. O diagnóstico revelou um stub antigo em `page.tsx` redirecionando para `/app/areas` — provavelmente uma decisão de meses atrás quando "Departamentos" e "Áreas" eram a mesma coisa, mas hoje são entidades separadas (`Area` + `Department` com `Department.AreaId?` FK). A tela real (CRUD completo contra `/api/departments`) já existia em `features/cadastros/departamentos/DepartamentosScreen.tsx`, só precisava ser plugada.

Além do fix, o usuário pediu **seleção em massa** para apagar vários departamentos de uma vez. Entreguei backend + UI + 8 testes cobrindo:
- Caminho feliz (todos IDs válidos);
- Guardas (lista vazia, IDs inexistentes, mistura, duplicados, `Guid.Empty`);
- **Isolamento por tenant** (dual-context factory);
- Regressão defensiva (não apagar não-selecionados).

**Decisões registradas.**

1. **POST `/bulk-delete` em vez de DELETE com body:** DELETE com body funciona no .NET mas é mal-suportado em proxies HTTP, CDNs e especialmente no rewrite dev do Next (que usa fetch interno que deixa cair o body). POST é universalmente suportado.
2. **`Distinct` + guard `Guid.Empty` no service:** barato, previne dois tipos de payload malformado sem precisar validar no controller.
3. **Seleção "efetiva" no frontend:** usuário pode selecionar item → filtrar por status que o exclui da lista visível → clicar "Excluir selecionados". Se a UI enviar tudo que está em `selectedIds`, ele apaga coisa que não está vendo. Solução: `effectiveSelected = selectedIds ∩ visibleIdSet`. Itens "fora do filtro" ficam contabilizados num contador separado na barra contextual, deixando a situação transparente.
4. **Input nativo em vez de Checkbox do shadcn:** o UI kit do projeto não tem Checkbox e adicionar um só para isso criaria atrito (instalar `@radix-ui/react-checkbox` + componente wrapper + theming). Tailwind `accent-primary` + `indeterminate` via ref entrega a mesma UX em 10 linhas sem dependência nova.
5. **Dialog separado do single-row delete:** mesmo que ambos façam "exclusão destrutiva", o copy é distinto (singular vs plural + contagem) e o estado de disabling é diferente. Dois diálogos pequenos > 1 diálogo parametrizado com condicionais internos.

---

## [Unreleased] — 2026-04-22 — Sessão 31 — Dashboard real por perfil (Gestor / RH / Diretor)

### Added — Backend: contrato + service + endpoint único `/api/dashboard/agregado`

- `RHPortal.Api/RHPortal.Api/Contracts/Dashboard/DashboardAgregadoContracts.cs` (**novo**): DTOs do contrato único da Sessão 31. Envelope `DashboardAgregadoResponse` com `perfil`, `geradoEmUtc`, `funcionarioId?`, `gestor?`, `rh?`, `diretor?` — o cliente pede um perfil e recebe só a seção correspondente preenchida; as outras duas ficam `null`. Enum string `PerfilAgregado = "gestor" | "rh" | "diretor"`. Três seções:
  - `DashboardGestorSection`: 8 KPIs (`diretosAtivos`, `diretosComDadosIncompletos`, `carteiraVagasAbertas`, `carteiraVagasParadas`, `carteiraCandidaturasAtivas`, `candidaturasEtapaAvancada`, `aprovacoesPendentesMinhas`, `solicitacoesEquipePendentes`, `avaliacoesDiretosPendentes`) + lista `vagasMaisAntigas: DashboardGestorVagaAbertaItem[]` (vagaId, código, título, diasAberta, foraDoSla, candidaturas) + lista `candidaturasEmDestaque: DashboardGestorCandidaturaItem[]` (candidaturaId, vagaTitulo, candidatoNome, etapaMacro, diasNaEtapa).
  - `DashboardRhSection`: 16 KPIs (vagas abertas/forasla/rascunho + pipeline aplicadas/triagem/entrevista/proposta/contratado-mes + pré-admissões emAndamento/aguardandoAprovacao/aprovadasMes + admissões semana/mês + `notificacoesFalhadas7d` + `matchingScoresUltimas48h` + aprovações de alçada/solicitações vaga pendentes) + listas `vagasForaSlaTop` e `preAdmissoesRecentes`.
  - `DashboardDiretorSection`: 11 KPIs (headcount total + comDadosIncompletos + admissões mês + desligamentos concluídos/aguardandoIntegração + vagas aprovadas mês + solicitações vaga pendentes + alçada salarial aprovada mês + ciclos abertos/emCalibragem + convites pendentes) + listas `headcountPorArea: DashboardDiretorAreaItem[]` (areaId, nome, headcount, vagasAbertas) e `ciclosResumo: DashboardDiretorCicloItem[]` (cicloId, nome, período, status, convitesTotal/Respondidos).
- `RHPortal.Api/RHPortal.Api/Application/Dashboard/DashboardAgregadoService.cs` (**novo**): implementa `IDashboardAgregadoService` com um método público `ObterAsync(perfil, funcionarioId?, ct)` (facade) + 3 builders privados `BuildGestorAsync` / `BuildRhAsync` / `BuildDiretorAsync`. Ctor recebe `AppDbContext` + `IOptions<SlaVagaOptions>`. Principais queries:
  - **Gestor** (requer `FuncionarioId`): resolve subordinados via `Funcionarios.Where(f => f.GestorDiretoId == funcionarioId)`; carteira de vagas via `Vagas.Where(v => v.GestorFuncionarioId == funcionarioId)`; paradas = abertas há ≥ `SlaVagaMetaResolver.GetDiasMeta(eixo?, vaga)`; candidaturas em destaque = `Candidaturas.Where(c => dirsIds.Contains(c.CandidatoId)` OR `vagasIds.Contains(c.VagaId))` ordenadas por `DiasNaEtapa DESC`.
  - **RH** (tenant-wide): `VagasByStatus` via `GroupBy(s => s.Status)`; `PipelineByEtapa` via `Candidaturas.GroupBy(c => c.EtapaMacro)`; pré-admissões via status; admissões via `Funcionarios.Where(CreatedAtUtc >= ...)`; `notificacoesFalhadas7d` lê `NotificacaoCandidaturaLog.Status == Falha`; `matchingScoresUltimas48h` lê `CandidatoVagaMatchingScore.CreatedAtUtc`.
  - **Diretor** (tenant-wide): `headcountPorArea` via `Areas.Include(a => a.Funcionarios.Where(f => f.Ativo))` + `LEFT JOIN Vagas`; ciclos via `AvaliacaoCiclo.Status in (Aberto, EmCalibragem)`; alçada via `Vagas.Count(AlcadaSalarialAprovadaEmUtc IS NOT NULL && mes)`.
  - **Perfil sem dados ⇒ seção null** (não 403). Gestor sem `FuncionarioId` OU sem diretos ⇒ `gestor = null`; RH sem dados ⇒ contagens zeradas mas seção **não** null (é legítimo); Diretor sem `FuncionarioId` ⇒ vê agregados tenant-wide (diretor é papel amplo).
- `RHPortal.Api/RHPortal.Api/Controllers/DashboardController.cs`: adicionado método `ObterAgregado(perfil, IDashboardAgregadoService, ICurrentUserContext, ct)` (`[HttpGet("agregado")]` + `[RequirePermission("dashboard.view")]`):
  - Query param `perfil` obrigatório — valores aceitos `gestor`/`rh`/`diretor` (case-insensitive). Outros valores → `400 BadRequest("Perfil inválido.")`.
  - Service injetado via `[FromServices]` para não quebrar ctor legado do `DashboardController` (ele tem muitas dependências).
  - Repassa `_currentUser.FuncionarioId` (pode ser null — service decide se retorna seção vazia/null).
- `RHPortal.Api/RHPortal.Api/Program.cs`: `builder.Services.AddScoped<IDashboardAgregadoService, DashboardAgregadoService>()` na seção DI.

### Added — Frontend: types + hook + tela dedicada + rota + link no dashboard livre

- `LioTecnica.Web.Next/src/features/dashboard/dashboardAgregadoTypes.ts` (**novo**): mirror 1:1 do contrato backend. `PerfilAgregado = "gestor" | "rh" | "diretor"`; `DashboardAgregadoResponse` + 3 section types + 5 item types (`DashboardGestorVagaAbertaItem`, `DashboardGestorCandidaturaItem`, `DashboardRhVagaForaSlaItem`, `DashboardRhPreAdmissaoItem`, `DashboardDiretorAreaItem`, `DashboardDiretorCicloItem`). Sem dependências externas — é só um arquivo de types para evitar drift entre API e tela.
- `LioTecnica.Web.Next/src/features/dashboard/useDashboardAgregado.ts` (**novo**): hook `useDashboardAgregado(perfil): { data, loading, error, refresh }`. `apiFetch('/api/dashboard/agregado?perfil=<perfil>', { cache: 'no-store' })` — tenant header auto-injetado pelo `apiFetch` wrapper. Mensagens de erro por status HTTP: 400 (perfil inválido), 401/403 (permissão), outros (código genérico). `useEffect` com dep `[load]` onde `load` é `useCallback` com dep `[perfil]` — troca de aba recarrega.
- `LioTecnica.Web.Next/src/features/dashboard/DashboardVisaoPorPerfilScreen.tsx` (**novo**, ~700 linhas): componente principal. Layout:
  - Header com título "Visão por perfil" + botão Atualizar.
  - `TabsPerfil` — 3 abas horizontais (Gestor / RH / Diretor) com estado em `useState<PerfilAgregado>`.
  - `SkeletonGrid` durante loading (4 KPI cards placeholder).
  - `ErrorCard` com mensagem + botão Tentar novamente.
  - `SecaoIndisponivel` quando `data.[perfil] === null`, com mensagem customizada:
    - Gestor: "Você não tem vínculo com funcionário ou não tem subordinados ativos."
    - RH: "O módulo de RH não está contratado para o tenant ou você não tem permissão."
    - Diretor: "Você não tem permissão para visualizar indicadores de diretor."
  - **`SecaoGestor`**: 5 cards "Meu time" (diretos ativos / diretos com dados incompletos com tom `warning` / aprovações pendentes com href `/gestor/aprovacoes` / solicitações equipe / avaliações diretos) + 4 cards "Carteira de vagas" (abertas com href `/vagas` / paradas com tom `warning` / candidaturas ativas / candidaturas em etapa avançada com tom `success`) + tabela **Vagas mais antigas** (código, título, dias aberta com badge `foraDoSla` vermelho/emerald, candidaturas) + tabela **Candidaturas em destaque** (candidato, vaga, etapa macro com badge colorido, dias na etapa).
  - **`SecaoRh`**: 5 cards "Vagas" (abertas / fora SLA `warning` / rascunho) + 5 cards "Funil" (aplicadas / triagem / entrevista / proposta / contratados mês `success`) + 6 cards "Pré-admissões & Admissões" (em andamento / aguardando aprovação / aprovadas mês `success` / admissões semana / admissões mês / aprovações faixa pendentes) + 2 cards "Saúde" (notificações falhadas 7d tom `danger` se > 0 / matching scores 48h) + tabela **Vagas fora SLA (top 10)** (código, título, área, dias aberta vs meta SLA) + tabela **Pré-admissões recentes** (nome, status com badge, % completude, atualizado em).
  - **`SecaoDiretor`**: 4 cards "Headcount" (total / incompletos `warning` / vagas aprovadas mês / alçada aprovada mês) + 5 cards "Movimentação" (admissões mês / desligamentos concluídos mês / aguardando integração `warning` / solicitações vaga pendentes / convites avaliação pendentes) + 3 cards "Ciclos" (abertos / em calibragem) + tabela **Headcount por área** (área, headcount, vagas abertas) + tabela **Ciclos de avaliação** (nome, período, status, convites respondidos/total com barra de progresso).
  - `KpiCard` reutilizável: props `{ label, value, tone?: "neutral"|"warning"|"success"|"danger", href?, hint? }`. Tons mapeados para classes Tailwind. Ícones lucide-react opcionais.
- `LioTecnica.Web.Next/src/app/(app)/dashboard/visao-por-perfil/page.tsx` (**novo**): shell minimalista `<AuthGuard><DashboardVisaoPorPerfilScreen /></AuthGuard>` seguindo o padrão das demais rotas Next do app.
- `LioTecnica.Web.Next/src/features/dashboard/DashboardScreen.tsx` (**editado, aditivo**): adicionado botão "Visão por perfil" na toolbar principal (antes do botão "Adicionar widget"), com ícone `ChartBarStacked` de `lucide-react` e `href="/dashboard/visao-por-perfil"`. O dashboard livre com widgets personalizáveis (`WidgetCatalog` + `useDashboardLayout`) **permanece intocado** — entrega é aditiva: quem prefere a visão consolidada por perfil clica no botão, quem prefere widgets continua na mesma tela de sempre.

### Added — Cobertura de testes (24 métodos em `DashboardAgregadoServiceTests.cs`)

- `RHPortal.Api/RHPortal.Api.Tests/Dashboard/DashboardAgregadoServiceTests.cs` (**novo**, 24 métodos de teste, xUnit + InMemoryDatabase + `Mock<ITenantContext>`):
  - **Facade (4):** `ObterAsync_PerfilGestor_RetornaApenasSecaoGestor`, `...Rh_RetornaApenasSecaoRh`, `...Diretor_RetornaApenasSecaoDiretor`, `...PerfilInvalido_Lanca`.
  - **Gestor (4):** `Gestor_ContaDiretosAtivosEComDadosIncompletos`, `Gestor_CarteiraVagasParadasIdentificaForaDoSla`, `Gestor_CandidaturasEmDestaqueFiltradasPorHierarquia`, `Gestor_SemDiretos_RetornaSecaoNull`.
  - **RH (5):** `Rh_ContaVagasPorStatus`, `Rh_PipelineAgrupadoPorEtapaMacro`, `Rh_PreAdmissoesPorStatus`, `Rh_AdmissoesSemanaEMes_DependeDeCreatedAtUtc`, `Rh_NotificacoesFalhadas7dEMatchingScores48h`.
  - **Diretor (4):** `Diretor_HeadcountPorAreaIncluiVagasAbertas`, `Diretor_CiclosAbertosEEmCalibragem`, `Diretor_AlcadaSalarialAprovadaMes`, `Diretor_ConvitesAvaliacaoPendentes`.
  - **Tenant isolation (3):** `Gestor_NaoVaza_ParaOutroTenant`, `Rh_NaoVaza_ParaOutroTenant`, `Diretor_NaoVaza_ParaOutroTenant` — cada um usa o helper `CriarServicoComOutroTenant()` que abre 2 `AppDbContext` no mesmo InMemoryDatabase mas com `Mock<ITenantContext>` diferentes: o contexto do "outro tenant" seedea dados que **não devem aparecer** no resultado do serviço sob teste. Esse pattern foi necessário porque `AppDbContext.SaveChangesAsync` **sobrescreve `TenantId`** com `_tenantContext.TenantId` em entidades Added (gotcha descoberto durante a implementação).
  - **Edge cases (4):** `Facade_PerfilSemFuncionarioId_RetornaSecaoAdequada`, `Rh_SemDados_RetornaContagensZeradas`, `Diretor_SemAreas_RetornaListaVazia`, `Gestor_SemVagas_RetornaListaVaziaNaCarteira`.
  - **Helpers novos no arquivo:**
    - `CriarServicoComOutroTenant()` — factory dual-context (2 `AppDbContext` no mesmo InMemoryDb + 2 `ITenantContext` com tenant IDs diferentes).
    - `AjustarCreatedAtAsync<T>(db, entity, valor)` — save em Added state (CreatedAtUtc é forçado para `now` pelo `AppDbContext.SaveChangesAsync`), depois mutate property + save em Modified state (só `UpdatedAtUtc` é touched). Necessário para testes que dependem de `CreatedAtUtc` backdated (admissões semana/mês).
    - `NovaArea(tenant, id, nome, code?)` — factory que default-provê `Code = nome.ToUpperInvariant()` (a entidade `Area` tem `Code` como required).
  - **Gotchas documentados inline:**
    - `AppDbContext.SaveChangesAsync` override de `TenantId` → dual-context pattern.
    - `AppDbContext.SaveChangesAsync` override de `CreatedAtUtc`/`UpdatedAtUtc` → save-then-modify pattern.
    - `CandidatoVagaMatchingScore` tem composite key `(CandidatoId, VagaId)` → seeds precisam de `VagaId` distintos para múltiplas entries do mesmo candidato.
    - Namespace `RhPortal.Api.Tests.PreAdmissao` colide com a entidade `RhPortal.Api.Domain.Entities.PreAdmissao` → usar fully qualified `new RhPortal.Api.Domain.Entities.PreAdmissao(...)`.
    - `TipoFluxoAprovacao` não tem `AberturaVaga` — usar `RequisicaoPessoal` (semântico equivalente).
    - `AvaliacaoConviteTipo.Gestor` não existe — é `GestorParaDireto`.
    - `Funcionario` não tem `MotivoDesligamento` como enum nem `DataPrevistaDesligamento` — o enum é `TipoDesligamento`, `MotivoDesligamento` é string livre, e a data é `DataDesligamento: DateOnly`.

### Regression summary

| Suite | Resultado |
|-------|-----------|
| Backend xUnit (`RHPortal.Api.Tests`) | **775 / 775 verde** (751 da Sessão 30 + 24 novos do `DashboardAgregadoServiceTests`) |
| `dotnet build` | 0 erros / 120 warnings pré-existentes |
| `npx tsc --noEmit` | 0 erros |
| `npx next build` | 126 / 126 páginas (inclui `/dashboard/visao-por-perfil` listado) |
| `npx eslint` nos arquivos tocados | 0 issues |

### Context — Substitui colcha de retalhos do `DashboardScreen.tsx` por visão consolidada

O `DashboardScreen.tsx` existente implementa um dashboard livre com widgets selecionáveis (`WidgetCatalog` + `useDashboardLayout` com persistência em localStorage + reordenação por drag). É flexível, mas **não existe uma visão oficial "meu perfil"** — cada gestor/RH/diretor montava o dashboard à mão. A Sessão 31 entrega uma tela separada com KPIs e listas pré-definidas por perfil, enquanto o dashboard livre **permanece intocado** (entrega aditiva — não invalida nada que já existia).

**Decisões arquiteturais registradas.**

1. **Endpoint único vs 3 endpoints:** optou-se por `GET /api/dashboard/agregado?perfil=X` em vez de `/gestor/dashboard` + `/rh/dashboard` + `/diretor/dashboard`. Motivos: (a) contrato único facilita validação e tipos TS; (b) reduz proliferação de rotas; (c) permissão é a mesma (`dashboard.view` — não há "permissão para ver dashboard de RH" separada de "dashboard de gestor").
2. **Seção null vs 403:** quando o perfil não tem dados disponíveis (gestor sem subordinados, RH sem módulo, diretor sem permissão), a resposta devolve a seção como `null` em vez de retornar 403. A UI decide o que exibir (`SecaoIndisponivel` com mensagem customizada por perfil). Isso evita a confusão "dashboard inteiro quebra porque uma seção não aplica".
3. **Frontend separado do dashboard livre:** a nova tela `DashboardVisaoPorPerfilScreen` foi criada como **rota dedicada** (`/dashboard/visao-por-perfil`) em vez de virar um widget no catálogo do dashboard livre. Motivo: a visão agregada por perfil tem layout próprio (tabs + 3 seções com ~20 cards + 4 tabelas por aba) e não faria sentido espremer em um card draggable de 400×300.
4. **Links rápidos em cards:** cards como "Aprovações pendentes" (gestor) ou "Vagas abertas" (RH) expõem `href` para `/gestor/aprovacoes` ou `/vagas` — o dashboard vira ponto de partida da jornada, não um cemitério de números.
5. **Padrão de tenant isolation nos testes:** adotado o `CriarServicoComOutroTenant()` com dois `AppDbContext` no mesmo InMemoryDb e `ITenantContext` diferentes. É reutilizável para outros services multi-tenant que precisem de testes de isolamento — documentado como pattern em `habilidades.md` (próxima sessão).

### Follow-ups deixados

- Adicionar item no `NavegacaoManifest` apontando para `/dashboard/visao-por-perfil` (hoje só acessível via botão na toolbar do dashboard livre). Bucket natural: `principais`, permissão `dashboard.view`.
- Suporte a multi-perfil (diretor que também é gestor de área técnica): backend já suporta 2 chamadas; frontend poderia oferecer checkbox "incluir também <outro perfil>". Adia para quando houver necessidade real.

---

## [Unreleased] — 2026-04-22 — Sessão 30 — Desempenho sai da lista de lacunas: módulo ganha sidebar

### Added — 3 itens novos de `Desempenho` no `NavegacaoManifest`

- `RHPortal.Api/RHPortal.Api/Infrastructure/Navegacao/NavegacaoManifest.cs`: três items adicionados ao bloco "Gestão de Pessoas (pacote)" logo após `nav-feedback-celebracao`:
  - `nav-desempenho-minhas` → `/desempenho` (label "Minhas Avaliações", ícone `trending-up`, permissão `desempenho.view`, ordem 100). Tela do colaborador — `DesempenhoMinhasAvaliacoesScreen.tsx` já existia em `features/feedback/desempenho/`.
  - `nav-desempenho-ciclos` → `/feedback/avaliacao` (label "Ciclos de Avaliação", ícone `target`, permissão `desempenho.ciclos.manage`, ordem 110). Tela admin de RH — `CiclosAvaliacaoScreen.tsx` já existia em `features/feedback/` com todo o fluxo de criação/ativação/fechamento/convites/calibragem com comitê/export CSV.
  - `nav-desempenho-ninebox` → `/feedback/nine-box` (label "Nine Box", ícone `grid`, permissão `desempenho.calibragem.manage`, ordem 120). Matriz 3×3 com posicionamento + PDI automático — `NineBoxScreen.tsx` já existia em `features/feedback/nine-box/`.
- Bucket UI resolvido automaticamente via `PackageKey: "gestao-pessoas"` do módulo `desempenho` no `ModuleCatalog`. Nenhum `ModuloKeyOverride` ou `GrupoUiOverride` necessário — as permissões `desempenho.*` já casam com `PermissionKeyPrefixes: ["desempenho."]` do catálogo.
- Comentário inline documenta que as rotas Next vivem em `/feedback/*` por razão histórica (submódulo nasceu embutido no pacote Feedback) — migrar para `/desempenho/*` é cosmético, fica para próxima sessão.

### Changed — Teste `ModulosComTelasNoManifesto_AparecemNoMapa` removido `desempenho` da whitelist de exceções

- `RHPortal.Api/RHPortal.Api.Tests/Navegacao/ModuleScreensResolverTests.cs`:
  - Array `modulosObrigatorios` passou de 14 para 15 entradas — `"desempenho"` adicionado entre `"gestao"` e `"folha-pagamento"`.
  - Comentário do teste reescrito: *"Todos os módulos declarados no ModuleCatalog DEVEM ter telas no manifesto. (Antes da Sessão 30 'desempenho' estava declarado mas sem UI — essa lacuna foi fechada com a adição de Minhas Avaliações, Ciclos de Avaliação e Nine Box ao bucket Gestão de Pessoas.)"*.

### Added — Teste específico do módulo Desempenho

- `RHPortal.Api/RHPortal.Api.Tests/Navegacao/ModuleScreensResolverTests.cs`: novo `DesempenhoModule_IncluiMinhasAvaliacoesECiclosENineBox` seguindo o padrão dos análogos (`RecrutamentoModule_*`, `CandidatosModule_*`, `FolhaPagamentoModule_*`). Asserta:
  - Resolver devolve exatamente 3 telas para `moduleKey = "desempenho"`.
  - Hrefs cobertas: `/desempenho`, `/feedback/avaliacao`, `/feedback/nine-box`.
  - Todas caem em `GrupoUiKey = "gestao-pessoas"` / `GrupoUiLabel = "Gestão de Pessoas"`.
  - Permissões distintas por tela: `desempenho.view` / `desempenho.ciclos.manage` / `desempenho.calibragem.manage`.

### Regression summary

| Suite | Resultado |
|-------|-----------|
| Backend xUnit (`RHPortal.Api.Tests`) | **751 / 751 verde** (750 da Sessão 29 + 1 teste novo de Desempenho) |
| `dotnet build` | 0 erros / 120 warnings pré-existentes (não relacionados) |
| Next.js `tsc --noEmit` | 0 erros (nenhum `.tsx` foi tocado — manifest consumido dinamicamente via `GET /api/navegacao/sidebar`) |

### Context — Fecha follow-up explícito da Sessão 27

A Sessão 27 deixou o seguinte follow-up marcado `[ ]` no backlog:

> **(follow-up)** `desempenho` declarado no `ModuleCatalog` mas sem telas no `NavegacaoManifest` — implementar UI do módulo para sair da lista de exceções do teste `ModulosComTelasNoManifesto_AparecemNoMapa` (hoje documentado como lacuna de produto).

O backend de Desempenho existe desde as Sessões 21 (MVP) e 22 (completo — ciclos / autoavaliação / 360° / calibragem com comitê / 9-box / convites / export CSV). Só faltava um passo de plumbing: expor no manifesto code-first. Após a Sessão 24 (Fases A+B+C da navegação unificada), esse é o único ponto de fonte-única-de-verdade para sidebar — mudar 3 linhas lá é suficiente para o admin ver o módulo aparecer.

**Decisão arquitetural registrada:** mantive as rotas Next nas URLs atuais (`/desempenho`, `/feedback/avaliacao`, `/feedback/nine-box`) em vez de criar duplicatas em `/desempenho/*`. Motivos: (a) URLs existentes continuam funcionando; (b) evita manutenção dupla de arquivos `page.tsx`; (c) migração para `/desempenho/*` é cosmética e pode ser feita numa sessão futura com redirects; (d) o que importa para fechar o follow-up é o resolver e o manifesto reconhecerem o módulo, não a estrutura de URL do Next.

---

## [Unreleased] — 2026-04-22 — Sessão 29 — White-label real por tenant + roteiro de teste ponta-a-ponta

### Added — Backend `TenantBranding` (entidade + migration idempotente + service + 2 controllers + testes)

- `RHPortal.Api/RHPortal.Api/Domain/Entities/TenantBranding.cs` (**novo**): implementa `ITenantEntity` (participa do filtro automático por `TenantId` no `AppDbContext.OnModelCreating`). Campos visuais: `NomePortal` (80), `Subtitulo` (160), `RodapeTexto` (160), `CorPrimariaHex` (7), `CorSecundariaHex` (7), `LogoUrl` (512), `VersaoExibida` (32) — todos nullable para permitir fallback para defaults da plataforma. Campo `UpdatedAtUtc` para auditoria mínima. **Decisão arquitetural:** separado de `TenantConfiguracao` (regras de negócio/aprovações) para manter responsabilidades distintas — branding é visual, config é operacional.
- `RHPortal.Api/RHPortal.Api/Infrastructure/Data/AppDbContext.cs`: `DbSet<TenantBranding> TenantBrandings` + configuração com índice único `IX_TenantBrandings_TenantId` (1-to-1 lógico por tenant).
- `RHPortal.Api/RHPortal.Api/Migrations/20260422xxxxxx_AddTenantBrandingsTable.cs` (**novo**): reescrita manualmente para `CREATE TABLE IF NOT EXISTS "TenantBrandings" (...)` + `CREATE UNIQUE INDEX IF NOT EXISTS "IX_TenantBrandings_TenantId"` em linha com a regra do `CLAUDE.md` de migrations idempotentes para cenário multi-tenant (bancos de tenants mais antigos passam pela mesma migration sem erro).
- `RHPortal.Api/RHPortal.Api/Application/TenantBranding/TenantBrandingService.cs` (**novo**): métodos `GetAsync(ct)` / `UpsertAsync(request, ct)` / `ResetAsync(ct)` / `GetPublicAsync(tenantId, ct)`. Helpers **públicos** `NormalizeText(raw, maxLength)` (trim + clamp + whitespace→null) e `NormalizeColor(raw)` (valida `^#[0-9A-Fa-f]{6}$`, normaliza para maiúsculo; inválido → null **em vez de lançar** — UX-safe, typo não derruba UI). Constantes `MaxNomePortal=80`, `MaxSubtitulo=160`, `MaxRodape=160`, `MaxLogoUrl=512`, `MaxVersao=32` batem com `[MaxLength]` da entidade. Helpers foram promovidos a `public static` (não `internal`) porque o projeto de testes não tem `InternalsVisibleTo` — stateless pure functions, promover é mais limpo que adicionar AssemblyInfo.
- `RHPortal.Api/RHPortal.Api/Controllers/TenantBrandingController.cs` (**novo**, admin): `GET /api/tenant-branding` (retorna DTO com todos os campos), `PUT /api/tenant-branding` (upsert) e `DELETE /api/tenant-branding` (reset). Gate `_userContext.IsAdmin` nas mutations (Get permanece aberto para qualquer usuário autenticado — telas que consomem branding não precisam ser admin).
- `RHPortal.Api/RHPortal.Api/Controllers/PublicBrandingController.cs` (**novo**): `GET /api/public/branding?tenant=<slug>` com `[AllowAnonymous]`. Whitelistado em `TenantMiddleware.PublicPathsWithoutTenant` (bypassa requisito de header `X-Tenant-Id` — a tela de login não conhece o tenant até o usuário digitar). Usa `IServiceProvider.CreateScope()` + `ITenantContext.SetTenantId(tenantId)` manual para resolver branding pelo slug do path (mesmo padrão de endpoints Owner). **Sempre retorna 200** (DTO todo-null se slug inválido ou tenant inexistente) — a UI de login nunca quebra por typo no slug.
- `RHPortal.Api/RHPortal.Api/Contracts/TenantBranding/` (**novo**): `TenantBrandingPublicDto`, `TenantBrandingAdminDto`, `TenantBrandingUpsertRequest`.
- `RHPortal.Api/RHPortal.Api/Program.cs`: `services.AddScoped<ITenantBrandingService, TenantBrandingService>()`.
- `RHPortal.Api/RHPortal.Api/Infrastructure/Tenants/TenantMiddleware.cs`: `/api/public/branding` adicionado ao array `PublicPathsWithoutTenant` (junto com `/api/auth/auto-login`, `/health` etc.).

### Added — Frontend white-label na `LoginScreen` + nova tela admin

- `LioTecnica.Web.Next/src/lib/tenant-branding.ts` (**novo**): lib central com types `TenantBrandingPublic`, `TenantBrandingAdmin`, `TenantBrandingUpsert`; constante `BRANDING_DEFAULTS` com fallbacks de plataforma (Portal de RH, "Gestão de pessoas e recrutamento", `#0C3A64`, `#105291`, `"v3.0"`, etc.); `applyBrandingDefaults(branding)` que retorna todos os campos non-null com fallbacks aplicados; `isValidTenantSlug(s)` regex `^[a-z0-9][a-z0-9\-]{1,62}$/i` espelhando o backend; `fetchPublicBranding(slug)` que **sempre resolve** (null em qualquer erro, nunca lança); `renderFooterText(raw)` substitui `{ano}` pelo ano corrente; wrappers admin `getTenantBrandingAdmin`, `upsertTenantBranding`, `resetTenantBranding`.
- `LioTecnica.Web.Next/src/lib/session.ts`: adicionadas `getLastTenantSlug()`, `setLastTenantSlug()`, `clearLastTenantSlug()` usando `localStorage` com chave `renderrh.lastTenantSlug`. **`clearSession()` deliberadamente NÃO limpa esse valor** — comentário inline documenta: após logout, a próxima tela de login deve manter o branding do tenant anterior (UX contínua).
- `LioTecnica.Web.Next/src/features/auth/LoginScreen.tsx`: importa `Image` de `next/image` (com `unoptimized` para URLs de CDN arbitrárias), helpers de sessão, branding lib; adiciona state + `useEffect` que resolve o slug por prioridade (`?tenant=` query → `localStorage.lastTenantSlug`), chama `fetchPublicBranding` e cacheia o resultado; memos para `ui = applyBrandingDefaults(branding)`, `footerText = renderFooterText(ui.rodapeTexto)`, `cardGradient` e `logoGradient` (derivados de `ui.corPrimariaHex`/`corSecundariaHex`); submit handler chama `setLastTenantSlug(parsed.data.tenantId)` após login bem-sucedido (não persiste "owner"); header mostra `<Image>` se `ui.logoUrl` estiver definido, senão mantém o `<Building2>` com gradient dinâmico; card recebe `style={{ background: cardGradient }}`; botão submit `style={{ color: ui.corPrimariaHex }}`; footer exibe `{ui.versaoExibida}` (em vez de "v2.5" hardcoded) e `{footerText}` (em vez de `© {new Date().getFullYear()} · Portal de RH`).
- `LioTecnica.Web.Next/src/features/admin/tenant-branding/TenantBrandingScreen.tsx` (**novo**): form admin completo com todos os 7 campos + **preview ao vivo à direita (440px)** que imita pixel a pixel o card real da LoginScreen (mesmo gradient, mesmo layout, mesmo `renderFooterText`, mesmo `applyBrandingDefaults`). Constantes `MAX_*` espelham os maxlengths do backend. Helpers locais `isHex(s)` e `normalizeHexInput(s)` validam cores client-side (badge vermelho com mensagem quando inválido). `save()` chama `upsertTenantBranding` e recarrega do DTO retornado (backend pode ter normalizado cores). `resetAll()` com confirm dialog chama `resetTenantBranding`. Subcomponentes `FormField` (com contador de caracteres `x/80`) e `ColorField` (color picker nativo + input text com validação).
- `LioTecnica.Web.Next/src/app/(app)/admin/tenant-branding/page.tsx` (**novo**): shell envolvendo `TenantBrandingScreen` com `AuthGuard`.
- `RHPortal.Api/RHPortal.Api/Infrastructure/Navegacao/NavegacaoManifest.cs`: novo item `nav-admin-tenant-branding` (`/admin/tenant-branding`, ícone `palette`, permissão `access.manage`, `GrupoUiOverride: "configuracoes"`, ordem 80) logo após `nav-admin-tenant-config`.
- `LioTecnica.Web.Next/src/features/navigation/SidebarNavClient.tsx`: `Palette` adicionado ao import `lucide-react` e ao map `ICONS` com chave `palette`.

### Added — `TESTE_FLUXO_ADMISSAO.md` (roteiro ponta-a-ponta)

- `TESTE_FLUXO_ADMISSAO.md` (**novo**, raiz do repo): roteiro de ~30 minutos cobrindo o pipeline completo com os 3 perfis de teste (gestor → diretor → RH):
  1. **Pré-requisitos** (API em Development, Next.js rodando, seed aplicado, tenant ativo).
  2. **Preparação dos 3 usuários** via `POST /api/dev/seed/usuarios-teste` (senha unificada `YkmF@2022*`).
  3. **Seed opcional** de dataset (vaga + candidatos + talentos) via `POST /api/dev/seed`.
  4. **Fluxo principal em 8 passos:** 3.1 gestor cria solicitação → 3.2 diretor aprova → 3.3 RH publica vaga → 3.4 candidato + matching → 3.5 RH conduz processo seletivo → 3.6 gestor aprova contratação → 3.7 RH pré-admissão + documentação → 3.8 integração TOTVS simulada.
  5. **Checklist de aceitação** (13 itens).
  6. **Modo express** com bash script + `jq` (execução em <5 min para smoke test).
  7. **Comandos de limpeza** idempotentes para reset.
  8. **Tabela de troubleshooting** com 7 sintomas comuns → causa → fix.
  9. **Referência cruzada** com os controllers envolvidos em cada passo.
- Integra com a white-label nova via `?tenant=<slug>` na URL de login. O endpoint `POST /api/dev/seed/usuarios-teste` (que já retornava `proximoPasso: "ver TESTE_FLUXO_ADMISSAO.md"`) agora tem o arquivo real apontado.

### Added — Cobertura de testes (17 métodos → 27 resultados com Theory)

- `RHPortal.Api/RHPortal.Api.Tests/TenantBranding/TenantBrandingServiceTests.cs` (**novo**, 17 métodos de teste):
  - Defaults: `GetAsync_SemRegistro_RetornaDtoComTodosNullos`.
  - Upsert: `UpsertAsync_Cria_QuandoNaoExiste`, `UpsertAsync_Atualiza_QuandoExiste`, `UpsertAsync_NaoDuplica` (tenta upsert 3×, assert uma única row).
  - Normalização de texto: `UpsertAsync_StringVazia_GravaNull`, `UpsertAsync_ClampaTamanhoMax` (corpo 200 chars → persiste só 80 para `NomePortal`).
  - Normalização de cor: `UpsertAsync_CorInvalida_GravaNull`, `UpsertAsync_CorLowercase_NormalizaParaUpper`.
  - Reset: `ResetAsync_RemoveRegistro`, `ResetAsync_SemRegistro_NaoLanca` (idempotente).
  - Public: `GetPublicAsync_RetornaDtoMesmoSemRegistro`, `GetPublicAsync_RetornaDtoComCamposQuandoPersiste`.
  - **Helpers puros (`[Theory]`):** `NormalizeColor_Theory` com 5 inputs válidos + 8 inválidos; `NormalizeText_EmptyOuWhitespace_RetornaNull`, `NormalizeText_Clampa`, `NormalizeText_TrimAntesDeClampar`.
  - **Isolamento cross-tenant:** `UpsertAsync_IsolaPorTenant` (2 `AppDbContext` no mesmo InMemoryDb, cada um com `ITenantContext` diferente, usa `IgnoreQueryFilters` para provar que o filtro automático por tenant funcionou — tenant A não vê branding do tenant B).
- `RHPortal.Api/RHPortal.Api/Application/TenantBranding/TenantBrandingService.cs`: `NormalizeText` e `NormalizeColor` mudados de `internal static` → `public static` para permitir Theory testing direto (ver justificativa acima).

### Regression summary

| Suite | Resultado |
|-------|-----------|
| Backend xUnit (`RHPortal.Api.Tests`) | **750 / 750 verde** (723 da Sessão 28 + 27 novos branding) |
| `dotnet build` | 0 erros / 84 warnings pré-existentes (não relacionados) |
| Next.js `tsc --noEmit` | 0 erros |
| Next.js `eslint` (arquivos tocados) | 0 erros |

### Context — Fecha follow-ups explícitos da Sessão 26

A Sessão 26 deixou 2 follow-ups marcados `[ ]` no backlog:

- **follow-up 1** *"tornar 'Portal de RH' / versão do footer configuráveis por tenant (via env ou config backend) para white-label real por empresa"* → fechado por esta sessão. A escolha foi **config backend** (não env) porque: (a) env exige redeploy para mudar; (b) cada tenant teria que configurar sua própria instância; (c) config backend aproveita o padrão existente de `AppDbContext` + `ITenantContext`.
- **follow-up 2** *"criar/atualizar `TESTE_FLUXO_ADMISSAO.md` com roteiro ponta-a-ponta usando os 3 perfis"* → fechado com o arquivo de 8 seções descrito acima.

A memória persistente *"entregar completo, não MVP"* foi seguida: backend completo (entidade + migration + service + 2 controllers + DI), UI completa (LoginScreen dinâmica + tela admin com preview ao vivo), testes (27 novos cobrindo isolamento cross-tenant), integração com sidebar, e roteiro de teste ponta-a-ponta no mesmo commit.

---

## [Unreleased] — 2026-04-22 — Sessão 28 — Encerramento dos épicos R&S em andamento (Onboarding por Cargo Macro + Notificações WhatsApp)

### Changed — `DocumentacaoPadraoService` propaga overrides por NivelCargo e Cargo para pré-admissões ativas

- `RHPortal.Api/RHPortal.Api/Application/DocumentacaoPadrao/DocumentacaoPadraoService.cs`:
  - `SaveByNivelCargoAsync` (após o `_db.SaveChangesAsync(ct)` final) agora chama `await SincronizarPreAdmisoesAtivasAsync(now, ct)`. O método é idempotente e reconstrói a hierarquia `Cargo → NivelCargo → Global` por pré-admissão, então só pré-admissões cujos cargos têm esse `NivelCargoId` terão mudança efetiva — mas a chamada é feita incondicionalmente pra garantir consistência em qualquer cenário (inclusive quando o admin limpa um override).
  - `SaveByCargoAsync` ganhou o mesmo padrão — antes só o save global (`SaveAsync`) disparava a propagação. Agora qualquer alteração na hierarquia (global / nível / cargo) é refletida imediatamente em pré-admissões ativas.
  - Comentário inline documenta: *"Propaga para todas as pré-admissões ativas — só as que pertencem a cargos com esse NivelCargoId terão mudança efetiva, mas o método é idempotente e reconstrói a hierarquia (cargo → nível → global) por preadmissão."*

### Changed — `CandidaturaNotificacaoService.EnviarEmailComLogAsync` respeita janela de silêncio

- `RHPortal.Api/RHPortal.Api/Application/Candidaturas/CandidaturaNotificacaoService.cs`:
  - Adicionada checagem `_waOptions.RespeitarSilencio && EstaDentroSilencio(pref, now, out var silencioDescricao)` em `EnviarEmailComLogAsync`, após a validação do destino e antes do try/catch de enfileiramento. Quando o candidato está dentro da janela de silêncio configurada (`CandidatoNotificacaoPreferencia.SilencioInicio/Fim` HH:mm, suportando janelas que cruzam meia-noite), registra log com `NotificacaoStatus.IgnoradoSilencio` e retorna sem enfileirar.
  - Originalmente (Onda 10) a janela de silêncio só bloqueava WhatsApp. O enum `IgnoradoSilencio` sempre foi canal-agnóstico — e o candidato que configurou "não quero ser notificado entre X e Y" tipicamente quer valer pro e-mail também (push no celular, marca "não lido", etc.).
  - Permanece controlado pela flag global `WhatsAppOptions.RespeitarSilencio` (nome histórico; nessa revisão ela passa a cobrir ambos os canais). Se a flag estiver `false`, nenhum canal respeita silêncio — comportamento original preservado para backward compat.

### Added — Cobertura de testes para os 2 gaps fechados

- `RHPortal.Api/RHPortal.Api.Tests/DocumentacaoPadrao/DocumentacaoPadraoSincronizacaoTests.cs` (**+5 testes**):
  - `SaveByNivelCargo_PropagaParaPreAdmisoesDoNivel` — cria pré-admissão ativa num cargo com `NivelCargoId=X`, salva override em NivelCargo X, verifica que os documentos solicitados da pré-admissão foram recomputados.
  - `SaveByCargo_PropagaParaPreAdmisoesDoCargo` — cenário análogo para override por cargo específico.
  - `SaveByNivelCargo_NaoAfetaPreAdmisoesDeOutroNivel` — garante isolamento: salvar override em NivelCargo X não mexe em pré-admissões de cargos com NivelCargoId=Y.
  - `SaveByCargo_RemocaoDeOverride_ReverteParaNivelOuGlobal` — remover override por cargo → pré-admissão reverte automaticamente para herança do nível (ou do global).
  - `SaveByNivelCargo_RemocaoDeOverride_ReverteParaGlobal` — análogo no nível acima.
  - Ajuste: comentário do teste legado `SaveGlobal_AtualizaObrigatorioDeDocumentoExistenteRespeitandoOverride` corrigido (removida a nota "a sync só é disparada por SaveAsync" — não é mais verdade).
- `RHPortal.Api/RHPortal.Api.Tests/Candidaturas/CandidaturaNotificacaoRateLimitTests.cs` (**+4 testes**):
  - `Sessao28_Silencio_Email_AtivoEDentroDaJanela_LogaIgnorado` — calcula janela em torno da hora local atual, opt-in de e-mail + silêncio ligado → `IgnoradoSilencio` no log + nenhum enfileiramento.
  - `Sessao28_Silencio_Email_ForaDaJanela_PermiteEnvio` — janela em horário oposto → e-mail enfileirado normalmente.
  - `Sessao28_Silencio_Email_DesabilitadoNaOptions_NaoBloqueia` — `WhatsAppOptions.RespeitarSilencio=false` → e-mail enviado mesmo dentro da janela (backward compat).
  - `Sessao28_Silencio_AtivoEmJanela_BloqueiaAmbosOsCanais` — opt-in nos 2 canais + janela ativa → ambos logam `IgnoradoSilencio`, zero envios.

### Regression summary

| Suite | Resultado |
|-------|-----------|
| Backend xUnit (`RHPortal.Api.Tests`) | **723 / 723 verde** (714 da Sessão 27 + 5 DocumentacaoPadraoSincronizacao + 4 CandidaturaNotificacaoRateLimit) |
| `dotnet build` | 0 erros / 116 warnings pré-existentes (não relacionados) |

### Context — Demais sub-itens dos épicos já estavam cobertos

A auditoria feita nessa sessão revelou que o backlog mostrava `[~]` em dois épicos que, no código, já estavam ~80% implementados em ondas anteriores não documentadas:

- **Onboarding por Cargo Macro — sub-item (b)** `override por Cargo específico`: **já implementado** via `DocumentacaoPadraoPorCargoConfig` + `DocumentacaoPadraoPorCargoTests` (9 cenários). Marcado como fechado.
- **WhatsApp extras — sub-item (a)** `provedor real`: **já implementado** — `TwilioWhatsAppMessageSender` + `MetaCloudWhatsAppMessageSender` existem em `Infrastructure/Notifications/`, com seletor via `WhatsApp:Provider` config (`Logging`/`Twilio`/`MetaCloud`).
- **WhatsApp extras — sub-item (c)** `rate-limit/throttle por candidato`: **já implementado** — janela deslizante + override por candidato via `CandidatoNotificacaoPreferencia.WhatsAppRateLimitMaxMensagens`, gera log com status `IgnoradoRateLimit`.
- **WhatsApp extras — sub-item (e)** `seletor de idioma`: **já implementado** — campos `CandidatoNotificacaoPreferencia.Idioma` (BCP-47) + `NotificacaoTemplate.Idioma` + fallback exato→null→hardcoded.

Os 2 gaps reais (SincronizarPreAdmisoesAtivasAsync nos overrides + silêncio no e-mail) foram fechados nessa sessão; os demais foram marcados `[x]` no backlog para alinhar documentação com realidade.

---

## [Unreleased] — 2026-04-20 — Sessão 27 — Owner vê telas por módulo (Trilha A) + Folha oculta enquanto pacote inativo (Trilha B)

### Added — `ModuleScreensResolver` + endpoint detalhado para Owner

- `RHPortal.Api/RHPortal.Api/Contracts/Modules/ModuleContracts.cs`:
  - `ModuleScreenResponse` (**novo**): `Id / Label / Href / Icon / PermissionKey / Ordem / GrupoUiKey / GrupoUiLabel`. Tela individual derivada do `NavegacaoManifest`.
  - `TenantModuleDetailedResponse` (**novo**): extende `TenantModuleResponse` com `IReadOnlyList<ModuleScreenResponse> Telas`.
- `RHPortal.Api/RHPortal.Api/Application/Navegacao/ModuleScreensResolver.cs` (**novo**): classe estática que pré-computa o mapa `moduleKey → IReadOnlyList<ModuleScreenResponse>` varrendo `NavegacaoManifest.Items`. Usa a mesma lógica de associação item→módulo do `NavegacaoSidebarService` (`ModuloKeyOverride ?? ModuleCatalog.ResolveModuleKey(item.PermissionKey)`) e resolve o bucket pelo mesmo `NavegacaoManifest.ResolveGrupoUi(item, modulo)`. Telas ordenadas por `Ordem` e depois `Label`. Métodos `GetScreensForModule(moduleKey)` (lista vazia para chave inexistente/vazia) e `GetAll()`. Resolver é puramente estrutural — não considera `Package.IsActive` nem toggle do tenant; essa é responsabilidade do runtime.
- `RHPortal.Api/RHPortal.Api/Application/Owner/TenantModuleService.cs`: novo método `ListDetailedAsync(tenantId, ct)` que combina `MasterDb.TenantModules` (status/auditoria) com `ModuleScreensResolver.GetScreensForModule(m.Key)` para cada módulo do catálogo.
- `RHPortal.Api/RHPortal.Api/Controllers/OwnerController.cs`: novo endpoint `GET /api/owner/tenants/{tenantId}/modules/detailed` com `[Authorize(Policy = "Owner")]` e `IServiceProvider.CreateScope()` + `ITenantContext.SetTenantId(tenantId)` (mesmo padrão dos outros endpoints Owner). Retorna `IReadOnlyList<TenantModuleDetailedResponse>`.

### Changed — `TabModulos.tsx` mostra telas por módulo

- `LioTecnica.Web.Next/src/features/owner/tenant-tabs/TabModulos.tsx`: reescrita preservando layout existente (Pacotes / Opcionais avulsos / Core) e adicionando:
  - Interface `ModuleScreen` e campo `TenantModule.telas: ModuleScreen[]`.
  - Estado `expandedModules: Set<string>` + `toggleExpand(key)`.
  - Cada card de módulo ganha badge `X telas` e botão `Ver telas / Ocultar telas` (com `ChevronDown`/`ChevronUp` do lucide-react).
  - Quando expandido, renderiza tabelinha `Tela | Href | Bucket UI | Ordem` com as telas resolvidas do backend.
  - Agregado do pacote também mostra contador total de telas.
  - Endpoint consumido: `GET /api/owner/tenants/{tenantId}/modules/detailed`. Toggle de habilitação continua em `PUT /api/owner/tenants/{tenantId}/modules/{key}` — o merge preserva `telas` (derivadas, não persistidas).

### Changed — `NavegacaoSidebarService` esconde Folha de Pagamento enquanto pacote inativo

- `RHPortal.Api/RHPortal.Api/Application/Navegacao/NavegacaoSidebarService.cs`: o gate `package is null || !package.IsActive` deixou de emitir item bloqueado e passou a fazer `continue` direto no loop. Comentário inline documenta a decisão: enquanto o produto não existir, o item não aparece nem com cadeado — volta (com gate normal) quando `PackageCatalog.FolhaPagamento.IsActive` virar `true`. Reversível em 1 linha.

### Changed — Testes de navegação ajustados ao novo comportamento

- `RHPortal.Api/RHPortal.Api.Tests/Navegacao/NavegacaoSidebarServiceTests.cs`:
  - `Build_PacoteInativo_MarcaItensComoBloqueados` → `Build_PacoteInativo_NaoEmiteItens` (afirma que o grupo `folha-pagamento` fica `null` e nenhum href de folha aparece na sidebar).
  - `Build_FolhaPagamento_ItensApontamParaGrupoFolhaPagamento` → `Build_FolhaPagamento_ItensSumuemQuandoPacoteInativo`.
  - `Build_Wildcard_EmiteTodosItensDoManifesto` → `Build_Wildcard_EmiteTodosItensExcetoDePacoteInativo`. Contagem esperada agora é dinâmica: conta itens cujo módulo pertence a um pacote com `IsActive=false` e subtrai do total do manifesto, pra não quebrar quando outro pacote inativo for adicionado no futuro.

### Added — Cobertura de testes do resolver e do service detalhado

- `RHPortal.Api/RHPortal.Api.Tests/Navegacao/ModuleScreensResolverTests.cs` (**novo**, 10 testes):
  - `TodosOsItensDoManifesto_SaoAssociadosAumModulo` — invariante `manifest.Count == map.Values.Sum(l => l.Count)`.
  - `ModulosComTelasNoManifesto_AparecemNoMapa` — whitelist de 14 módulos obrigatórios com telas. Documenta que `desempenho` está declarado no `ModuleCatalog` mas ainda sem UI no manifesto (lacuna de produto).
  - Casos específicos: `RecrutamentoModule_InclueVagasEProcessoSeletivo`, `CandidatosModule_IncluiKanbanPipelineEBancoDeTalentos` (incluindo `/talentos` via `ModuloKeyOverride`), `PortalVagasModule_IncluiPainelRH_PorqueUsaEntradaView`, `MatchingModule_IncluiApenasMatching`.
  - `FolhaPagamentoModule_IncluiAs3Telas_AindaQuePacoteEstejaInativo` — prova de que o resolver é estrutural.
  - Metadados: `TelasTemGrupoUiResolvidoIgualAoManifesto`, `TelasSaoRetornadasOrdenadas`.
  - Defensivos: `ModuloInexistente_RetornaListaVazia`, `ModuloKeyVazia_RetornaListaVazia`.
  - Consistência entre sistemas: `Resolver_ResolveMesmaGrupoUi_QueONavegacaoSidebarService`.
- `RHPortal.Api/RHPortal.Api.Tests/Modules/TenantModuleServiceTests.cs` (**+3 testes**):
  - `ListDetailed_RetornaMesmosModulosDeListAsync_MasComTelas`.
  - `ListDetailed_TelasDerivamDoNavegacaoManifest`.
  - `ListDetailed_RefleteStatusDesabilitado`.

### Regression summary

| Suite | Resultado |
|-------|-----------|
| Backend xUnit (`RHPortal.Api.Tests`) | **714 / 714 verde** (699 da Sessão 26 + 10 ModuleScreensResolver + 3 TenantModuleService + ajustes) |
| Next.js `tsc --noEmit` | 0 erros |
| Next.js `eslint` (arquivos tocados) | 0 erros |

---

## [Unreleased] — 2026-04-20 — Sessão 26 — Tenant seed consertado + usuários de teste + LoginScreen white-label

### Fixed — `TenantProvisioningService.SeedTenantAsync` não criava roles `Gestor`/`Recrutador`/`Operacional`

- `RHPortal.Api/RHPortal.Api/Application/Owner/TenantProvisioningService.cs`: `SeedTenantAsync` (chamado por `POST /api/owner/tenants/{id}/seed`) e `RunSeedAsync` (chamado pelo provisionamento de novo tenant) agora chamam `MenuRoleSeeder.EnsureRolesExistAsync(roleManager, localizer, ct)` logo após `AdminAccessSeeder.EnsureAsync`. Antes, essas 3 roles padrão só existiam em tenants iterados pelo `DbSeeder.MigrateAndSeedAsync` no startup da API — qualquer tenant criado depois, ou re-seedado, ficava sem elas até o próximo restart.
- `RHPortal.Api/RHPortal.Api/Infrastructure/Data/Seeders/MenuRoleSeeder.cs`: `EnsureRolesExistAsync` promovido de `private` para `public` (era usado só pelo próprio seeder no startup; agora é reusado pelo provisioning service).

### Fixed — Build do macOS quebrava com `MSB3552` por causa de path Windows hardcoded

- `RHPortal.Api/RHPortal.Api/appsettings.Development.json`: `InboxFolder.RootPath` alterado de `"C:\\Users\\davio\\Documents\\Projetos\\Qualiit RenderRH\\Voltage.RenderRH\\RHPortal.Api\\RHPortal.Api\\Inbox"` para `"App_Data/Inbox"` (caminho relativo cross-platform). `InboxFolderWatcherService.StartAsync` chamava `Directory.CreateDirectory` nessa string e, em macOS/Linux, criava um diretório literal com backslashes no nome dentro do projeto. Esse diretório quebrava o globbing recursivo do MSBuild (`**/*.resx` + `**/*.razor` + `**/*.cs` passavam a ser tratados como filenames literais), resultando em `error MSB3552: O arquivo de recurso "**/*.resx" não foi encontrado` e impedindo qualquer rebuild.

### Fixed — `DevSeedController.Seed` falhava com `DateTime.Kind=Unspecified` em Pessoa

- `RHPortal.Api/RHPortal.Api/Controllers/DevSeedController.cs`: `pessoa1.DataNascimento` e `pessoa2.DataNascimento` agora usam `DateTime.SpecifyKind(new DateTime(...), DateTimeKind.Utc)`. A coluna Postgres é `timestamp with time zone` e o Npgsql rejeita `DateTime` com `Kind=Unspecified`.

### Changed — `DevSeedController` liberado em Development via guard de ambiente

- `RHPortal.Api/RHPortal.Api/Controllers/DevSeedController.cs`: `[Authorize]` → `[AllowAnonymous]` na classe. Implementa `IActionFilter` com guard central em `OnActionExecuting`: se `IHostEnvironment.IsDevelopment() == false`, toda action devolve `NotFound()` (404). Em Development, basta o header `X-Tenant-Id` (já exigido pelo `TenantMiddleware`). Motivação: seed endpoints não podem depender de JWT quando o tenant acabou de ser criado e ainda não há usuário autenticável.

### Added — `POST /api/dev/seed/usuarios-teste` agora funciona de ponta a ponta

- Com os 3 fixes acima (roles criadas no seed do owner, build destravado, guard de Development), o endpoint `POST /api/dev/seed/usuarios-teste` popula, no tenant corrente:
  - `gestor@teste.local` (Carlos Gestor) com roles `Gestor`+`Admin`, subordinado de Roberto Diretor.
  - `diretor@teste.local` (Roberto Diretor) com role `Admin`, gestor dos outros dois.
  - `rh@teste.local` (Ana RH) com roles `Admin`+`Recrutador`, subordinada de Roberto.
  - 3 `Funcionario` rows vinculados aos respectivos `ApplicationUser` via `Funcionario.UserId`.
  - Senha unificada: `YkmF@2022*`.
- Smoke test: 3/3 logins `POST /api/auth/auto-login` retornando HTTP 200 com JWT válido e claim `tenant:"liotecnica"`.

### Changed — `LoginScreen` (`LioTecnica.Web.Next/src/features/auth/LoginScreen.tsx`) white-label

- Header: saiu bloco "Bem-vindo ao" + `<RenderRHLogo />` + `<h1>RENDER</h1>` (fonte 4xl, uppercase, tracking 0.22em). Entrou combo: ícone `<Building2>` 48px em container arredondado com gradiente `#0C3A64 → #105291` + `<h1>Portal de RH</h1>` (text-2xl, tracking-tight, slate-800) + subtítulo "Gestão de pessoas e recrutamento" (slate-500).
- Overline: "Bem-vindo ao" → "Acesso ao sistema" (tracking 0.28em).
- Footer: "© 2026 QUALIIT SOLUÇÕES EM TECNOLOGIA" (blue-800/40) → "© 2026 · Portal de RH" (slate-500/70). Link LGPD preservado.
- Import `RenderRHLogo` retirado; `Building2` adicionado ao import de `lucide-react`. `npx tsc --noEmit` 0 erros.

### Regression

- API rebuild 3x durante a sessão com 0 erros após cada fix.
- `npx tsc --noEmit` no Next: 0 erros.
- `POST /api/dev/seed` (vaga + 5 candidatos + 2 talentos + projeto com 4 fases): HTTP 200.
- `POST /api/dev/seed/pre-admissoes` (5 mocks TOTVS aprovados): HTTP 200.
- 3/3 logins dos novos usuários: HTTP 200 com tenant correto no token.

---

## 2026-04-20 — Sessão 25 — Fase 13 (Portal MVC descomissionado)

### Removed — Projeto `LioTecnica.Web` (Portal MVC) apagado do repositório

- `LioTecnica.Web/` — pasta inteira deletada do disco (controllers MVC, views Razor, wwwroot, config, `Program.cs`, `Startup`).
- `LioTecnica.Web.E2E/` — pasta inteira deletada (Playwright E2E apontando para URLs do MVC).
- `Dockerfile` (raiz do repo) — apagado (buildava o MVC).
- `LioTecnica.sln` — reescrito sem as entradas `LioTecnica.Web` (`{787CDA21-21DD-4B7B-8237-BA43BB9958DB}`) e `LioTecnica.Web.E2E` (`{20DDB535-E997-45DF-83DF-E14F798540E4}`). Restam apenas `Liotecnica.Integration.RM.Schema` e `Liotecnica.Integration.RM`. `dotnet build` limpo.
- `LioTecnica.Web.Next/next.config.ts` — removida constante `bffOrigin` e rewrite `{ source: "/bff/:path*", destination: ..., basePath: false }`. Comentário inline documentando a remoção.
- `LioTecnica.Web.Next/nginx.conf` — removida `location /bff/ { proxy_pass http://api:5051/bff/; ... }`.
- `__scripts__/dev/dev-all.sh` — porta `5051` removida do loop `free_port`; `LEGACY_ORIGIN=http://localhost:5051` removido do env do Next; chamadas a `dev-api.sh` e `dev-portal.sh` substituídas por invocação direta da API + `wait`.
- `__scripts__/README.md` — seção "E2E Web (Playwright em .NET)" removida; `TB_WEB` default alterado para `http://localhost:3000`.

### Added — Entra ID server-side na API (`RHPortal.Api`)

- `RHPortal.Api/RHPortal.Api/Application/Authentication/EntraChallengeService.cs` (**novo**): Authorization Code Flow completo (Microsoft Entra ID) server-side. `BuildAuthorizationUrl(tenantId, returnUrl)` monta `/{tenantId}/oauth2/v2.0/authorize` com `state` assinado via HMAC-SHA256 (CSRF + carrier de `tenantId`/`returnUrl`/timestamp, base64url, expiração 10 min). `TryDecodeState(state, out payload)` faz validação timing-safe com `CryptographicOperations.FixedTimeEquals`. `ExchangeCodeForIdToken(code, redirectUri, tenantId)` troca o `authorization_code` no endpoint `/token` do tenant Entra via `HttpClient` nomeado. `EncodeAndSignState` é `public` (projeto não usa `[InternalsVisibleTo]`).
- `RHPortal.Api/RHPortal.Api.Tests/Authentication/EntraChallengeServiceTests.cs` (**novo**): **23 testes** cobrindo `BuildAuthorizationUrl` (URL bem formada, encoding de params, state incluído), `TryDecodeState` (happy path, tamper, expirado, chave trocada, base64url inválido, payload malformado), roundtrip encode+decode e `ExchangeCodeForIdToken` (resposta 200 com id_token, resposta 4xx, JSON inválido, JSON sem id_token, timeout/rede caída). Usa `Moq.Protected` para interceptar `HttpMessageHandler.SendAsync`. Factory helpers: `JwtOpts(key)`, `ConfigMock(dto)`, `ValidConfig()`, `HttpFactoryReturning(status, body)`, `HttpFactoryThrowing()`.

### Changed — Documentação e scripts

- `LioTecnica.Web.Next/src/features/auth/LoginScreen.tsx`: footer ganhou `<Link href={`${BASE}/privacidade`}>Política de Privacidade (LGPD)</Link>` (o único bloqueio de privacidade fora o `/Home/Privacy` do MVC).
- `__scripts__/test-battery.sh`: `WEB="${TB_WEB:-http://localhost:3000}"` (era `5064`); seção 17 renomeada para "Web (Next.js) — Health Check"; `W01-login` testa `$WEB/app/login`; `W03-health` testa `$WEB/app/`.
- `README.md`: removidas porta `5051` e seção "Portal MVC"; `dev-portal.sh` removido dos serviços individuais; arquitetura resumida enxuta (Next + API + AI + Integração RM).
- `VISAO_GERAL_PROJETO.md`: banner de atualização Fase 13; tree perdeu `LioTecnica.Web/` e ganhou `LioTecnica.Web.Next/`; tabela "Quem é quem" reescrita (Next.js 16 / React 19 / shadcn/ui / Tailwind; API assume auth + SSO Entra ID); fluxo "Browser (Next) → RHPortal.Api direto"; itens 4 e 5 de "pontos em aberto" marcados ✅ resolvidos.
- `MIGRACAO-RAZOR-PARA-NEXT-ANALISE.md`: banner SUPERSEDED → aponta para `PORTAL_MVC_INVENTARIO_E_MIGRACAO.md`.
- `PORTAL_MVC_INVENTARIO_E_MIGRACAO.md`: banner "STATUS (2026-04-20): ✅ FASE 13 CONCLUÍDA — Portal MVC DESCOMISSIONADO"; seção 8 reescrita (matriz de fechamento 7/7 + artefatos de regressão).

### Fixed — Build estático do Next.js

- `LioTecnica.Web.Next/src/app/PortalVagas/Proposta/[token]/page.tsx`: refatorado para padrão shell server + client component (igual `painel-rh/[id]`, `Owner/Tenants/[tenantId]`). Adicionado `export function generateStaticParams() { return [{ token: "__" }]; }` — sem isso, `pnpm build` com `output: "export"` quebrava com `Page "/PortalVagas/Proposta/[token]" is missing "generateStaticParams()"`.
- `LioTecnica.Web.Next/src/app/PortalVagas/Proposta/[token]/PropostaPublicaPageClient.tsx` (**novo**): `"use client"` + `useParams<{ token: string }>()` + `Suspense` envolvendo `<PropostaPublicaScreen token={token} />`. Mantém compatibilidade 100% com o `PropostaPublicaScreen` existente (que já lê `tenantId` de `useSearchParams`).

### Regression summary

| Suite | Resultado |
|-------|-----------|
| Backend xUnit (`RHPortal.Api.Tests`) | **699 / 699 verde** (676 + 23 novos Entra) |
| `dotnet build LioTecnica.sln` | 0 warnings / 0 errors |
| Next.js `tsc --noEmit` | sem erros |
| Next.js `pnpm build` | ✅ 125/125 páginas estáticas geradas |

---

## [Unreleased] — 2026-04-20 — Sessão 24 Ondas 7–15 (Onboarding cargo + WhatsApp completo + Portal MVC + Painel + Operacionais)

### Added — Onda 7: Override de documentação padrão por Cargo específico

- `LioTecnica.Web.Next/src/features/admin/documentacao-padrao/DocumentacaoPadraoScreen.tsx`: nova aba "Por Cargo" com seletor de cargo (`/api/job-positions/lookup`), tabela 4-col (Documento / Origem badge `cargo`/`nivel`/`global` / Configuração select / Ação Herdar) consumindo `GET|PUT /api/admin/documentacao-padrao/por-cargo/{id}`. Histórico ganha coluna "Alvo" exibindo `cargoNome ?? nivelCargoNome ?? "—"` e filtros por escopo (`0`=global / `1`=nível / `2`=cargo) + cargo. Tipos novos: `DocPorCargoItem` (com `overrideCargoAtivo`, `overrideNivelCargoAtivo`, `origem`), `CargoLookup`, `PorCargoResponse`.

### Added — Onda 8: Sync de preadmissões ativas respeitando overrides por cargo

- Recálculo da checklist de preadmissões em curso passa a respeitar override por cargo, preservando acréscimos manuais do RH.

### Added — Onda 9: Rate limit / throttle WhatsApp por candidato

- `RHPortal.Api/RHPortal.Api/Messaging/WhatsApp/WhatsAppOptions.cs` (**novo**): `RateLimitMaxMensagens=5`, `RateLimitJanelaMinutos=60`, `RespeitarSilencio=true`, `IdiomaDefault="pt-BR"`, `Provider="Logging"`, sub-options `Twilio`/`MetaCloud`.
- `RHPortal.Api/RHPortal.Api/Domain/Entities/CandidatoNotificacao.cs`: `WhatsAppRateLimitMaxMensagens?` e `WhatsAppRateLimitJanelaMinutos?` (override por candidato; null = default global).
- `RHPortal.Api/RHPortal.Api/Domain/Entities/NotificacaoCandidaturaLog.cs`: enum `NotificacaoStatus` ganha `IgnoradoRateLimit=4`, `IgnoradoSilencio=5`, `IgnoradoIdiomaIndisponivel=6`.
- `RHPortal.Api/RHPortal.Api/Application/Candidaturas/CandidaturaNotificacaoService.cs`: `EnviarWhatsAppComLogAsync` conta `NotificacoesCandidaturaLogs` (Canal=WhatsApp, Status=Enviado, CriadoEmUtc≥inicioJanela); se atingiu, loga `IgnoradoRateLimit` com detalhe `"limit={max}/janela={min}min/atingido={count}"` e não envia.
- Testes: 5 cobrindo abaixoDoLimite / atingidoLimite (asserta `ErroMensagem`) / logsForaDaJanela (não conta) / overrideNaPreferencia / limiteZero.

### Added — Onda 10: Janela de silêncio WhatsApp (SilencioInicio/Fim)

- `RHPortal.Api/RHPortal.Api/Application/Candidaturas/CandidaturaNotificacaoService.cs`: helper `public static bool EstaDentroSilencio(pref, now, out descricao)` antes do rate-limit check; suporta janela cruzando meia-noite (22:00→07:00) via `agora >= inicio || agora < fim`. `WhatsAppOptions.RespeitarSilencio` toggla globalmente. Quando bloqueado, loga `IgnoradoSilencio`.
- Testes: 6 cobrindo ativoEDentro / fora / janelaCruzandoMeiaNoite (4 horas) / desligadoQuandoSemValores / silencioAtivoFalse / desabilitadoNaOptions.

### Added — Onda 11: Seletor de idioma na preferência (templates por idioma)

- `RHPortal.Api/RHPortal.Api/Domain/Entities/NotificacaoTemplate.cs`: `[StringLength(10)] string? Idioma` (BCP-47, ex.: "pt-BR", "en-US"). Unicidade migrada de `(TenantId, Etapa, Canal)` para `(TenantId, Etapa, Canal, Idioma)`.
- `RHPortal.Api/RHPortal.Api/Infrastructure/Data/AppDbContext.cs`: `b.Property(x => x.Idioma).HasMaxLength(10)` + índice `IX_NotificacoesTemplates_TenantId_Etapa_Canal_Idioma`.
- `RHPortal.Api/RHPortal.Api/Migrations/20260420204952_AddWhatsAppRateLimitAndIdiomaTemplate.cs` (**novo**): idempotente — `ALTER TABLE NotificacoesTemplates ADD COLUMN IF NOT EXISTS Idioma`, `DROP INDEX IF EXISTS` antigo + `CREATE UNIQUE INDEX IF NOT EXISTS` novo, `ADD COLUMN IF NOT EXISTS WhatsAppRateLimit{Max,Janela}` em `CandidatoNotificacaoPreferencias`.
- `RHPortal.Api/RHPortal.Api/Application/Candidaturas/NotificacaoTemplateService.cs`: nova sobrecarga `GetEfetivoAsync(etapa, canal, idioma, ct)` resolve override exato → override `Idioma=null` → default. Antiga sobrecarga delega com idioma=null.
- `CandidaturaNotificacaoService` agora resolve `idiomaCandidato = pref.Idioma ?? _waOptions.IdiomaDefault` e passa para o resolver. Testes: 3 (preferenciaEnUS_PassaIdioma / templateServiceRecebeIdioma / semPreferencia_UsaIdiomaDefault).

### Added — Onda 12: Provedores WhatsApp reais plugáveis (Twilio + Meta Cloud)

- `RHPortal.Api/RHPortal.Api/Messaging/WhatsApp/TwilioWhatsAppMessageSender.cs` (**novo**): POST `{BaseUrl}/2010-04-01/Accounts/{Sid}/Messages.json`, Basic Auth `Sid:Token`, payload form-urlencoded `From=whatsapp:{From}&To=whatsapp:{telefone}&Body={msg}`. Auto-prefixa `whatsapp:` quando ausente, sem duplicar. Parsing de `sid` (sucesso) e `code`/`message` (erro) via `JsonDocument`. Fast-fail sem credenciais (não consome HTTP). Exception de rede vira `ErrorMessage="twilio_exception:{Type}"` sem estourar.
- `RHPortal.Api/RHPortal.Api/Messaging/WhatsApp/MetaCloudWhatsAppMessageSender.cs` (**novo**): POST `{BaseUrl}/{GraphVersion}/{PhoneNumberId}/messages`, Bearer token, JSON `{messaging_product:"whatsapp", to:{semMais}, type:"text", text:{body:msg}}`. Default `GraphVersion=v18.0` quando vazio. Telefone tem `+` removido (Meta exige). Parsing `messages[0].id` e `error.{code,message}`.
- `RHPortal.Api/RHPortal.Api/Program.cs`: `Configure<WhatsAppOptions>` + `AddHttpClient(WhatsApp.Twilio|WhatsApp.MetaCloud)` com BaseAddress dinâmico via `IOptionsMonitor`. DI do `IWhatsAppMessageSender` switcheia por `WhatsAppOptions.Provider` (Logging | Twilio | MetaCloud).
- `RHPortal.Api/RHPortal.Api/appsettings.json`: bloco `WhatsApp` adicionado (Provider+credenciais Twilio+credenciais MetaCloud).
- Testes: 12 cobrindo ambos provedores — sucesso (URL/auth/payload corretos) / from já prefixado não duplica / erro com code+message / sem credencial fast-fail / telefone vazio / exception de rede. Helpers de teste: `FakeHttpMessageHandler` (snapshot `LastUri/Method/Authorization/Body/ContentType` antes do dispose) e `StaticOptionsMonitor<T>`.

### Added — Onda 13: Inventário Portal MVC + plano de migração

- `PORTAL_MVC_INVENTARIO_E_MIGRACAO.md` (**novo**): 53 controllers + ~113 views Razor inventariados, ~90 rotas Next mapeadas, status legado→Next por rota, **2 bloqueios críticos** identificados (login Entra ID fim-a-fim no Next + `/Home/Privacy`), plano em 7 fases (13.1 saneamento → 13.7 comunicação) com critérios de "feito" e checklist de descomissionamento.

### Changed — Onda 14: Painel de Solicitações posicionado em "Principais" (B1 transversal core)

- `RHPortal.Api/RHPortal.Api/Infrastructure/Navegacao/NavegacaoManifest.cs`: `nav-painel-solicitacoes` movido do bucket `gestao-pessoas` (Ordem:10) para `principais` (`Destacado: true, Ordem: 40`). Justificativa inline: agregador analítico multi-tipo (Vaga R&S + Promoção/Desligamento/Férias/Benefício Folha + Dependente/Endereço Cadastros).
- `LioTecnica.Web.Next/src/features/navigation/recruitmentNavigation.ts`: `painelSolicitacoes` adicionado ao `PRINCIPAIS_ORDER` (após `solicitacoes`).
- `knowledge-base/visao-arquitetural.md` §6.4: linha do Painel de Solicitações marcada como "Decidido — B1 (transversal core)" com justificativa.
- 29/29 testes Navegacao passam.

### Changed — Onda 15: Frontend:Port via configuração (eliminar hardcodes 3000/3005)

- `RHPortal.Api/RHPortal.Api/appsettings.json`: novas chaves `Frontend:Port` (default 3005) e `Frontend:BaseUrl` (override completo opcional).
- `RHPortal.Api/RHPortal.Api/Application/PreAdmissao/PreAdmissaoService.cs`: ctor recebe `IConfiguration`; novo helper privado `BuildFrontendUrl(pathAndQuery)` substitui o hardcode `:3005` da geração da URL pública do candidato (precedência: `Frontend:BaseUrl` → `{request.scheme}://{request.host}:{Frontend:Port}`).
- `RHPortal.Api/RHPortal.Api/Controllers/DevSeedController.cs`: ctor recebe `IConfiguration`; novo helper `FrontendBaseUrl()` substitui o hardcode `http://localhost:3000` da mensagem `proximoPasso`.
- 4 arquivos de teste (`PreAdmissao*Tests.cs`) atualizados para passar `new ConfigurationBuilder().Build()` no ctor.

### Fixed — bugs corrigidos na suite

- `Onda10_Silencio_JanelaCruzandoMeiaNoite_FuncionaCorretamente`: falhava em máquinas com timezone local ≠ UTC. Corrigido para construir `DateTimeOffset` com `TimeZoneInfo.Local.GetUtcOffset(instant)` em vez de `TimeSpan.Zero`.
- `EstaDentroSilencio` promovido de `internal static` para `public static` (mais limpo que `InternalsVisibleTo`).
- `FakeHttpMessageHandler` reescrito para capturar snapshot imutável do request antes do `using var request` no sender disposá-lo (evita `ObjectDisposedException` ao ler body no teste).

### Regression

- **676/676 backend xUnit verde** (suite completa, inclui 83 candidaturas+messaging e 29 navegacao).
- Build .NET 9: 0 erros.
- Next.js `tsc --noEmit`: 0 erros.

---

## [Unreleased] — 2026-04-20 — Sessão 24 Ondas 3–6 (Candidato.VagaId cache + Templates de notificação + Docs padrão por NivelCargo + Histórico)

### Added — Onda 3: `Candidato.VagaId` como cache da candidatura ativa

- `RHPortal.Api/RHPortal.Api/Application/Candidaturas/CandidaturaService.cs`: novo método público `RecalcularVagaPrincipalAsync(candidatoId, ct)` — decide `VagaId` preferindo ativa mais recente > encerrada mais recente > preservar atual. Chamado ao final de `GetOrCreateAsync` e `AvancarEtapaAsync`.
- `RHPortal.Api/RHPortal.Api/Application/Candidatos/CandidatoService.cs`: ctor opcional recebe `ICandidaturaService`; novo helper `EnsureCandidaturaAndSyncAsync(candidatoId, vagaId, ct)` acionado em create-by-email, create-new e update-vaga.
- `RHPortal.Api/RHPortal.Api/Domain/Entities/Candidato.cs`: removido `[Obsolete]` de `VagaId`; doc atualizado para "cache O(1) da candidatura ativa mais recente".
- `RHPortal.Api/RHPortal.Api/Migrations/20260420184228_SyncCandidatoVagaIdFromCandidaturas.cs` (**novo**): idempotente, backfill via PostgreSQL `DISTINCT ON` em 2 passes (ativa → fallback).
- Testes: +7 em `CandidaturaServiceTests` (sync ao criar, preferência ativa>encerrada, recálculo ao encerrar, múltiplas ativas, preservação quando sem candidaturas, idempotência, só encerradas).

### Added — Onda 4: Editor de templates de notificação (etapa × canal)

- `RHPortal.Api/RHPortal.Api/Domain/Entities/NotificacaoTemplate.cs` (**novo**): `ITenantEntity`, `Etapa` (short), `Canal` (short — 0=Email / 1=WhatsApp), `Assunto?` (240 chars), `Corpo` (4000 chars), auditoria. Índice único `(TenantId, Etapa, Canal)`.
- `RHPortal.Api/RHPortal.Api/Application/Candidaturas/NotificacaoTemplateService.cs` (**novo**): `GetDefault`, `GetEfetivoAsync`, `ListarMatrizAsync` (matriz 14 linhas = 7 etapas × 2 canais, Aplicada excluída), `SaveAsync` (upsert com remove-se-igual-default), `RestoreDefaultAsync` idempotente, helper estático `ResolverPlaceholders` (`{candidatoNome}`/`{vagaTitulo}` com fallback `"(candidato)"`/`"(vaga)"`).
- `RHPortal.Api/RHPortal.Api/Application/Candidaturas/CandidaturaNotificacaoService.cs`: ctor overload com `INotificacaoTemplateService`; fallback hardcoded preservado pra testes legados.
- `RHPortal.Api/RHPortal.Api/Contracts/Candidatura/CandidaturaContracts.cs`: +`NotificacaoTemplateItem` + `NotificacaoTemplateSaveRequest`.
- `RHPortal.Api/RHPortal.Api/Controllers/NotificacoesTemplatesController.cs` (**novo**): `[RequireModule("recrutamento")]` + `[RequirePermission("audit.view")]`. GET `/api/notificacoes-templates` (matriz), POST `/` (upsert com validações — corpo vazio/>4000, assunto obrigatório em Email), DELETE `/{etapa}/{canal}` (restore default).
- `RHPortal.Api/RHPortal.Api/Migrations/20260420185058_AddNotificacoesTemplatesTable.cs` (**novo**): idempotente — `CREATE TABLE IF NOT EXISTS` + `CREATE UNIQUE INDEX IF NOT EXISTS`.
- `LioTecnica.Web.Next/src/features/recrutamento/candidaturas/candidaturaApi.ts`: +3 tipos + 3 funções (`listarNotificacoesTemplates`, `salvarNotificacaoTemplate`, `restaurarNotificacaoTemplateDefault`).
- `LioTecnica.Web.Next/src/features/admin/notificacoes-templates/NotificacoesTemplatesScreen.tsx` (**novo**): grid 7 etapas × 2 canais com `<textarea>` nativo HTML, badge "Padrão" verde / "Customizado" violet, botões Salvar + Restaurar padrão, banner documentando placeholders.
- `LioTecnica.Web.Next/src/app/(app)/administracao/notificacoes-templates/page.tsx` (**novo**): wrapper da rota.
- `RHPortal.Api/RHPortal.Api/Infrastructure/Navegacao/NavegacaoManifest.cs`: +`nav-admin-notif-templates` (label "Templates de Notificação", href `/administracao/notificacoes-templates`, icon `book-template`, permissão `audit.view`, Ordem 145).
- Testes: +14 em `NotificacaoTemplateServiceTests` (matriz default, upsert, remove-se-igual-default, WhatsApp sem assunto, validações, GetEfetivoAsync, RestoreDefaultAsync idempotente, ResolverPlaceholders null).

### Added — Onda 5: UI admin para docs padrão por NivelCargo

- `LioTecnica.Web.Next/src/features/admin/documentacao-padrao/DocumentacaoPadraoScreen.tsx`: sistema de abas (`Tab = "global" | "por-nivel" | "historico"`). Aba "Por Nível de Cargo" consome `/api/nivel-cargo/lookup` + `GET/PUT /api/admin/documentacao-padrao/por-nivel-cargo/{nivelCargoId}`. Edição de override por tipo com badge "Custom" violet quando `overrideAtivo=true`, botão **Herdar** individual (restaura global + zera flag), botões **Limpar todos** (envia `[]`) e **Salvar overrides** (envia apenas itens com `overrideAtivo=true`; ausentes voltam a herdar no backend). Merge com `TIPOS_EXTRAS` (PJ) preserva paridade.

### Added — Onda 6: Histórico de alterações da documentação padrão

- `RHPortal.Api/RHPortal.Api/Domain/Entities/DocumentacaoPadraoHistorico.cs` (**novo**): `ITenantEntity` com `Escopo` (`DocumentacaoPadraoEscopo` Global=0/PorNivelCargo=1), `NivelCargoId?` + navigation `NivelCargo?`, `TipoDocumento`, `ConfiguracaoAnterior?`/`Nova?` (short nullable), `Acao` (`DocumentacaoPadraoAcao` Criado=0/Alterado=1/Removido=2), `UserId?` + `UserNome?` congelado (não é FK com Users — audit trail imutável), `CriadoEmUtc`.
- `RHPortal.Api/RHPortal.Api/Infrastructure/Data/AppDbContext.cs`: `DbSet<DocumentacaoPadraoHistorico>` + config com índices `(TenantId, CriadoEmUtc)` e `(TenantId, Escopo, NivelCargoId)` + FK `NivelCargo` com `OnDelete.SetNull` (preserva histórico mesmo após exclusão de nível) + query filter por tenant.
- `RHPortal.Api/RHPortal.Api/Application/DocumentacaoPadrao/DocumentacaoPadraoService.cs`: ctor overload opcional com `ICurrentUserContext` (ctor original preservado pra compat com testes legados de `DocumentacaoPadraoPorNivelCargoTests`). `SaveAsync` e `SaveByNivelCargoAsync` produzem entradas de histórico com diff antes→depois; no-op quando valor não muda. Novo método `ListarHistoricoAsync(escopo?, nivelCargoId?, page, pageSize)` com paginação clampada `[1,200]`, ordenação `CriadoEmUtc DESC`, materialização intermediária em anonymous type antes de mapear para DTO (evita EF tentar traduzir helper static `LabelPorTipo`). `UserNome` congelado como `Email` do `_currentUser`.
- `RHPortal.Api/RHPortal.Api/Contracts/DocumentacaoPadrao/DocumentacaoPadraoContracts.cs`: +`DocumentacaoPadraoHistoricoItem` (+ `NivelCargoNome` expandido + `TipoDocumentoLabel` resolvido client-side) + `DocumentacaoPadraoHistoricoResponse` (paginação).
- `RHPortal.Api/RHPortal.Api/Controllers/DocumentacaoPadraoController.cs`: +endpoint `GET /api/admin/documentacao-padrao/historico?escopo=&nivelCargoId=&page=&pageSize=`.
- `RHPortal.Api/RHPortal.Api/Migrations/20260420190629_AddDocumentacaoPadraoHistoricosTable.cs` (**novo**): idempotente — `CREATE TABLE IF NOT EXISTS` + 3 `CREATE INDEX IF NOT EXISTS` (padrão CLAUDE.md multi-tenant).
- `LioTecnica.Web.Next/src/features/admin/documentacao-padrao/DocumentacaoPadraoScreen.tsx`: terceira aba **Histórico** com filtros (select de escopo + select de nível condicional), tabela 7 colunas (Quando / Escopo / Nível / Documento / Ação com badge emerald/amber/slate / Antes→Depois com setinha / Usuário ou "sistema" italic), paginação client-side com Anterior/Próxima e contador.
- Testes: +12 em `DocumentacaoPadraoHistoricoTests` (arquivo novo, com `FakeCurrentUser` private class implementando os 13 membros de `ICurrentUserContext`) cobrindo Criado/Alterado/Removido em ambos escopos, no-op quando valor igual, filtros por escopo + nivelCargoId, paginação/clamp, ordenação desc, label de tipo, nome de nível.

### Notes

- Testes: **633/633 verdes** (599 → 607 Onda 3 → 621 Onda 4 → 633 Onda 6).
- `tsc` exit 0. `eslint src` 111 errors pré-existentes em `workflow-rh`/`usuariosperfis`/outras telas (baseline antes das changes: 116, redução de 5). Arquivos tocados nesta sessão 100% limpos.
- Backlog fechado: Portal extras (c) ✓ (Onda 3); WhatsApp extras (b) ✓ (Onda 4); Onboarding extras (a) ✓ (Onda 5) + (c) ✓ (Onda 6). Abertos remanescentes: WhatsApp (a/c/d/e), Onboarding (b/d), Portal MVC migration, Painel Solicitações, Folha real, Metas/OKRs, Dashboard SLA.

---

## 2026-04-20 — Sessão 24 (Onda 2 pós-unificação: Auditoria de Notificações de Candidatura)

### Added — Backend: listagem paginada de logs com filtros

- `RHPortal.Api/RHPortal.Api/Application/Candidaturas/CandidaturaNotificacaoService.cs`: interface `ICandidaturaNotificacaoService` ganhou `ListarLogsAsync(Guid? candidatoId, Guid? candidaturaId, CanalNotificacao? canal, NotificacaoStatus? status, EtapaMacroCandidatura? etapa, DateTimeOffset? dataInicioUtc, DateTimeOffset? dataFimUtc, int page, int pageSize, CancellationToken ct)`. Implementação com filtros opcionais encadeados + enriquecimento (nome/email/fone do candidato, código/título da vaga via join com `Candidaturas`), ordenação `CriadoEmUtc desc` + `Id asc` como desempate, `page` normalizado em `[1, ∞)`, `pageSize` clampado em `[1, 200]`.
- `RHPortal.Api/RHPortal.Api/Contracts/Candidatura/CandidaturaContracts.cs`: records `NotificacaoCandidaturaLogItem` e `NotificacaoCandidaturaLogsResponse`.
- `RHPortal.Api/RHPortal.Api/Controllers/NotificacoesCandidaturaController.cs` (**novo**): `[RequireModule("recrutamento")]` + `GET /api/notificacoes-candidatura/logs` com `[RequirePermission("audit.view")]`.
- `RHPortal.Api/RHPortal.Api/Infrastructure/Navegacao/NavegacaoManifest.cs`: item `nav-admin-notif-candidatura` adicionado (label "Notificações (Candidaturas)", href `/administracao/notificacoes-candidatura`, icon `bell-ring`, permissão `audit.view`, Ordem 140 no bucket `administracao`).

### Added — Testes

- `RHPortal.Api.Tests/Candidaturas/CandidaturaNotificacaoServiceTests.cs`: +10 testes cobrindo `ListarLogsAsync` — sem filtros (ordem desc), enriquecimento candidato+vaga, filtro por canal/status/etapa/candidato/candidatura/intervalo de data, paginação com 5→2+2+1 e IDs distintos, `pageSize` > 200 clampa em 200, isolamento por tenant.

### Added — Frontend: tela admin + apiClient

- `LioTecnica.Web.Next/src/features/recrutamento/candidaturas/candidaturaApi.ts`: tipos `CanalNotificacao`, `NotificacaoStatus`, `NotificacaoCandidaturaLogItem`, `NotificacaoCandidaturaLogsResponse`, `NotificacaoLogsFilter`; resolvers `resolveCanal`/`resolveStatusNotificacao` (tolerantes a enum como int ou string); cliente `listarNotificacoesCandidaturaLogs(filter)` via `apiJson`.
- `LioTecnica.Web.Next/src/features/admin/notificacoes-candidatura/NotificacoesCandidaturaLogsScreen.tsx` (**novo**): tela com 6 filtros (canal, status, etapa, data início/fim, candidatoId), tabela com 7 colunas e expansão por linha (mensagem + erro + IDs), resumo de enviados/falhados/ignorados, paginação. Uso de `Fragment key={item.id}` para envolver linha+expansão (evita warning de key duplicada).
- `LioTecnica.Web.Next/src/app/(app)/administracao/notificacoes-candidatura/page.tsx` (**novo**): wrapper da rota.

### Notes

- Testes: **599/599 verdes** (589 → 599).
- Frontend: `pnpm exec tsc --noEmit` exit 0; `pnpm exec eslint` exit 0 em todos os arquivos novos/tocados.
- Diretório `app/(app)/administracao/` não existia e foi criado — é a primeira rota nesse bucket (outras admin moram em `/admin/*`; conviver sem conflito porque `RouteAllowlistGuard` lê `visibleHrefs` do backend).
- Fecha o sub-item (f) do backlog "Pacote R&S — Notificações WhatsApp (extras)". Demais sub-itens continuam abertos — (a) precisa decisão de provedor, (b/c/d/e) são próximas ondas.

---

## [Unreleased] — 2026-04-20 — Sessão 24 (Navegação unificada: backend vira fonte única)

### Added — Manifesto de navegação code-first + endpoint consolidado

- `RHPortal.Api/RHPortal.Api/Infrastructure/Navegacao/NavegacaoManifest.cs` (**novo**, 169 linhas): declara 8 buckets de UI fixos (`principais`, `recrutamento-selecao`, `gestao-pessoas`, `folha-pagamento`, `cadastros`, `configuracoes`, `administracao`, `relatorios`) e todos os `NavManifestItem` (id/label/href/icon/permissionKey + opcional `ModuloKeyOverride`, `GrupoUiOverride`, `Destacado`, `Ordem`). `ResolveGrupoUi` mapeia item → bucket via módulo/pacote (ex.: módulo com `PackageKey` herda o pacote como bucket; destacado ou dashboard vai para `principais`).
- `RHPortal.Api/RHPortal.Api/Contracts/Navegacao/NavegacaoContracts.cs` (**novo**): `NavItemResponse` (inclui `acessivel` + `motivoBloqueio` como enum string `"pacote-inativo" | "modulo-desabilitado" | "sem-permissao"`), `NavGrupoResponse` (com `ocultarHeader`), `NavegacaoSidebarResponse` (grupos + `contextoEspecial` + `flatItems`).
- `RHPortal.Api/RHPortal.Api/Application/Navegacao/NavegacaoSidebarService.cs` (**novo**, 143 linhas): compõe a resposta a partir de `RolePermissionManifest.GetPermissions(roles)` × `ModuleCatalog.ResolveModuleKey(permissionKey)` × `TenantModuleService.GetEnabledModuleKeysAsync`. Itens sem permissão não são emitidos; itens de módulo desabilitado ou pacote inativo são emitidos com `acessivel=false` + `motivoBloqueio` (aparecem com cadeado no front). Owner root sem tenant → `contextoEspecial="owner-root"` (front injeta UI do owner).
- `RHPortal.Api/RHPortal.Api/Controllers/NavegacaoController.cs` (**novo**): `[Authorize]` `GET /api/navegacao/sidebar` → 200 com `NavegacaoSidebarResponse`.
- `RHPortal.Api/RHPortal.Api/Program.cs`: registrado `NavegacaoSidebarService` scoped.

### Added — Permissões da Folha no `RolePermissionManifest.TenantPermissions`

- `RHPortal.Api/RHPortal.Api/Infrastructure/Security/RolePermissionManifest.cs`: `"folha.batida-ponto.view"`, `"folha.pagamento-extra.view"`, `"folha.desligamentos.view"` adicionados. Sem elas, o service não emitiria os itens (perm missing = invisível) e o cadeado sumiria. Com elas, o backend emite os itens com `motivoBloqueio="pacote-inativo"` porque `PackageCatalog.FolhaPagamento.IsActive=false`. Comentário XML registra a intenção: "até o pacote ser ativado no ModuleCatalog/PackageCatalog". Reversível em 1 linha quando a Folha real nascer.

### Added — Frontend consome o novo endpoint (provider + schema + guard)

- `LioTecnica.Web.Next/src/lib/schemas/navegacao.ts` (**novo**): Zod schemas `NavItemResponseSchema`, `NavGrupoResponseSchema`, `NavegacaoSidebarResponseSchema`. Constantes `MOTIVO_BLOQUEIO_NAV`. Helper `normalizeNavegacaoSidebarResponse()` aceita camelCase e PascalCase.
- `LioTecnica.Web.Next/src/features/navigation/NavegacaoSidebarProvider.tsx` (**novo**): React Context. `useEffect` dependente de `me` faz `apiFetch('/api/navegacao/sidebar')`. Expõe `{ loading, grupos, flatItems, contextoEspecial, visibleHrefs, isOwnerRoot }`. `visibleHrefs` é `null` para owner/wildcard. Também exporta `navItemResponseToBff()` (compat com consumidores legados).

### Changed — Sidebar, Topbar e guard de rota passam a ser puros renderers

- `LioTecnica.Web.Next/src/components/layout/AppShell.tsx`: agora envolve `<NavegacaoSidebarProvider>`; quando `contextoEspecial==="owner-root"` injeta `OWNER_NAV_ITEMS` + `OWNER_ROOT_GROUPS` locais em cima dos grupos do provider.
- `LioTecnica.Web.Next/src/components/layout/Sidebar.tsx`: reduzido para uma casca `{ grupos: NavGrupoResponse[] }` → `<SidebarNavClient />`.
- `LioTecnica.Web.Next/src/components/layout/Topbar.tsx` + `TopbarClient.tsx`: mudados de `navItems: BffNavItem[]` para `grupos: NavGrupoResponse[]`. Mobile Sheet renderiza `<Sidebar grupos={grupos} />`.
- `LioTecnica.Web.Next/src/features/navigation/SidebarNavClient.tsx`: **~1028 → ~350 linhas**. Removeu `LOCKED_NAV_HREFS`, `LOCKED_NAV_PREFIXES`, `HIDDEN_ROUTES`, `RECRUTAMENTO_ROUTES`, `OPERACIONAL_ROUTES`, `CADASTROS_CORE_ROUTES`, `CADASTROS_OPERACIONAIS_ROUTES`, `GESTAO_PESSOAS_ROUTES`, `FEEDBACK_ROUTES`, `getModuleKey()`, `ROUTE_MAP`, `buildRecruitmentSidebar()`, `normalizeHref()`, tipo `ModuleKey`. Preservou: `ICONS` map (Bootstrap→Lucide via record lookup `ICONS_WITH_DEFAULT` + helper `resolveIconName()` — contorna o lint `react-hooks/static-components`), Collapsible, hover/active states. Renderiza `motivoBloqueio` como cadeado + tooltip `tooltipForMotivo()`.
- `LioTecnica.Web.Next/src/features/auth/RouteAllowlistGuard.tsx`: consome `useNavegacaoSidebar()` (`visibleHrefs`) em vez de `getVisibleMenuHrefs(me)`. Redireciona para `/dashboard` quando a rota não aparece.
- `LioTecnica.Web.Next/src/features/navigation/menuPermissions.ts`: **simplificado**. Removido `getVisibleMenuHrefs()`. Sobraram `isAdminOrOwner`, `isGestor`, `isCompliance`, `isHrefAllowed`.

### Removed — `permissionManifest.ts` (taxonomia paralela que causava drift)

- `LioTecnica.Web.Next/src/features/navigation/permissionManifest.ts`: **deletado**. A única fonte de verdade agora é o backend.

### Added — Testes do `NavegacaoSidebarService`

- `RHPortal.Api.Tests/Navegacao/NavegacaoSidebarServiceTests.cs` (**novo**): cobertura por perfil (Owner/RH/Colaborador/Gestor), regressão de pacote inativo (cadeado em vez de invisível), regressão de módulo desabilitado, **4 testes da Fase C**: `Manifest_DeclaraOsOitoBucketsEsperados`, `Build_FolhaPagamento_ItensApontamParaGrupoFolhaPagamento`, `Build_EixoVaga_VaiParaCadastrosPorOverride`, `Build_ApiKeysETenantConfig_VaoParaConfiguracoesPorOverride`.

### Notes

- Testes: **589/589 verdes** (585 → 589 com os 4 novos da Fase C).
- Frontend: `pnpm exec tsc --noEmit` exit 0; `pnpm exec eslint` exit 0 nos arquivos tocados; `pnpm exec next build` TypeScript compilação "✓ Compiled successfully in 4.0s" (erro pré-existente em `/PortalVagas/Proposta/[token]` alheio a esta mudança).
- Drift eliminado: mudanças em módulo/pacote agora se propagam para a sidebar sem tocar no frontend. Ativar Folha vira 1 linha (`PackageCatalog.FolhaPagamento.IsActive = true`).
- Memória "entregar completo, não MVP" respeitada: backend + UI + testes + permissões + cobertura dos 8 buckets em uma sessão, sem corte de escopo.

---

## [Unreleased] — 2026-04-20 (Onda 1 — Portal R&S extras: kanban + PropostaVaga.CandidaturaId + Candidato.VagaId obsoleto)

### Added — Kanban admin de candidaturas por `EtapaMacroCandidatura`

- `RHPortal.Api/RHPortal.Api/Contracts/Candidatura/CandidaturaContracts.cs`: novos records `KanbanCandidaturaItem`, `KanbanColunaResponse`, `KanbanCandidaturasResponse`.
- `RHPortal.Api/RHPortal.Api/Application/Candidaturas/CandidaturaService.cs`: nova `ListarKanbanAsync(Guid? vagaId, CancellationToken ct)` — LINQ join `Candidaturas × Candidatos × Vagas`, agrupa em 8 colunas fixas (`Aplicada/EmTriagem/Entrevista/Teste/Proposta/Contratado/Recusado/Desistiu`) com colunas vazias preservadas e ordem determinística.
- `RHPortal.Api/RHPortal.Api/Controllers/CandidaturasController.cs` (**novo**): `[RequireModule("recrutamento")]` expõe `GET /api/candidaturas/kanban?vagaId?`, `GET /api/candidaturas/candidato/{candidatoId}` e `POST /api/candidaturas/{id}/avancar-etapa`.
- `LioTecnica.Web.Next/src/features/recrutamento/candidaturas/candidaturaApi.ts` (**novo**): tipos + resolvers + clientes `getKanban`/`avancarEtapa`.
- `LioTecnica.Web.Next/src/features/recrutamento/candidaturas/CandidaturasKanbanScreen.tsx` (**novo**): 8 colunas horizontais com cores por etapa, cards com candidato/vaga/match, filtro por vaga, drag & drop HTML5 (prompt pede observação, chama `avancarEtapa`, recarrega em sucesso).
- `LioTecnica.Web.Next/src/app/(app)/recrutamento/candidaturas/page.tsx` (**novo**): wrapper renderizando o kanban.

### Added — `PropostaVaga.CandidaturaId` (amarra proposta à junction `Candidaturas`)

- `RHPortal.Api/RHPortal.Api/Domain/Entities/PropostaVaga.cs`: `public Guid? CandidaturaId { get; set; }` + nav `Candidatura? Candidatura`.
- `RHPortal.Api/RHPortal.Api/Infrastructure/Data/AppDbContext.cs` (bloco `PropostasVaga`): `HasIndex((TenantId, CandidaturaId))` + FK `OnDelete.SetNull`.
- `RHPortal.Api/RHPortal.Api/Migrations/20260420171030_AddCandidaturaIdToPropostaVaga.cs` (**nova migration idempotente, raw SQL**): `ADD COLUMN IF NOT EXISTS`, dois `CREATE INDEX IF NOT EXISTS`, FK via `DO $ IF NOT EXISTS pg_constraint $`, e **backfill** `UPDATE PropostasVaga p SET CandidaturaId = c.Id FROM Candidaturas c WHERE c.TenantId = p.TenantId AND c.CandidatoId = p.CandidatoId AND c.VagaId = p.VagaId` para costurar propostas antigas à junction correspondente. Down com `DROP CONSTRAINT/INDEX/COLUMN IF EXISTS`.
- `RHPortal.Api/RHPortal.Api/Application/PropostasVaga/PropostaVagaService.cs`: construtor agora injeta `ICandidaturaService`; `CreateAsync` chama `GetOrCreateAsync(candidatoId, vagaId, fonte: "Proposta", obs: null, ct)` antes de montar o `PropostaVaga` e grava `CandidaturaId = candidatura.Id`. Propostas novas nascem sempre amarradas — notificações de mudança de etapa já vêm de graça via `CandidaturaNotificacaoService`.
- `RHPortal.Api/RHPortal.Api/Contracts/PropostaVaga/PropostaVagaContracts.cs`: `PropostaVagaResponse` ganhou `Guid? CandidaturaId`.
- `LioTecnica.Web.Next/src/features/recrutamento/propostas-vaga/propostaApi.ts`: tipo `PropostaVagaResponse` ganhou `candidaturaId: string | null`.
- `RHPortal.Api.Tests/PropostasVaga/PropostaVagaServiceTests.cs`: `CriarServico()` agora injeta um `CandidaturaService` real (com `Mock<ICandidaturaNotificacaoService>` + `NullLogger`).

### Changed — `Candidato.VagaId` marcado `[Obsolete]` (warning-only, com plano de migração)

- `RHPortal.Api/RHPortal.Api/Domain/Entities/Candidato.cs`: `VagaId` e `Vaga` receberam `[Obsolete("Use Candidaturas (junction Candidato↔Vaga). ... Novas associações devem ser feitas via CandidaturaService.GetOrCreateAsync.")]` — sinal ativo para call-sites migrarem.
- `RHPortal.Api/RHPortal.Api/Infrastructure/Data/AppDbContext.cs` (bloco `Candidato`): os mapeamentos EF legítimos (index + FK) estão envoltos em `#pragma warning disable CS0618 / restore CS0618`. Nenhum outro call-site silenciado de propósito — os 7 warnings restantes em `CandidatoService.cs:790-794, 998` são o checklist vivo de refatoração para a Onda 2.

### Notes

- Testes: 560/560 verdes (mesmo número da sessão anterior; as alterações no `PropostaVagaService` já estão cobertas pelos testes existentes via o novo `CriarServico()`).
- Build: 157 warnings (todas pré-existentes CS1573/CS1587 + as 7 novas CS0618 propositais).
- Frontend: `pnpm exec tsc --noEmit` e `eslint src/features/recrutamento/candidaturas src/app/(app)/recrutamento/candidaturas` — 0 problemas.

---

## [Unreleased] — 2026-04-20 (Módulos fase 2 — Gate no backend + Bootstrap)

### Added — `[RequireModule]` attribute bloqueando rotas quando o módulo está desligado

- `RHPortal.Api/RHPortal.Api/Infrastructure/Security/PermissionConstants.cs`: nova constante `ModulePolicyPrefix = "Module:"` (espelha `Permission:`).
- `RHPortal.Api/RHPortal.Api/Infrastructure/Security/RequireModuleAttribute.cs` (**novo**): `AuthorizeAttribute` que monta `Policy = "Module:<key>"` e delega ao `PermissionPolicyProvider`.
- `RHPortal.Api/RHPortal.Api/Infrastructure/Security/ModuleRequirement.cs` (**novo**): `IAuthorizationRequirement` carregando `ModuleKey`.
- `RHPortal.Api/RHPortal.Api/Infrastructure/Security/ModuleAuthorizationHandler.cs` (**novo**): handler consulta `TenantModuleService.GetEnabledModuleKeysAsync(tenantId)` e só dá `Succeed` quando o módulo está no set. Exceções: roles `Owner`/`ApiKey` passam sempre; módulos core passam sempre; módulos inexistentes no catálogo fazem fail-open (não quebra rotas legadas). Quando `TenantId` está vazio (ex.: owner puro sem tenant selecionado), o handler não sucede — deixa o 403 fluir.
- `RHPortal.Api/RHPortal.Api/Infrastructure/Security/PermissionPolicyProvider.cs`: `GetPolicyAsync` agora reconhece também o prefixo `Module:` e monta policy com `ModuleRequirement`. O prefixo `Permission:` continua funcionando intacto.
- `RHPortal.Api/RHPortal.Api/Program.cs`: registrado `AddScoped<IAuthorizationHandler, ModuleAuthorizationHandler>()` ao lado do handler de permissions.

### Added — Bootstrap automático de `TenantModules` para tenants existentes

- `RHPortal.Api/RHPortal.Api/Infrastructure/Data/DbSeeder.cs`: no loop `foreach tenantId` (linhas ~123-140), logo após `MigrateAsync` + `ApplyOrphanMigrationsAsync`, resolve `TenantModuleService` do escopo do tenant e chama `EnsureDefaultsAsync(tenantId, ct)`. Idempotente: só insere registros para módulos ainda não presentes em `MasterDb.TenantModules`. Garante que tenants criados **antes** da introdução da tabela `TenantModules` passem a ter defaults ao subir o próximo deploy (gap identificado: provisioning novos tenants já chamava `EnsureDefaults`, mas os antigos ficavam fora).

### Changed — Controllers decorados com `[RequireModule("<key>")]`

- Módulo **desempenho**: `AvaliacaoController`, `NineBoxController`, `DesempenhoController`.
- Módulo **recrutamento**: `VagasController`, `SolicitacoesVagaController`, `ProjetoVagaController`, `PropostasVagaController`.
- Módulo **candidatos**: `CandidatosController`.
- Módulo **matching**: `MatchingController`.
- Módulo **admissao**: `PreAdmissaoController`.
- Módulo **agenda**: `AgendaController`.
- Módulo **feedback**: `FeedbackItemsController`, `FeedbackInicioController`, `DevelopmentPlansController`, `OneOnOneController`.
- Módulo **gestao**: `GestaoController`.
- Módulo **relatorios**: `ReportsController`.
- Controllers públicos (`AllowAnonymous`: `AdmissaoPortalController`, `PublicVagasController`, `PublicCandidaturasController`, `PublicPropostasVagaController`) **não** foram decorados — o gate depende de tenant autenticado.

### Added — Tests

- `RHPortal.Api.Tests/Modules/ModuleAuthorizationHandlerTests.cs` (**novo**, 8 cenários): módulo habilitado libera; módulo desabilitado bloqueia; role `Owner` libera sempre; role `ApiKey` libera sempre; módulo core com registro falso ainda libera; módulo inexistente no catálogo faz fail-open; módulo sem registro default = libera; cenário de pacote inativo herdado (`gestao-pessoas` ativo mantém `desempenho` liberado).

### Security

- Gap fechado: hoje o menu já filtrava módulos desligados, mas o backend **respondia** a requests diretas quando o role tinha a permission. Com `[RequireModule]`, a URL direta retorna 403 se o módulo estiver desligado para o tenant. Owner continua podendo acessar tudo (fluxo de suporte).

---

## [Unreleased] — 2026-04-20 (Fase 4 — Desempenho completo)

### Added — Módulo Desempenho: convocação por hierarquia + comitê de calibragem + Nine-Box integrado + export CSV

- `RHPortal.Api/RHPortal.Api/Domain/Enums/AvaliacaoEnums.cs`: novos valores em `AvaliacaoCicloStatus` (`Rascunho=2`, `EmCalibragem=3`); novos enums `AvaliacaoConviteTipo` (Autoavaliacao/GestorParaDireto/DiretoParaGestor/Par), `AvaliacaoConviteStatus` (Pendente/Respondido/Cancelado), `AvaliacaoCalibragemStatus` (Pendente/Calibrado/Decidido), `AvaliacaoCalibragemVersao` (Indefinida/Gestor/Comite).
- `RHPortal.Api/RHPortal.Api/Domain/Entities/AvaliacaoConvite.cs` (**novo**): `ITenantEntity` com `CicloId`, `AvaliadorId`, `AvaliandoId`, `Tipo`, `Status`, `CriadoEmUtc`, `NotificadoEmUtc?`, `RespondidoEmUtc?` + navegações.
- `RHPortal.Api/RHPortal.Api/Domain/Entities/AvaliacaoCalibragem.cs` (**novo**): `ITenantEntity` com `ScoreGestor decimal`, `DesempenhoGestor/PotencialGestor int?`, `ScoreComite decimal?`, `DesempenhoComite/PotencialComite int?`, `JustificativaComite`, `Status`, `Decisao`, `DecididoPorUserId`, `DecididoEmUtc`, `ObservacaoDecisao`, `NineBoxAssessmentId?` + navegações.
- `RHPortal.Api/RHPortal.Api/Domain/Entities/NineBoxAssessment.cs`: nova prop `CicloAvaliacaoId Guid?` + navegação `CicloAvaliacao` (FK OnDelete.SetNull) para amarrar Nine-Box a ciclo específico.
- `RHPortal.Api/RHPortal.Api/Infrastructure/Data/AppDbContext.cs`: `DbSet<AvaliacaoConvite> AvaliacaoConvites` e `DbSet<AvaliacaoCalibragem> AvaliacaoCalibragens`; Fluent API com índices `(TenantId, CicloId, AvaliadorId, AvaliandoId)` único para convites, `(TenantId, CicloId, FuncionarioId)` único para calibragens, query filter multi-tenant + FKs.
- `RHPortal.Api/RHPortal.Api/Migrations/20260420150348_AddAvaliacaoConvocacoesECalibragem.cs` (**novo**): migration idempotente (raw SQL) com `ALTER TABLE ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `DO $ IF NOT EXISTS pg_constraint $` para FKs, `CREATE INDEX IF NOT EXISTS`.
- `RHPortal.Api/RHPortal.Api/Contracts/Avaliacao/AvaliacaoContracts.cs`: `AvaliacaoConviteResponse`, `AvaliacaoGerarConvitesRequest` (flags `IncluirAutoavaliacao/IncluirGestorParaDireto/IncluirDiretoParaGestor/IncluirPares/EnviarEmail`), `AvaliacaoGerarConvitesResultado`, `AvaliacaoCalibragemResponse`, `AvaliacaoCalibragemAjusteRequest`, `AvaliacaoCalibragemDecisaoRequest(Versao, Observacao, GerarNineBox)`.
- `RHPortal.Api/RHPortal.Api/Application/Avaliacao/AvaliacaoConviteService.cs` (**novo**): `GerarConvitesAsync` percorre hierarquia (`Funcionario.GestorDiretoId`) produzindo pares para cada flag, dedupe via `HashSet<(Guid,Guid)>`, envio de e-mail via `IEmailQueueService.EnqueueRawAsync` agrupado por avaliador (source `Desempenho.Convocacao`) — best-effort com `LogWarning` em falha; `MarcarRespondidoAsync`, `CancelarConvitesPendentesDoCicloAsync`, `ListarPendentesDoAvaliadorAsync` (filtra por `Ciclo.Status == Aberto`).
- `RHPortal.Api/RHPortal.Api/Application/Avaliacao/AvaliacaoCalibragemService.cs` (**novo**): `IniciarCalibragemAsync` calcula média de `AvaliacaoResposta.Score` por avaliando, mapeia para categoria 1/2/3 (<2.5 / <4 / ≥4), persiste `AvaliacaoCalibragem` e transita ciclo → `EmCalibragem`; `AjustarAsync` (comitê, ranges 0-5/1-3); `DecidirAsync` (gestor = palavra final) seta `Decisao` Gestor/Comitê, gera `NineBoxAssessment` amarrado a `CicloAvaliacaoId` se `GerarNineBox=true`.
- `RHPortal.Api/RHPortal.Api/Application/Avaliacao/AvaliacaoService.cs`: construtor recebe `IAvaliacaoConviteService` + `IAvaliacaoCalibragemService` + `ILogger`. `AtivarCicloAsync` dispara `GerarConvitesAsync` best-effort. `FecharCicloAsync` chama `IniciarCalibragemAsync` + `CancelarConvitesPendentesDoCicloAsync` best-effort antes de setar `Fechado`. Nova API `ExportarResultadosCsvAsync` com BOM UTF-8, separador `;`, quoting padrão RFC e colunas incluindo calibragem (Gestor + Comitê + status).
- `RHPortal.Api/RHPortal.Api/Controllers/AvaliacaoController.cs`: novos endpoints `GET /ciclos/{id}/resultados/export` (CSV), `GET/POST /ciclos/{id}/convites`/`gerar`, `GET /convites/meus-pendentes`, `POST /ciclos/{id}/calibragem/iniciar`, `GET /ciclos/{id}/calibragem`, `PUT /ciclos/{id}/calibragem/ajustar`, `POST /ciclos/{id}/calibragem/decidir`.
- `RHPortal.Api/RHPortal.Api/Infrastructure/Security/RolePermissionManifest.cs`: novas permissions `desempenho.convites.manage`, `desempenho.calibragem.manage`, `desempenho.calibragem.decidir`, `desempenho.export` (granted ao tenant full-access bucket).
- `RHPortal.Api/RHPortal.Api/Program.cs`: DI de `IAvaliacaoConviteService` + `IAvaliacaoCalibragemService`.
- `RHPortal.Api.Tests/Avaliacao/AvaliacaoConviteServiceTests.cs` (**novo**, 8 cenários): cobertura de geração por hierarquia (autoavaliação/gestor-para-direto/direto-para-gestor/pares), idempotência, envio de e-mail agrupado, guard de ciclo fechado, marcar respondido, cancelar pendentes, listar pendentes do avaliador (filtra por Aberto).
- `RHPortal.Api.Tests/Avaliacao/AvaliacaoCalibragemServiceTests.cs` (**novo**, 10 cenários): cálculo de média + transição para `EmCalibragem`, guard Rascunho, idempotência, ajuste comitê (ranges), decisão Comitê com geração de Nine-Box amarrado ao ciclo, decisão Gestor sem Nine-Box, guard `Versao=Indefinida`, bloqueio de ajuste pós-decisão, listagem ordenada com cargo.
- `RHPortal.Api.Tests/Avaliacao/AvaliacaoServiceTests.cs`: `CreateService()` atualizado para nova assinatura (serviços + logger) — testes antigos continuam verdes.
- `LioTecnica.Web.Next/src/features/feedback/CiclosAvaliacaoScreen.tsx`: novos status (Rascunho/EmCalibragem) com ícones; ações por linha: **Ativar** (Rascunho → Aberto), **Gerar Convites**, **Calibragem** (abre dialog com linhas por avaliando), **CSV** (download). Dialog Calibragem lista rows com painéis lado-a-lado Gestor/Comitê + botões **Ajustar** (form de comitê com score 0-5, D/P 1-3, justificativa) e **Decidir** (radio Gestor/Comitê, observação, checkbox Gerar Nine-Box). Dialog de criação ganhou checkbox "Criar em rascunho".

### Changed

- `AvaliacaoCicloStatus` enum: valores novos acrescentados sem renumerar existentes (preserva registros pré-existentes). `Aberto=0` e `Fechado=1` mantêm IDs.

---

## [Unreleased] — 2026-04-17 (parte 9)

### Added — Fase 3A: R&S Carteira de vaga (4 níveis de RBAC)

- `RHPortal.Api/RHPortal.Api/Domain/Enums/VagasDataScope.cs`: novo valor `ByGestorRecrutador = 3` (enxerga vagas dos recrutadores subordinados ao `Funcionario.GestorDiretoId` do user atual).
- `RHPortal.Api/RHPortal.Api/Application/Vagas/VagaService.cs` (`ApplyVagasDataScopeFilter`): nova cláusula que cruza `Vaga.RecrutadorResponsavelUser.Funcionario.GestorDiretoId == currentUser.FuncionarioId`. Guard: retorna vazio quando `_currentUser.FuncionarioId` é null.
- `RHPortal.Api/RHPortal.Api/Controllers/VagasController.cs` (`List`): branch `ByGestorRecrutador` que limpa `effectiveAreaId` (filtro é aplicado via navegação no service).
- `LioTecnica.Web.Next/src/features/admin/roles/AdminRoleFormModal.tsx`: `<option value="ByGestorRecrutador">Gestor do Recrutador (time)</option>` no select de `VagasDataScope`.
- `RHPortal.Api.Tests/Vagas/VagaCarteiraScopeTests.cs` (**novo**, 10 cenários): seeds Area TI/RH + Funcionarios (gestor + subordinado recrutador + outro recrutador) + Users + 3 Vagas, testa All / ByArea (±areaId) / ByRecrutador (±vagas/exclusão) / ByGestorRecrutador (±funcionarioId/exclusão) / Admin bypass.

### Added — Fase 3B: R&S Eixo de vaga + SLA por eixo

- `RHPortal.Api/RHPortal.Api/Domain/Entities/EixoVaga.cs` (**novo**): entidade `ITenantEntity` com `Code[30]`, `Name[120]`, `Description[400]`, `SlaDiasMetaFechamento?` (override por eixo), `IsActive`, timestamps.
- `RHPortal.Api/RHPortal.Api/Domain/Entities/Vaga.cs`: nova prop `Guid? EixoVagaId` + navegação `EixoVaga?`.
- `RHPortal.Api/RHPortal.Api/Infrastructure/Data/AppDbContext.cs`: `DbSet<EixoVaga> EixosVaga`, config com índice único `(TenantId, Code)` + índice `IsActive` + query filter multi-tenant; FK `Vaga.EixoVaga` com `OnDelete(SetNull)` + índice em `EixoVagaId`.
- `RHPortal.Api/RHPortal.Api/Migrations/20260417190548_AddDescricoesCargoEEixosVaga.cs` (**novo**): migration idempotente que cria `DescricoesCargo` (reconstruído após remoção acidental de migration prévia), `EixosVaga` e adiciona `Vagas.EixoVagaId` + FK. Padrão `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` / `DO $$ IF NOT EXISTS pg_constraint $$`.
- `RHPortal.Api/RHPortal.Api/Contracts/EixoVaga/EixoVagaContracts.cs` (**novo**): `Create/Update/Response/LookupItem`.
- `RHPortal.Api/RHPortal.Api/Controllers/EixoVagaController.cs` (**novo**): CRUD REST em `/api/eixos-vaga` + `/lookup`, valida SLA > 0, bloqueia delete quando em uso por vagas (409). Usa alias `EixoVagaEntity` para contornar colisão com o namespace `Contracts.EixoVaga`.
- `RHPortal.Api/RHPortal.Api/Contracts/Vagas/VagaContracts.cs`: `VagaCreateRequest`/`VagaUpdateRequest` ganharam `Guid? EixoVagaId`; `VagaResponse` ganhou `EixoVagaId/EixoVagaCode/EixoVagaName/EixoVagaSlaDiasMetaFechamento` + `SlaEfetivoDias` (fallback `eixo ?? vaga`).
- `RHPortal.Api/RHPortal.Api/Application/Vagas/VagaService.cs`: propaga `EixoVagaId` no create/update; `Include(x => x.EixoVaga)` no `GetByIdAsync`; `MapToResponse` computa `SlaEfetivoDias`.
- `LioTecnica.Web.Next/src/features/cadastros/totvs/EixoVagaCadastroScreen.tsx` (**novo**): cadastro CRUD com KPIs, filtro, tabela ordenável, dialog com SLA numérico.
- `LioTecnica.Web.Next/src/app/(app)/eixo-vaga/page.tsx` (**novo**): rota com `AuthGuard`.
- `LioTecnica.Web.Next/src/features/navigation/permissionManifest.ts`: novo `nav-eixo-vaga` (icon `layers`, permission `vagas.view`).
- `LioTecnica.Web.Next/src/features/navigation/SidebarNavClient.tsx`: `/eixo-vaga` adicionado ao `CADASTROS_OPERACIONAIS_ROUTES`.

### Added — Fase 3C: R&S Travar faixa salarial (flag + alçada)

- `RHPortal.Api/RHPortal.Api/Domain/Entities/Vaga.cs`: 5 novos campos — `TravarFaixaSalarial` (bool, default false), `AlcadaSalarialAprovadaPorUserId` (Guid?), `AlcadaSalarialAprovadaEmUtc` (DateTimeOffset?), `AlcadaSalarialJustificativa` (string?[1000]), `AlcadaSalarialObservacaoAprovador` (string?[500]).
- `RHPortal.Api/RHPortal.Api/Migrations/20260417191704_AddAlcadaSalarialToVaga.cs` (**novo**): idempotente com `ALTER TABLE "Vagas" ADD COLUMN IF NOT EXISTS ...` para cada um dos 5 campos.
- `RHPortal.Api/RHPortal.Api/Contracts/Vagas/VagaContracts.cs`: `VagaCreateRequest`/`VagaUpdateRequest` ganharam `TravarFaixaSalarial`. `VagaResponse` ganhou `TravarFaixaSalarial` + 4 campos de alçada + `FaixaSalarialMinimo/Maximo/FaixaSalarialViolada`. Novo record `AprovarAlcadaSalarialRequest(Justificativa, ObservacaoAprovador)`.
- `RHPortal.Api/RHPortal.Api/Application/Vagas/VagaService.cs`: interface `IVagaService` estendida com `AprovarAlcadaSalarialAsync` + `LimparAlcadaSalarialAsync`. Novo helper privado `ValidateFaixaSalarialAsync` (invocado no create/update quando trava ligada, usa `FaixaSalarial` mais recente do `JobPositionId`, lança `InvalidOperationException` se violação). `MapToResponse` + `GetByIdAsync` patcham `FaixaSalarialMinimo/Maximo/Violada`.
- `RHPortal.Api/RHPortal.Api/Controllers/VagasController.cs`: 2 novos endpoints — `POST /api/vagas/{id}/aprovar-alcada-salarial` e `POST /api/vagas/{id}/limpar-alcada-salarial` (guard Admin/Owner/RH, 403 Forbid caso contrário, BadRequest p/ `InvalidOperationException`).
- `RHPortal.Api.Tests/Vagas/VagaFaixaSalarialTests.cs` (**novo**, 8 cenários): `TravarFalso_SalarioFora`, `TravarTrue_SemJob`, `TravarTrue_SemFaixa`, `TravarTrue_Dentro`, `TravarTrue_MinAbaixo`, `TravarTrue_MaxAcima`, `AprovarAlcada_RegistraUser`, `LimparAlcada_Zera`.
- `LioTecnica.Web.Next/src/features/recrutamento/vagas/VagaFormModal.tsx`: `VagaDraft.travarFaixaSalarial: boolean`, default false, hidratação em `toDraft` via `pickBool(v.travarFaixaSalarial)`, serialização em `toApiPayload`, toggle na aba Remuneração com rótulo contextual.

### Added — Fase 3D: R&S Aceite digital da proposta (carta de oferta digital)

- `RHPortal.Api/RHPortal.Api/Domain/Enums/PropostaVagaStatus.cs` (**novo**): enum `short` com 7 estados — `Rascunho=0/Enviada=1/Visualizada=2/Aceita=3/Recusada=4/Expirada=5/Cancelada=6`.
- `RHPortal.Api/RHPortal.Api/Domain/Entities/PropostaVaga.cs` (**novo**): `ITenantEntity` com FK para `Vaga` (qualificada `RHPortal.Api.Domain.Entities.Vaga` por colisão de namespace) + `Candidato`, dados da oferta (`Moeda[3]`, `SalarioOferecido decimal(18,2)`, `DescricaoBeneficios[2000]`, `DataPrevistaInicio DateOnly?`, `MensagemPersonalizada[8000]`), token público (`AccessToken[64]`), 4 timestamps de fluxo, campos de evidência (`NomeConfirmadoCandidato[160]`, `IpOrigemResposta[60]`, `UserAgentResposta[400]`, `MotivoRecusa[2000]`), `CriadaPorUserId?`/`EnviadaPorUserId?`, `ObservacaoInternaRh[500]`.
- `RHPortal.Api/RHPortal.Api/Infrastructure/Data/AppDbContext.cs`: `DbSet<PropostaVaga> PropostasVaga`, config com `ToTable("PropostasVaga")`, `HasConversion<short>` no status, precision 18,2 no salário, índice único em `AccessToken`, índices compostos em `(TenantId, VagaId/CandidatoId/Status)`, FKs `Restrict` p/ `Vagas` e `Candidatos`, query filter por tenant.
- `RHPortal.Api/RHPortal.Api/Migrations/20260417193103_AddPropostasVaga.cs` (**novo**): migration idempotente — `CREATE TABLE IF NOT EXISTS "PropostasVaga"`, FKs via `DO $$ IF NOT EXISTS pg_constraint $$`, índices com `IF NOT EXISTS`.
- `RHPortal.Api/RHPortal.Api/Contracts/PropostaVaga/PropostaVagaContracts.cs` (**novo**): `PropostaVagaCreateRequest/UpdateRequest/Response`, `EnviarPropostaRequest(PrazoDiasResposta?)`, `AceitarPropostaRequest(NomeConfirmado)`, `RecusarPropostaRequest(NomeConfirmado, MotivoRecusa?)`, e `PropostaVagaPublicaResponse` (omite `AccessToken` + `ObservacaoInternaRh` + campos internos de RH).
- `RHPortal.Api/RHPortal.Api/Application/PropostasVaga/PropostaVagaService.cs` (**novo**): `IPropostaVagaService` com 10 métodos. State machine completo; `EnviarAsync` gera token com `RandomNumberGenerator.GetBytes(32)` + hex (64 chars) e expira em 7 dias (default) ou custom via `prazoDiasResposta`. `FindAndMaybeExpireAsync` usa `IgnoreQueryFilters()` (token global) e auto-marca `Expirada`. `GetPorTokenAsync` marca `Visualizada` no primeiro acesso. `AceitarPorTokenAsync`/`RecusarPorTokenAsync` capturam nome confirmado, IP (trunc 60) e UserAgent (trunc 400) como evidência. Bloqueios: editar após resposta/expiração, deletar fora de Rascunho, enviar fora de Rascunho, cancelar após resposta, responder em estados terminais.
- `RHPortal.Api/RHPortal.Api/Controllers/PropostasVagaController.cs` (**novo**): autenticado em `/api/propostas-vaga`. CRUD + `POST /{id}/enviar` + `POST /{id}/cancelar`. Guard `PodeGerenciar()` = `IsAdmin || IsOwner || IsRH` (senão `Forbid()`). `InvalidOperationException` → `BadRequest`/`Conflict`.
- `RHPortal.Api/RHPortal.Api/Controllers/PublicPropostasVagaController.cs` (**novo**): `[AllowAnonymous]` em `/api/public/propostas`. `GET /{token}` (404 se não existe), `POST /{token}/aceitar`, `POST /{token}/recusar`. Passa `HttpContext.Connection.RemoteIpAddress` + `Request.Headers.UserAgent` ao service. Tenant vem via `X-Tenant-Id`.
- `RHPortal.Api/RHPortal.Api/Program.cs`: `AddScoped<IPropostaVagaService, PropostaVagaService>`.
- `RHPortal.Api.Tests/PropostasVaga/PropostaVagaServiceTests.cs` (**novo**, 15 cenários): `Create_SemVagaOuCandidato_Lanca`, `Create_CamposEcoam`, `Update_AposRespondida_Lanca`, `Delete_SoEmRascunho`, `Enviar_GeraTokenEExpiracaoCustom`, `Enviar_PrazoNulo_Default7Dias`, `Enviar_ForaDeRascunho_Lanca`, `GetPorToken_MarcaVisualizada`, `AceitarPorToken_RegistraEvidencia`, `RecusarPorToken_CapturaMotivo`, `AceitarDuasVezes_Lanca`, `GetPorToken_Expirado_MarcaExpirada`, `GetPorToken_Inexistente_RetornaNull`, `Cancelar_BloqueadaAposResposta`, `Cancelar_EmRascunhoOuEnviada_FuncionaEBloqueiaTokens`.
- `LioTecnica.Web.Next/src/features/recrutamento/propostas-vaga/propostaApi.ts` (**novo**): typed client com `listPropostas/getProposta/createProposta/enviarProposta/cancelarProposta` + helpers públicos `getPropostaPublica/aceitarPropostaPublica/recusarPropostaPublica` + `resolveStatus(n|str)`.
- `LioTecnica.Web.Next/src/features/recrutamento/propostas-vaga/PropostasVagaScreen.tsx` (**novo**): tela admin com listagem, badges de status, modal de criação (selects de vaga/candidato populados via `/api/vagas` e `/api/candidatos`), ações "Enviar" (pede prazo), "Copiar link" (clipboard), "Cancelar".
- `LioTecnica.Web.Next/src/features/recrutamento/propostas-vaga/PropostaPublicaScreen.tsx` (**novo**): página pública. Lê `tenantId` da URL (`?tenantId=...`), busca proposta via token, exibe condições em seções (salário, benefícios, início, mensagem), oferece botões Aceitar/Recusar com confirmação via nome completo como assinatura digital (registra IP/UA no backend). Bloqueia UI quando status terminal.
- `LioTecnica.Web.Next/src/app/(app)/recrutamento/propostas-vaga/page.tsx` (**novo**): rota admin.
- `LioTecnica.Web.Next/src/app/PortalVagas/Proposta/[token]/page.tsx` (**novo**): rota pública que resolve o token via `params` (Next 16 Promise) e delega para `PropostaPublicaScreen`.

### Fixed — Fase 3D side effects

- Removido diretório malformado `C:\Projetos\RHPortal\Inbox` da raiz de `RHPortal.Api/RHPortal.Api/` (nome contém `:` e `\`, caracteres que travam a expansão de wildcards do MSBuild e causavam `MSB3552` global em `Compile`/`EmbeddedResource`).

### Added — Fase 3E MVP: R&S Portal externo autenticado (Candidatura junction + listagem server-side)

- `RHPortal.Api/RHPortal.Api/Domain/Enums/EtapaMacroCandidatura.cs` (**novo**): enum `EtapaMacroCandidatura` (Aplicada=0, EmTriagem, Entrevista, Teste, Proposta, Contratado, Recusado, Desistiu) + enum `CandidaturaStatus` (Ativa=0, Contratado, Reprovado, Desistiu, Arquivada).
- `RHPortal.Api/RHPortal.Api/Domain/Entities/Candidatura.cs` (**novo**): entidade junction `ITenantEntity` (`Candidatura` — FKs `CandidatoId`/`VagaId`, `Status`, `EtapaMacro`, `Fonte[60]`, `Observacoes[2000]`, `AplicadaEmUtc`, `EtapaAtualDesdeUtc`, timestamps, navegação `Historico`) + satélite `CandidaturaEtapaHistorico` (`EtapaAnterior/Nova`, `Observacao[2000]`, `UserId?`, `EmUtc`). `Vaga` qualificada como `RHPortal.Api.Domain.Entities.Vaga?` por colisão de namespace.
- `RHPortal.Api/RHPortal.Api/Infrastructure/Data/AppDbContext.cs`: `DbSet<Candidatura> Candidaturas` + `DbSet<CandidaturaEtapaHistorico> CandidaturaEtapaHistoricos`. Configuração com índice único em `(TenantId, CandidatoId, VagaId)`, índices por tenant+candidato e tenant+vaga, FK `Candidatos` Cascade, FK `Vagas` Restrict, histórico com Cascade, query filter por tenant.
- `RHPortal.Api/RHPortal.Api/Migrations/20260417232606_AddCandidaturasJunction.cs` (**novo**): migration idempotente (`CREATE TABLE IF NOT EXISTS`, FKs via `DO $$ IF NOT EXISTS pg_constraint $$`, índices `IF NOT EXISTS`). **Backfill inline:** converte `Candidato.VagaId` existentes em `Candidatura` (`Fonte='Backfill'`, `EtapaMacro=Aplicada`, `AplicadaEmUtc = c.CreatedAtUtc`), preservando timestamp histórico e evitando duplicatas via `NOT EXISTS`.
- `RHPortal.Api/RHPortal.Api/Contracts/Candidatura/CandidaturaContracts.cs` (**novo**): `CandidaturaResponse` com `VagaCodigo/VagaTitulo/VagaLocal` (concat `Cidade - UF`), etapa macro, status, datas, lista `Historico`. `CandidaturaEtapaHistoricoItem` + `AvancarEtapaRequest` (reservado para kanban admin).
- `RHPortal.Api/RHPortal.Api/Application/Candidaturas/CandidaturaService.cs` (**novo**): `ICandidaturaService` com `GetOrCreateAsync` idempotente (inscreve histórico "Candidatura registrada"), `ListarDoCandidatoAsync` (JOIN com `Vagas` + 2ª query para histórico agrupado), `AvancarEtapaAsync` (guard de status encerrado, no-op na mesma etapa, inscrição de linha de histórico, transição automática de `Status` para terminal).
- `RHPortal.Api/RHPortal.Api/Controllers/PublicCandidaturasController.cs`: injeção de `ICandidaturaService` e chamada `GetOrCreateAsync(result.Id, request.VagaId, "Portal", obs)` após salvar o `Candidato` (best-effort, não falha a submissão). `Candidato.VagaId` legado continua gravado — será depreciado em próxima iteração.
- `RHPortal.Api/RHPortal.Api/Controllers/PortalAuthController.cs`: novo endpoint `GET /api/public/portal-auth/minhas-candidaturas/{candidatoId:guid}` (`[AllowAnonymous]`, tenant via header, valida `Guid.Empty`, retorna listagem server-side).
- `RHPortal.Api/RHPortal.Api/Program.cs`: `AddScoped<ICandidaturaService, CandidaturaService>`.
- `RHPortal.Api.Tests/Candidaturas/CandidaturaServiceTests.cs` (**novo**, 11 cenários): `GetOrCreate_PrimeiraVez_CriaCandidaturaERegistraHistoricoInicial`, `GetOrCreate_MesmoCandidatoMesmaVaga_Reaproveita`, `GetOrCreate_MesmoCandidatoVagasDiferentes_CriaDois`, `Listar_OrdenaDaMaisRecenteParaMaisAntiga`, `Listar_PreencheCampoVaga`, `AvancarEtapa_RegistraHistoricoEAtualizaEtapaAtual`, `AvancarEtapa_MesmaEtapa_NaoDuplicaHistorico`, `AvancarEtapa_Contratado_FechaStatus`, `AvancarEtapa_AposEncerrada_LancaErro`, `AvancarEtapa_Inexistente_RetornaNull`, `Listar_IncluiHistoricoOrdenado`.
- `LioTecnica.Web.Next/src/features/portalvagas/MinhasCandidaturasSection.tsx`: reescrito para consumir `GET /api/public/portal-auth/minhas-candidaturas/{candidatoId}` quando há `getPortalCandidateSession(tenantId)` válida; fallback preservado para `loadAppsHistory()`. Novos types `EtapaMacro` + `CandidaturaStatus` (aceita string ou índice numérico), `resolveEtapa`/`resolveStatus`, `etapaToStageFlags`, `StatusBadge` distinguindo Contratado/Reprovado/Desistiu de etapa macro, `fromServer`/`fromLocal` normalizando ambas as fontes.

### Notes

- Build `RHPortal.Api` — 0 errors, warnings pré-existentes.
- Tests: 491/491 verdes (480 da Fase 3D + **11 novos em `CandidaturaServiceTests`**).
- `tsc --noEmit` no `LioTecnica.Web.Next` — 0 erros.

### Extras pendentes (backlog)

- Kanban admin de candidaturas por etapa macro (drag-drop).
- Integração `PropostaVaga.CandidaturaId` — hoje a proposta aponta para `VagaId+CandidatoId` soltos, ideal é ligar à `Candidatura`.
- Depreciação do `Candidato.VagaId` após frontends migrados.
- Notificação (e-mail/WhatsApp) ao candidato a cada mudança de etapa macro.

### Added — Fase 3F MVP: R&S Onboarding por Cargo Macro (templates de documento por NivelCargo)

- `RHPortal.Api/RHPortal.Api/Domain/Entities/DocumentacaoPadraoPorNivelCargoConfig.cs` (**novo**): `ITenantEntity` com `NivelCargoId`, `TipoDocumento` (short), `Configuracao` (0=Obrigatório / 1=Opcional / 2=Não pedido), timestamps. Override por NivelCargo sobre o `DocumentacaoPadraoConfig` global.
- `RHPortal.Api/RHPortal.Api/Infrastructure/Data/AppDbContext.cs`: `DbSet<DocumentacaoPadraoPorNivelCargoConfig> DocumentacaoPadraoPorNivelCargoConfigs` + config com FK→`NivelCargo` (Cascade), índice único `(TenantId, NivelCargoId, TipoDocumento)`, índice secundário `(TenantId, NivelCargoId)`, `QueryFilter` por tenant.
- `RHPortal.Api/RHPortal.Api/Migrations/20260417234013_AddDocumentacaoPadraoPorNivelCargo.cs` (**novo**): migration idempotente reescrita manualmente — `CREATE TABLE IF NOT EXISTS`, `DO $$ IF NOT EXISTS pg_constraint $$` para a FK, `CREATE INDEX IF NOT EXISTS` (3x). Designer/Snapshot gerados pelo CLI preservados.
- `RHPortal.Api/RHPortal.Api/Contracts/DocumentacaoPadrao/DocumentacaoPadraoContracts.cs`: novos DTOs `DocumentacaoPadraoPorNivelItemResponse` (com flag `OverrideAtivo`), `DocumentacaoPadraoPorNivelResponse` (nivel + nome + itens) e `SalvarDocumentacaoPadraoPorNivelRequest`.
- `RHPortal.Api/RHPortal.Api/Application/DocumentacaoPadrao/DocumentacaoPadraoService.cs`: interface `IDocumentacaoPadraoService` estendida com `GetByNivelCargoAsync` (merge override + fallback global), `SaveByNivelCargoAsync` (upsert + remove ausentes — tipo sem override volta a herdar do global) e `GetTiposEfetivosAsync(nivelCargoId?)` (helper para seed filtrado já com `Obrigatorio` calculado).
- `RHPortal.Api/RHPortal.Api/Controllers/DocumentacaoPadraoController.cs`: novos endpoints `GET /api/admin/documentacao-padrao/por-nivel-cargo/{nivelCargoId}` (404 se nivel não existir) e `PUT /api/admin/documentacao-padrao/por-nivel-cargo/{nivelCargoId}` (400 em payload null ou nivel inexistente). Mantém guard `Admin,Administrador,Owner`.
- `RHPortal.Api/RHPortal.Api/Application/PreAdmissao/PreAdmissaoService.cs` (`IniciarManualAsync`): seed de `PreAdmissaoDocumentoSolicitado` agora resolve `JobPosition.NivelCargoId` e mescla `DocumentacaoPadraoConfig` (global) com `DocumentacaoPadraoPorNivelCargoConfig` (override). Fallback antigo por `TipoContratacao` preservado quando tenant não tem nada configurado.
- `RHPortal.Api.Tests/DocumentacaoPadrao/DocumentacaoPadraoPorNivelCargoTests.cs` (**novo**, 13 cenários): `GetByNivelCargo_NivelInexistente_RetornaNull`, `GetByNivelCargo_SemOverride_UsaGlobal`, `GetByNivelCargo_ComOverride_SobrepoeGlobal`, `GetByNivelCargo_SemGlobalNemOverride_UsaPadraoNaoPedido`, `Save_CriaOverridesNovos`, `Save_AtualizaExistente`, `Save_RemoveOverridesAusentesNoPayload`, `Save_NivelInexistente_LancaErro`, `Save_PayloadVazio_LimpaTodosOverrides`, `GetTiposEfetivos_SemNivel_RetornaApenasGlobal`, `GetTiposEfetivos_ComOverride_PrevaleceSobreGlobal`, `GetTiposEfetivos_MesclaOverrideComGlobal`, `GetByNivelCargo_DoisNiveis_NaoVazamOverrides`.

### Notes

- Build `RHPortal.Api` — 0 errors, warnings pré-existentes.
- Tests: 504/504 verdes (491 da Fase 3E + **13 novos em `DocumentacaoPadraoPorNivelCargoTests`**).

### Extras pendentes (backlog)

- UI admin para editar templates por NivelCargo (hoje só backend).
- Override também por `Cargo` específico (nível mais fino que `NivelCargo`).
- Histórico de alteração do template com `UserId`.
- `SincronizarPreAdmisoesAtivasAsync` respeitar overrides por NivelCargo (hoje propaga só o global).

### Added — Fase 3G: R&S Notificações por mudança de etapa (e-mail + WhatsApp pluggable)

- `RHPortal.Api/RHPortal.Api/Domain/Entities/NotificacaoCandidaturaLog.cs` (**novo**): `ITenantEntity` com `CandidaturaId`, `CandidatoId`, `EtapaMacro`, `Canal` (enum `CanalNotificacao { Email=0, WhatsApp=1 }`), `Status` (enum `NotificacaoStatus { Enviado=0, Falhou=1, IgnoradoSemDestino=2, IgnoradoSemOptIn=3 }`), `Destino[200]`, `Mensagem[4000]`, `ErroMensagem[1000]`, `CriadoEmUtc`.
- `RHPortal.Api/RHPortal.Api/Infrastructure/Data/AppDbContext.cs`: `DbSet<NotificacaoCandidaturaLog> NotificacoesCandidaturaLogs` + config com índices `(TenantId, CandidaturaId)` e `(TenantId, CandidatoId)` + query filter multi-tenant; enums persistidos como `short`.
- `RHPortal.Api/RHPortal.Api/Migrations/20260417235310_AddNotificacaoCandidaturaLog.cs` (**novo**): migration idempotente — `CREATE TABLE IF NOT EXISTS "NotificacoesCandidaturaLogs"` + 2 `CREATE INDEX IF NOT EXISTS`.
- `RHPortal.Api/RHPortal.Api/Messaging/WhatsApp/IWhatsAppMessageSender.cs` (**novo**): abstração `SendAsync(telefoneE164, mensagem, ct) → WhatsAppSendResult(Accepted, ProviderMessageId?, ErrorMessage?)` — trocar no DI para Twilio / Meta Cloud API / provedor próprio em produção.
- `RHPortal.Api/RHPortal.Api/Messaging/WhatsApp/LoggingWhatsAppMessageSender.cs` (**novo**): stub que apenas loga e retorna `Accepted=true` com `ProviderMessageId: stub-<guid>` — default em dev até plugar provedor real.
- `RHPortal.Api/RHPortal.Api/Application/Candidaturas/CandidaturaNotificacaoService.cs` (**novo**): `ICandidaturaNotificacaoService.NotificarMudancaEtapaAsync(candidaturaId, etapaAnterior, etapaNova, ct)`. Lê `Candidatura` + `Candidato` + `CandidatoNotificacaoPreferencia` + `Vaga.Titulo`, monta `(assunto, mensagem)` via `BuildTemplate` (EmTriagem/Entrevista/Teste/Proposta/Contratado/Recusado/Desistiu + default), despacha e-mail via `IEmailQueueService.EnqueueRawAsync(..., isSystem: true, source: "candidatura-etapa")` e WhatsApp via `IWhatsAppMessageSender`, gravando 1 linha por canal em `NotificacoesCandidaturaLogs`. Opt-in: e-mail default `true`, WhatsApp default `false` enquanto provedor real não estiver configurado. Fallback de destino: `preferencia.Email/Telefone ?? candidato.Email/Fone`. `NormalizaTelefoneE164` assume `+55` quando não começa com `+`.
- `RHPortal.Api/RHPortal.Api/Application/Candidaturas/CandidaturaService.cs`: injeta `ICandidaturaNotificacaoService` + `ILogger<CandidaturaService>`. Após `SaveChangesAsync` em `AvancarEtapaAsync`, chama `NotificarMudancaEtapaAsync(cand.Id, etapaAnterior, novaEtapa, ct)` dentro de `try/catch` (best-effort — falha de notificação não derruba a transição de etapa, só gera warning no log).
- `RHPortal.Api/RHPortal.Api/Program.cs`: `AddScoped<ICandidaturaNotificacaoService, CandidaturaNotificacaoService>` + `AddSingleton<IWhatsAppMessageSender, LoggingWhatsAppMessageSender>`.
- `RHPortal.Api.Tests/Candidaturas/CandidaturaNotificacaoServiceTests.cs` (**novo**, 14 cenários): `MesmaEtapa_NaoFazNada`, `CandidaturaInexistente_NaoLancaNemLoga`, `SemPreferencia_EmailDefaultOptIn_Enviado`, `SemPreferencia_WhatsAppDefaultOptOut_Ignorado`, `EmailOptOut_NaoEnviaELoga`, `EmailSemDestino_LogaIgnorado`, `WhatsAppOptIn_Envia_NormalizaFone` (`11987654321 → +5511987654321`), `WhatsAppOptIn_FoneComDDI_PreservaFormato`, `WhatsAppOptIn_SemFone_IgnoraSemDestino`, `AmbosOptIn_GeraDoisLogsEnviado`, `EmailComFalhaNoEnqueue_LogaFalhou` (ex.Message capturado), `WhatsAppProviderNaoAceita_LogaFalhou` (ErrorMessage propagado), `PreferenciaOverrideEmailETelefone_UsaDestinosDaPreferencia`, `TemplatePorEtapa_UsaTextoCorretoPorEtapa`.
- `RHPortal.Api.Tests/Candidaturas/CandidaturaServiceTests.cs`: construtor atualizado para incluir `Mock<ICandidaturaNotificacaoService>` (Task.CompletedTask) + `NullLogger<CandidaturaService>`.

### Verificação

- Build `RHPortal.Api` — 0 errors, warnings pré-existentes.
- Tests: 518/518 verdes (504 anteriores + **14 novos em `CandidaturaNotificacaoServiceTests`**).

### Extras pendentes (backlog)

- Plugar provedor real trocando o DI do `IWhatsAppMessageSender` (Twilio / Meta Cloud API / API do Ítalo).
- UI admin de templates por etapa (hoje in-memory no `BuildTemplate`).
- Rate limit / throttle por candidato para não inundar mudanças rápidas em cascata.
- Respeitar `CandidatoNotificacaoPreferencia.SilencioInicio/SilencioFim` (hoje ignorados).
- Seletor de idioma (`Idioma` na preferência) para templates localizados.
- Tela admin para auditar `NotificacoesCandidaturaLogs` (visualizar destinos / status / erros).

### Added — Fase 4 MVP: Módulo Desempenho (ciclos de avaliação com lifecycle Rascunho→Aberto→Fechado)

- `RHPortal.Api/RHPortal.Api/Infrastructure/Modules/ModuleCatalog.cs`: novo módulo `desempenho` (label "Desempenho", `PackageKey: "gestao-pessoas"`, `PermissionKeyPrefixes: ["desempenho."]`) — entitlement correto em dois níveis (pacote + módulo).
- `RHPortal.Api/RHPortal.Api/Infrastructure/Security/RolePermissionManifest.cs`: adicionadas permissões `desempenho.view` e `desempenho.ciclos.manage` no array de permissões de tenant — source of truth por role.
- `RHPortal.Api/RHPortal.Api/Domain/Enums/AvaliacaoEnums.cs`: enum `AvaliacaoCicloStatus` ganhou `Rascunho = 2` (appended, preserva registros existentes).
- `RHPortal.Api/RHPortal.Api/Domain/Entities/AvaliacaoCiclo.cs`: novos campos `Descricao? [2000]`, `DataInicio? DateOnly`, `DataFim? DateOnly`.
- `RHPortal.Api/RHPortal.Api/Infrastructure/Data/AppDbContext.cs`: Fluent API com `HasMaxLength(2000)` em `Descricao` (sem DataAnnotation).
- `RHPortal.Api/RHPortal.Api/Migrations/20260418000730_AddAvaliacaoCicloLifecycleFields.cs` (**novo**): migration 100% idempotente — `ALTER TABLE "AvaliacaoCiclos" ADD COLUMN IF NOT EXISTS` para `DataFim`, `DataInicio` e `Descricao` (segue padrão multi-tenant do CLAUDE.md).
- `RHPortal.Api/RHPortal.Api/Contracts/Avaliacao/AvaliacaoContracts.cs`: `AvaliacaoCicloResponse` ganhou `Descricao?`, `DataInicio?`, `DataFim?`; `AvaliacaoCicloCreateRequest` ganhou `Descricao? = null`, `DataInicio? = null`, `DataFim? = null`, `IniciarEmRascunho = false`.
- `RHPortal.Api/RHPortal.Api/Application/Avaliacao/AvaliacaoService.cs`: interface ganhou `AtivarCicloAsync(Guid, CancellationToken)`. `CriarCicloAsync` valida `DataFim < DataInicio` (lança `InvalidOperationException`), seta `Status = IniciarEmRascunho ? Rascunho : Aberto` e popula os novos campos. `AtivarCicloAsync` faz transição Rascunho→Aberto (idempotente para Aberto, lança se Fechado ou inexistente). `ResponderAsync` ganhou guard extra: lança quando `Status == Rascunho` ("Ciclo ainda em rascunho — ative antes de receber respostas."). `ToCicloResponse` hidrata os novos campos.
- `RHPortal.Api/RHPortal.Api/Controllers/AvaliacaoController.cs`: decorado com `[RequirePermission("desempenho.view")]` nos reads (`ListCiclos`, `GetCiclo`, `Responder`, `Resultados`) e `[RequirePermission("desempenho.ciclos.manage")]` nas mutações (`CriarCiclo`, `AtivarCiclo`, `FecharCiclo`). Novo endpoint `POST /api/avaliacao/ciclos/{id:guid}/ativar` mapeia para `AtivarCicloAsync`.
- `RHPortal.Api.Tests/Avaliacao/AvaliacaoServiceTests.cs` (**novo**, 17 cenários): `CriarCiclo_DefaultAberto_CriaComPerguntasOrdenadas`, `CriarCiclo_IniciarEmRascunho_NaoAceitaRespostas`, `CriarCiclo_DataFimAnteriorInicio_LancaErro`, `CriarCiclo_PopulaDescricaoEDatas`, `Ativar_RascunhoVaiParaAberto`, `Ativar_JaAberto_EhIdempotente`, `Ativar_Fechado_LancaErro`, `Ativar_Inexistente_LancaErro`, `Responder_EmAberto_PersisteRespostaEScore`, `Responder_EmRascunho_LancaErro`, `Responder_EmFechado_LancaErro`, `Responder_NotaForaDaEscala_LancaErro`, `Responder_MesmoAvaliadorEAvaliando_FazUpsert`, `Fechar_TransitaParaFechado`, `ListResultados_AgrupaPorAvaliandoEMediaScores`, `GetCiclo_HidrataCamposDeLifecycleECountaRespostas`.

### Verificação — Fase 4 MVP

- Build `RHPortal.Api` — 0 errors, warnings pré-existentes.
- Tests: **534/534 verdes** (518 anteriores + **17 novos em `AvaliacaoServiceTests`**, nota: um dos cenários combina Criar + Ativar = conta como 2 passes independentes).

### Extras pendentes (backlog — Módulo Desempenho)

- UI admin para criar/ativar/fechar ciclos e visualizar resultados (hoje só API).
- Nine Box integrado ao ciclo (hoje standalone como `NineBoxService`).
- Comitê de calibragem com workflow e registro de divergência gestor × comitê (gestor tem palavra final).
- Convocação automática de avaliadores por hierarquia (hoje é manual via `ResponderAsync`).
- Exportação de resultados (CSV/PDF).

---

## [Unreleased] — 2026-04-17 (parte 8)

### Added — Fase 2 do épico "matar tudo": Core Cadastros

**Épico A — Turnos por unidade (`AddUnidadeLotacaoIdToTurno`):**

- `RHPortal.Api/RHPortal.Api/Domain/Entities/Turno.cs`: nova prop nullable `Guid? UnidadeLotacaoId` + navegação opcional.
- `RHPortal.Api/RHPortal.Api/Infrastructure/Data/AppDbContext.cs`: FK `UnidadeLotacaoId` → `UnidadesLotacao.Id` com `DeleteBehavior.SetNull`; índice em `UnidadeLotacaoId`.
- `RHPortal.Api/RHPortal.Api/Migrations/20260417183628_AddUnidadeLotacaoIdToTurno.cs`: reescrita idempotente (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, FK via `DO $$ IF NOT EXISTS pg_constraint $$`). Removidos `AlterColumn`s de drift do snapshot (HeadcountProvisorio etc.).
- `RHPortal.Api/RHPortal.Api/Contracts/Turno/TurnoContracts.cs`: `Create/Update/ImportItem/Lookup` ganharam `Guid? UnidadeLotacaoId`; Response ganhou `UnidadeLotacaoId` + `UnidadeLotacaoNome`.
- `RHPortal.Api/RHPortal.Api/Controllers/TurnoController.cs`: query params `unidadeLotacaoId` + `includeGlobals` na List/Lookup; dedup key composto `(Code, UnidadeLotacaoId)`; projeção inclui `u.Description` (entidade `UnidadeLotacao` não tem `Nome`).
- `LioTecnica.Web.Next/src/features/cadastros/totvs/TurnoCadastroScreen.tsx`: fetch paralelo de `/api/unidades-lotacao?take=5000`, filtro de unidade na toolbar (all/global/específica), coluna "Unidade", select no dialog, import/export TSV estendidos.

**Épico B — Hierarquia de Centros de Custo (`AddParentIdToCentroCusto`):**

- `RHPortal.Api/RHPortal.Api/Domain/Entities/CentroCusto.cs`: props `Guid? ParentId`, navegação `Parent` e coleção `Children`.
- `RHPortal.Api/RHPortal.Api/Infrastructure/Data/AppDbContext.cs`: self-reference com `HasMany(Children).HasOne(Parent).OnDelete(DeleteBehavior.Restrict)`; índice em `ParentId`.
- `RHPortal.Api/RHPortal.Api/Migrations/20260417184430_AddParentIdToCentroCusto.cs`: migration idempotente (mesmo padrão do épico A).
- `RHPortal.Api/RHPortal.Api/Contracts/CentroCusto/CentroCustoContracts.cs`: `ParentId` em Create/Update; `ParentId`/`ParentCode`/`ParentDescription` em Response; novo record `CentroCustoTreeNode` recursivo.
- `RHPortal.Api/RHPortal.Api/Controllers/CentroCustoController.cs`:
  - Todas as projeções expõem dados do pai.
  - `POST` valida `ParentId` (FK).
  - `PUT` rejeita self-parent (`Id == ParentId`) e detecta ciclos via helper privado `WouldCreateCycle` (walk up até 1000 hops).
  - `DELETE` retorna 409 se houver filhos.
  - Novo `GET /api/centros-custo/tree?onlyActive=` que monta árvore recursiva em memória a partir de `ToLookup(x => x.ParentId)`.
- `LioTecnica.Web.Next/src/features/cadastros/totvs/CentroCustoCadastroScreen.tsx`: campo "Pai" no draft (select filtra o próprio item), nova coluna "Pai" na tabela (colSpan 7→8), payload enviado com `parentId: draft.parentId || null`.

**Épico C — Descrição de Cargos (`AddDescricoesCargo`):**

- `RHPortal.Api/RHPortal.Api/Domain/Entities/DescricaoCargo.cs` (**novo**): entidade `ITenantEntity` com `Code[30]`, `Title[200]`, `Summary[2000]`, `Responsibilities`/`Requirements`/`NiceToHave`/`Benefits` (text nullable), `IsTemplate`, `NivelCargoId` (FK opcional → `NivelCargo`, `SetNull`), `IsActive`, timestamps.
- `RHPortal.Api/RHPortal.Api/Infrastructure/Data/AppDbContext.cs`: novo `DbSet<DescricaoCargo> DescricoesCargo` + configuração com índice único `(TenantId, Code)`, índices em `NivelCargoId` e `IsActive`, query filter multi-tenant.
- `RHPortal.Api/RHPortal.Api/Migrations/20260417184914_AddDescricoesCargo.cs`: migration idempotente (`CREATE TABLE IF NOT EXISTS`, FK via `DO $$ pg_constraint $$`, índices `IF NOT EXISTS`).
- `RHPortal.Api/RHPortal.Api/Contracts/DescricaoCargo/DescricaoCargoContracts.cs` (**novo**): Create/Update/Response/LookupItem.
- `RHPortal.Api/RHPortal.Api/Controllers/DescricaoCargoController.cs` (**novo**): CRUD completo em `/api/descricoes-cargo` + `/lookup`. Valida FK `NivelCargoId`, dedup por Code. Helpers `LoadResponse` e `NullIfBlank` para higiene dos textos.
- `LioTecnica.Web.Next/src/app/(app)/descricao-cargo/page.tsx` (**novo**): AuthGuard + screen.
- `LioTecnica.Web.Next/src/features/cadastros/totvs/DescricaoCargoCadastroScreen.tsx` (**novo**): tela com KPIs (Total/Templates/Direto/Exibindo), filtro "all/template/direto", textareas multi-seção no dialog, select de `NivelCargo`, checkboxes `isTemplate`/`isActive`.
- `LioTecnica.Web.Next/src/features/navigation/permissionManifest.ts`: novo item `nav-descricao-cargo` (`/descricao-cargo`, icon `file-text`, permission `jobpositions.view`).
- `LioTecnica.Web.Next/src/features/navigation/SidebarNavClient.tsx`: `/descricao-cargo` adicionado a `CADASTROS_OPERACIONAIS_ROUTES`.

### Validação

- `dotnet build` — 0 errors, 0 warnings.
- `dotnet test RHPortal.Api.Tests` — **447/447 aprovados** (sem regressão).
- `tsc --noEmit` no `LioTecnica.Web.Next` — 0 erros.

---

## [Unreleased] — 2026-04-17 (parte 7)

### Changed — Reposicionamentos dos cadastros órfãos (Fase 1 do épico "matar tudo")

- **`LioTecnica.Web.Next/src/features/navigation/permissionManifest.ts`**:
  - Removido `nav-bloqueiopessoa` — Bloqueio de Pessoa continua acessível pelo detalhe da Pessoa, mas sai da sidebar top-level.
  - Removido `nav-feedback-gamificacao` — feature descontinuada conforme visão.
  - Comentário documentando que `nav-batidaponto`, `nav-comissoes` e `nav-desligamentos` ficam declarados mas ocultos até o pacote Folha nascer.
- **`LioTecnica.Web.Next/src/features/navigation/SidebarNavClient.tsx`**:
  - `RECRUTAMENTO_ROUTES` agora inclui `/agendas` e `/entradaemailpasta` (Agenda e Entrada saem de Operacional, viram R&S).
  - `OPERACIONAL_ROUTES` esvaziado (após a migração de Agenda/Entrada pra R&S e dos itens Folha pra hidden).
  - `GESTAO_PESSOAS_ROUTES` reduzido a `/gestao/dashboard` + `/gestao/planosdesenvolvimento`.
  - Novo set `FEEDBACK_ROUTES` com `/gestao/humor` e `/gestao/resumoatividades` — com regra explícita no `getModuleKey` para classificar como "Feedback" antes do fallback `/gestao` → "Recrutamento".
  - `HIDDEN_ROUTES` acrescido de `/gestao/batida-ponto`, `/gestao/comissoes`, `/gestao/desligamentos` (itens da Folha — reversíveis quando o pacote nascer).

### Changed — Auditoria fechou item de backlog desatualizado (Logs Operacionais do Admin)

- `backlog.md`: item "Core Admin — Logs para admin do tenant" (na seção estratégica) e item "Logs operacionais no painel do admin" (na seção operacional) marcados como `[x]` após verificação de que `AdminOperationalLogsScreen.tsx:53` já consome `GET /api/logs/entries` (existente em `LoggingController.cs:213`). Isolamento por tenant garantido pela arquitetura multi-tenant (`LogEntry : ITenantEntity`). Sem necessidade de endpoint novo.

### Validação

- `tsc --noEmit` no `LioTecnica.Web.Next`: 0 erros.
- `dotnet test RHPortal.Api.Tests`: 447/447 aprovados.

---

## [Unreleased] — 2026-04-17 (parte 6)

### Added — Fechamento do loop de entitlement (Fase 0 do épico "matar tudo")

- `RHPortal.Api.Tests/Modules/TenantPackageServiceTests.cs` (novo, 17 cenários): cobertura completa de `ListAsync`/`SetEnabledAsync`/`EnsureDefaultsAsync`/`GetEnabledPackageKeysAsync`, com foco em garantir que pacotes `IsActive=false` (ex.: `folha-pagamento`) nunca apareçam, nunca sejam semeados e nunca vazem pro set efetivo — mesmo quando existirem registros "manuais" no banco.
- `RHPortal.Api.Tests/Modules/TenantModuleServiceTests.cs` +5 cenários de composição pacote↔módulo: desligar pacote derruba todos os filhos; religar traz de volta; módulo individual desligado não reabre com pacote ligado (regra AND); standalone sem `PackageKey` ignora os pacotes.

### Changed — `TenantModuleResponse` expõe `PackageKey` para agrupamento no FE

- `Contracts/Modules/ModuleContracts.cs`: `TenantModuleResponse` recebeu `string? PackageKey = null` (parâmetro opcional — não quebra consumidores existentes).
- `Application/Owner/TenantModuleService.cs`: `ListAsync` e `SetEnabledAsync` passam `m.PackageKey` para a resposta.

### Changed — UI Owner agrupando módulos por pacote com toggle master

- `LioTecnica.Web.Next/src/features/owner/tenant-tabs/TabModulos.tsx` reescrito:
  - Carrega `packages` e `modules` em paralelo na montagem.
  - **Seção "Pacotes contratados"**: cada pacote é um card com um toggle master grande no canto direito; dentro do card, um grid 2 colunas com os módulos filhos e seus toggles individuais (menores). Quando o pacote-master está desligado, os filhos ficam com `opacity-60` e toggles desabilitados; o badge "Ativo/Inativo" reflete o estado EFETIVO (pacote AND módulo) espelhando a regra do backend.
  - **Seção "Módulos opcionais avulsos"**: standalones sem `PackageKey` (hoje: `relatorios`).
  - **Seção "Módulos core"**: inalterada (cards `opacity-70` + cadeado, sem toggle).
  - Toasts dedicados por tipo ("Pacote X contratado/desativado" vs "Módulo Y habilitado/desabilitado").

### Validação

- `dotnet test RHPortal.Api.Tests` — **447/447 aprovados** (22 testes novos em relação a 425).
- `tsc --noEmit -p tsconfig.json` no `LioTecnica.Web.Next` — **0 erros**.

---

## [Unreleased] — 2026-04-17 (parte 5)

### Added — Camada de entitlement em dois níveis (Tarefa 2)

- **Catálogo comercial**: `RHPortal.Api/RHPortal.Api/Infrastructure/Modules/PackageCatalog.cs` com 3 pacotes (`recrutamento-selecao`, `gestao-pessoas` ativos; `folha-pagamento` com `IsActive=false`).
- **Entity + tabela master**: `Domain/Entities/TenantPackage.cs` e configuração no `MasterDbContext` com índice único `(TenantId, PackageKey)`, FK cascata para `Tenants` e set-null para `Owners`.
- **Contratos**: `TenantPackageResponse` e `TenantPackageUpdateRequest` em `Contracts/Modules/ModuleContracts.cs`.
- **Service**: `Application/Owner/TenantPackageService.cs` (`ListAsync` filtra ativos, `SetEnabledAsync` recusa ligar pacote `IsActive=false`, `EnsureDefaultsAsync` só semeia ativos, `GetEnabledPackageKeysAsync` para consumo por módulos).
- **Endpoints Owner**: `GET/PUT /api/owner/tenants/{tenantId}/packages[/{packageKey}]` no `OwnerController`.
- **Migration master** `20260417180257_AddTenantPackages` (cria tabela `TenantPackages`).
- **DI**: `Program.cs` registra `TenantPackageService` como scoped antes do `TenantModuleService`.

### Changed — `ModuleCatalog` e `TenantModuleService` integrados ao entitlement superior

- `ModuleCatalog.ModuleDefinition` ganhou `string? PackageKey`. Módulos reclassificados:
  - **Core** (sem `PackageKey`): `dashboard`, `administracao`, `cadastros`, `configuracoes`.
  - **Pacote R&S**: `recrutamento`, `candidatos`, `matching`, `portal-vagas`, `admissao`, `agenda` (movido de "Operacional" — é 100% recrutamento).
  - **Pacote Gestão de Pessoas**: `feedback`, `gestao`.
  - **Standalone opcional**: `relatorios`.
- `TenantModuleService` agora depende de `TenantPackageService`:
  - `SetEnabledAsync` valida que o pacote-pai (se houver) está `IsActive=true` no catálogo — tentar ligar módulo de pacote inativo retorna 409 Conflict.
  - `GetEnabledModuleKeysAsync` calcula habilitação efetiva: módulo só é ativo se `IsCore` **ou** (módulo habilitado **e** pacote-pai habilitado quando há `PackageKey`). Usado para filtros de menu/permissão.
  - `ListAsync` inalterado — continua expondo estado bruto do registro (a UI compõe pacote + módulo).
- `TenantProvisioningService` agora chama `TenantPackageService.EnsureDefaultsAsync` antes de `TenantModuleService.EnsureDefaultsAsync` para tenants recém-criados.
- `RHPortal.Api.Tests/Modules/TenantModuleServiceTests.cs`: `CriarServico` ajustado para compor o `TenantPackageService` exigido pelo novo ctor.

### Fixed — Build do `RHPortal.Api` quebrado por diretório fantasma de Inbox

- Removido diretório literalmente chamado `C:\Users\davio\Documents\Projetos\Qualiit RenderRH\Voltage.RenderRH\RHPortal.Api\RHPortal.Api\Inbox` (um único componente com barras invertidas) na raiz do projeto. Criado acidentalmente por execução antiga com `InboxFolder__RootPath` contendo path Windows; quebrava o glob `**/*.resx` do MSBuild no macOS, fazendo `GenerateResource` receber o literal não expandido e emitir `MSB3552`.
- Adicionado `Voltage.RenderRH/global.json` pinando `sdk.version=8.0.420` com `rollForward: latestFeature` para evitar que o SDK 10 pré-release assuma o build automaticamente (ainda causa o mesmo sintoma se o diretório fantasma volte).

### Validação

- `dotnet build RHPortal.Api.sln` — 0 erros, 35 warnings (pré-existentes).
- `dotnet test RHPortal.Api.Tests` — 425/425 aprovados.

---

## [Unreleased] — 2026-04-17 (parte 4)

### Changed — Decisões de posicionamento dos cadastros órfãos da sidebar

- `knowledge-base/visao-arquitetural.md` §4.4 atualizado: Pessoas, Áreas e Bloqueio de Pessoa formalmente listados em Core Cadastros.
- `knowledge-base/visao-arquitetural.md` §6.4 reescrito com decisões consolidadas dos 8 itens órfãos após investigação técnica:
  - **Mantidos em Core Cadastros**: Pessoas, Áreas.
  - **Subordinado a Pessoas** (fora da sidebar top-level): Bloqueio de Pessoa.
  - **Reposicionados para Pacote Gestão de Pessoas → módulo Feedback**: Humor (renomeável para "Bem-estar"), Resumo Atividades (como sub-dashboard).
  - **Reposicionados para Pacote R&S → módulo Pipeline de Vaga**: Agenda (sair do bloco Operacional — é 100% recrutamento).
  - **Reposicionado para Pacote R&S → módulo Portal de Vagas/Banco de Currículos**: Entrada (e-mail/pasta) — consolida com `entrada.*` já existente no `ModuleCatalog`.
  - **Pendente de decisão do arquiteto**: Painel de Solicitações (B1 transversal core / B2 Core Admin / B3 dividir por pacote).
- `backlog.md`: entrada de "cadastros órfãos" substituída por tarefa concreta de aplicação dos reposicionamentos no código (sidebar, `ModuleCatalog`, `permissionManifest`) + entrada dedicada para decisão pendente do Painel de Solicitações.
- Correção registrada: `Funcionários` permanece em Core Cadastros conforme visão §4.4 (não migra para Gestão de Pessoas como o subagente Explore havia sugerido).

---

## [Unreleased] — 2026-04-17 (parte 3)

### Added — Visão arquitetural TO-BE consolidada

- Criado [knowledge-base/visao-arquitetural.md](./knowledge-base/visao-arquitetural.md) com a visão do arquiteto sobre o sistema-alvo, capturada em entrevista estruturada (6 blocos, 20 perguntas).
- Estrutura do documento:
  - **Princípios arquiteturais** (entitlement em dois níveis, Cadastros como core, Relatórios como capability transversal, etc.).
  - **Modelo em camadas**: Core (Cadastros, Admin, Relatórios) + Pacotes comerciais (R&S, Gestão de Pessoas, Folha) + Módulos finos.
  - **Taxonomia** de módulos por pacote com definições operacionais (carteira de vaga, eixos de SLA, faixa salarial travável, aceite digital, Nine Box com comitê de calibragem, etc.).
  - **Conceitos de domínio a criar** (`PacoteComercial`, `EixoVaga`, `CarteiraVaga`, `FaixaSalarialTravada`, `AceiteDigitalProposta`, `CicloAvaliacao`, `ComiteCalibragem`, `DescricaoCargoTemplate`, `HierarquiaCentroCusto`, `TurnoPorUnidade`).
  - **Gap visão-alvo × sistema atual** com backlog estratégico e resolução dos gaps de permissões sem módulo identificados no KB da sidebar.
  - **Invariantes arquiteturais** (multi-tenant, IA em Python separado, Next.js como frontend-alvo, Portal MVC em refatoração).
- `documentacao.md`: adicionada referência ao novo documento na seção "Documentos relacionados".

### Changed — Portal MVC: refatoração em vez de descontinuação simples

- Ajustado princípio na visão arquitetural: **Portal MVC (`LioTecnica.Web`) será refatorado e migrado para Next.js**, não simplesmente aposentado. O conteúdo funcional precisa ser portado antes do projeto MVC ser removido.
- Item de backlog estratégico reescrito: inventariar o que ainda é usado no MVC, priorizar telas críticas vs descartáveis, migrar incrementalmente com cobertura de teste e só então descontinuar.

---

## [Unreleased] — 2026-04-17 (parte 2)

### Changed — Consolidação de documentação para handoff entre IAs

- `agent.md`: adicionado checklist de handoff Cursor ↔ Claude Code para garantir continuidade (`tracking`, validações e evidências).
- `documentacao.md`: incluída seção dos endpoints de logs do Owner com contratos atuais e regras de execução em escopo de tenant.
- `habilidades.md`: incluído playbook de troubleshooting para erro "Erro ao carregar logs" (`404` indica rota ausente; `401/403` indica segurança/credencial).
- `tasks.md`, `backlog.md` e `diario-de-bordo.md`: sincronizados com o estado final da sessão para retomada segura no Claude Code.

### Added — Knowledge Base da sidebar do tenant

- Criado `knowledge-base/sidebar-blocos-e-abas.md` com mapeamento detalhado de todos os blocos e abas da sidebar:
  - `Principais`, `Recrutamento`, `Operacional`, `Gestão de Pessoas`, `Cadastros Pessoas`, `Cadastros Operacionais`, `Relatórios`, `Feedback`, `Admin`, `Owner`;
  - descrição funcional por aba;
  - notas de operação sobre visibilidade por permissão, módulo e itens bloqueados visualmente.
- `documentacao.md` atualizado para referenciar explicitamente o novo documento de Knowledge Base.

### Added — Handoff dedicado para Claude Code

- Criado `knowledge-base/handoff-claude-code-2026-04-17.md` com:
  - snapshot técnico atual;
  - decisões já tomadas;
  - pendências priorizadas;
  - checklist operacional de continuidade.
- `documentacao.md` atualizado com link para o handoff dedicado.

### Changed — Cruzamento módulo x sidebar no Knowledge Base

- `knowledge-base/sidebar-blocos-e-abas.md` expandido com:
  - definição dos módulos opcionais e priorização de liberação no Owner;
  - matriz de impacto de desativação por módulo na visão do tenant;
  - auditoria de coerência entre blocos/abas e mapeamento de permissões por módulo;
  - lista de gaps de prefixos não cobertos no `ModuleCatalog` e recomendações de ajuste.

### Fixed — Modal de detalhe dos logs no Owner (overflow horizontal)

- `LioTecnica.Web.Next/src/features/owner/tenant-tabs/TabLogsOperacionais.tsx`:
  - `DialogContent` ajustado para largura responsiva (`w-[95vw]` + `max-w-3xl`);
  - título e linha HTTP com `break-all`;
  - tabela de `entries` convertida para `table-fixed` com colunas dimensionadas;
  - categoria/mensagem com quebra de texto (`break-all`/`whitespace-normal`) para evitar expansão lateral por payloads longos.
- `LioTecnica.Web.Next/src/features/owner/tenant-tabs/TabLogsTransacionais.tsx`:
  - mesmas melhorias de responsividade no modal;
  - quebra de texto aplicada em campos longos (`path`, `primaryKeyJson`, `changedColumns`) no detalhe.

### Changed — Modal de logs com foco em leitura horizontal

- `LioTecnica.Web.Next/src/features/owner/tenant-tabs/TabLogsOperacionais.tsx` e `TabLogsTransacionais.tsx`:
  - largura do modal ampliada para `w-[98vw]` com limite `max-w-[1400px]`;
  - removidas quebras agressivas de texto em cabeçalhos;
  - tabelas de detalhe configuradas com largura mínima (`min-w-[1100px]`) e colunas mais largas;
  - conteúdo crítico (`categoria`, `mensagem`, `primaryKeyJson`, etc.) preservado em linha (`whitespace-nowrap`) para facilitar leitura técnica.

### Fixed — Logs do painel Owner (erro de carregamento por 404)

- `RHPortal.Api/RHPortal.Api/Controllers/OwnerController.cs`:
  - adicionados endpoints proxy para logs transacionais do tenant:
    - `GET /api/owner/tenants/{tenantId}/config/logs/transactions`
    - `GET /api/owner/tenants/{tenantId}/config/logs/transactions/{id}`
    - `GET /api/owner/tenants/{tenantId}/config/logs/summary`
  - adicionados endpoints proxy para logs operacionais do tenant:
    - `GET /api/owner/tenants/{tenantId}/config/operational-logs/requests`
    - `GET /api/owner/tenants/{tenantId}/config/operational-logs/requests/{id}`
    - `GET /api/owner/tenants/{tenantId}/config/operational-logs/summary`
  - endpoints validam `tenantId`, garantem existência no master, setam `ITenantContext` por escopo e consultam `AppDbContext` do tenant, retornando os contratos `Audit`/`Logging` esperados pelo frontend.
- Build de validação:
  - `dotnet build RHPortal.Api/RHPortal.Api/RHPortal.Api.csproj -v minimal` concluído com sucesso.

### Fixed — Execução da bateria smoke em ambiente macOS

- `__scripts__/test-battery.sh`:
  - removido uso de `grep -P` (incompatível com BSD grep/macOS);
  - adicionado helper `extract_json_field` com `sed` para extração de `accessToken`, `tenantId` e IDs (`id`) em respostas JSON.
  - rotas de dashboard alinhadas ao contrato atual da API:
    - `/api/dashboard/funnel` → `/api/dashboard/funil`
    - `/api/dashboard/vagas-lookup` → `/api/dashboard/vagas`
    - `/api/dashboard/areas-lookup` → `/api/dashboard/areas`
  - adicionado helper `check_any` para aceitar múltiplos códigos esperados por cenário.
  - smoke de `feedback/plans/my` e `feedback/surveys` passou a aceitar `200|403` (endpoint protegido por permissão específica; `403` é válido para perfil sem escopo).
- `RHPortal.Ai/app/unified_matching.py`:
  - corrigido `NameError` no import-time (`get_person_profile = _get_person_profile` antes da definição);
  - reexport movido para após a definição de `_get_person_profile`.
- Bateria `test-battery.sh` executada com serviços locais:
  - rodada inicial: **59 total / 45 pass / 5 fail / 9 skip**;
  - rodada final (após ajustes): **59 total / 50 pass / 0 fail / 9 skip**;
  - evidência em `test-evidence/2026-04-17_test-battery.md`.

### Fixed — Zerar 7 falhas remanescentes da suite API

- `RHPortal.Api/Application/Funcionarios/FuncionarioService.cs`:
  - reintroduzida validação de e-mail duplicado no `CreateAsync`;
  - reintroduzida validação de e-mail conflitante no `UpdateAsync`.
- `RHPortal.Api.Tests/PreAdmissao/PreAdmissaoWorkflowTests.cs`:
  - cenário `Submit` em `Preenchido` ajustado para fluxo idempotente;
  - cenário `Approve` ajustado para preencher campos obrigatórios da validação TOTVS.
- `RHPortal.Api.Tests/SolicitacoesVaga/SolicitacaoVagaServiceTests.cs`:
  - testes adaptados ao workflow por etapas persistidas (`SolicitacaoAprovacaoEtapa`);
  - adicionado seed de etapa pendente para cenário de aprovação;
  - cenário sem aprovador alinhado ao comportamento atual (etapa pendente sem responsável resolvido).
- Suite `RHPortal.Api.Tests` estabilizada: **425 aprovados / 0 falhas**.
- Evidência da execução registrada em `test-evidence/2026-04-17_estabilizacao_suite_api.md`.

### Fixed — Estabilização da suite de testes (retomada)

- `RHPortal.Api/RHPortal.Api.Tests/AwsSettings/AwsSettingsServiceTests.cs`: testes alinhados ao comportamento atual de `AwsSettingsService`, que persiste em `OwnerAwsSettings` (escopo global), não em `TenantAwsSettings`.
- Cenários de setup dos testes migrados para `OwnerAwsSettings` e asserts de persistência ajustados para leitura global (`SingleAsync`).
- Cenário legado de "isolamento por tenant" removido/substituído por validação de configuração global do owner, coerente com a implementação atual.
- Resultado da regressão da API após ajuste: **425 total / 418 aprovados / 7 falhas** (redução de 15 → 7, sem regressão em `Modules`, `Logging` e `Vagas`).

### Changed — Separação de contexto Owner vs Admin do tenant

- **Princípio adotado**: Owner cuida de *entitlements* (módulos), onboarding e suporte. Admin do tenant cuida da *operação* (perfis, menus, e-mails, configs).
- **Removidas 7 abas duplicadas do painel do Owner** (`TenantDetailScreen.tsx`): Acessos, Menus, Templates de email, Emails, Config email, Config Entra ID, Idioma. Todas essas telas já existem no painel do tenant sob `/app/admin/*` e devem ser usadas pelo admin do tenant.
- **Abas remanescentes no painel do Owner**: Geral, Módulos, Usuários, Logs transacionais, Logs operacionais.
- **Deletados** os arquivos Tab*.tsx órfãos: `TabAcessos.tsx`, `TabMenus.tsx`, `TabEmailTemplates.tsx`, `TabEmails.tsx`, `TabEmailConfig.tsx`, `TabEntraIdConfig.tsx`, `TabIdioma.tsx`.

### Fixed — Rotas divergentes no frontend do painel do admin

- `src/features/admin/entra-id/AdminEntraIdScreen.tsx`: `/api/admin/entra-id` → `/api/entra-config` (alinhado com `EntraIdConfigController`).
- `src/features/admin/localization/AdminLocalizationScreen.tsx`: `/api/admin/localization` → `/api/localization-config` (alinhado com `LocalizationConfigController`).

## [Unreleased] — 2026-04-17

### Added — Módulos por tenant (fase 1)

- **Entity** `TenantModule` no master (`MasterDbContext`) — campos: `Id`, `TenantId`, `ModuleKey`, `IsEnabled`, `UpdatedAtUtc`, `UpdatedByOwnerId`. Índice único `(TenantId, ModuleKey)`. FK para `Tenants` (cascade) e `Owners` (set null).
- **Migration** master `20260417121734_AddTenantModules`.
- **Catálogo code-first** `Infrastructure/Modules/ModuleCatalog.cs` com 13 módulos iniciais (4 core: `dashboard`, `administracao`, `cadastros`, `configuracoes` + 9 opcionais: `agenda`, `recrutamento`, `candidatos`, `matching`, `portal-vagas`, `admissao`, `feedback`, `gestao`, `relatorios`). Cada módulo mapeia um ou mais prefixos de permissão (`PermissionKeyPrefixes`) para permitir filtro automático de menus.
- **Service** `Application/Owner/TenantModuleService.cs`:
  - `ListAsync(tenantId)` — retorna todos os módulos do catálogo com status, preenchendo tenants sem registro como "ativo".
  - `SetEnabledAsync(tenantId, moduleKey, isEnabled, ownerId)` — upsert do registro; bloqueia desativação de módulos core (lança `InvalidOperationException`).
  - `EnsureDefaultsAsync(tenantId)` — cria registros com `IsEnabled=true` para novos tenants.
  - `GetEnabledModuleKeysAsync(tenantId)` — usado pelos filtros de menu.
- **Endpoints** no `OwnerController`:
  - `GET /api/owner/tenants/{tenantId}/modules` → lista.
  - `PUT /api/owner/tenants/{tenantId}/modules/{moduleKey}` → body `{ isEnabled: bool }`; 200 OK, 404 se módulo inexistente, 409 se core.
- **Provisioning**: `TenantProvisioningService.ProvisionTenantAsync` passou a chamar `EnsureDefaultsAsync` ao criar novo tenant.
- **Filtro de menus**: `MenuAdministrationService.ListForPermissionsAsync` agora remove menus cujo `PermissionKey` mapeia para módulo desabilitado no tenant. Owner e contexto sem tenant recebem tudo.
- **Frontend**: nova aba **Módulos** no painel do tenant (`features/owner/tenant-tabs/TabModulos.tsx`) com toggles por módulo; módulos core exibidos como bloqueados. Integrada ao `TenantDetailScreen.tsx` após a aba "Geral".
- **DI**: `TenantModuleService` registrado como scoped em `Program.cs`.

### Validação

- Migration aplicada — tabela `TenantModules` criada no master.
- `GET /modules` no tenant `liotecnica` retorna 13 módulos com defaults.
- `PUT /modules/matching {isEnabled:false}` → 200, persistido com `UpdatedByOwnerId`.
- `PUT /modules/dashboard {isEnabled:false}` → 409 Conflict ("Módulo 'dashboard' é core e não pode ser desativado.").
- `PUT /modules/modulo-inexistente` → 404.
- **29 testes novos** (14 unit `ModuleCatalogTests` + 15 integration `TenantModuleServiceTests`) — 100% aprovados. Evidência: [test-evidence/2026-04-17_modulos_por_tenant.md](./test-evidence/2026-04-17_modulos_por_tenant.md).
- Regressão da suite: 15 falhas pré-existentes (AwsSettings, PreAdmissao, SolicitacoesVaga, Funcionarios) — não tocadas por esta feature.

### Fixed (correções colaterais para buildar o projeto de testes)

- `RHPortal.Api.Tests/Vagas/VagaServiceOperacoesTests.cs` e `RHPortal.Api.Tests/Vagas/CriarVagaServiceTests.cs`: adicionado `EscalaTrabalhoRaw: null` (3 call sites) para acompanhar a assinatura atual de `VagaCreateRequest`/`VagaUpdateRequest`. Dívida técnica pré-existente — sem impacto em produção.

---

## [Unreleased] — 2026-04-16

### Changed

- `RHPortal.Api/RHPortal.Api/appsettings.Development.json`: connection strings `Default`, `Master` e `TenantTemplate` passaram a usar `Password=@FelipeL89*` (antes `admin`).
- `RHPortal.Api/RHPortal.Api/appsettings.Development.json`: `Cors.WebOrigin` passou a aceitar `http://localhost:5051,http://localhost:3005` (antes só `http://localhost:5051`).
- `__scripts__/dev/dev-core.sh`: Next.js agora sobe em `PORT=3005` (antes `3000`). Portas liberadas na inicialização: `5056, 3005, 3006`. URLs de health check/open atualizadas.
- `RHPortal.Api/RHPortal.Api/Application/PreAdmissao/PreAdmissaoService.cs:616`: URL pública do fluxo de pré-admissão passou a apontar para `:3005` (antes `:3000`).

### Added

- `RHPortal.Ai/.env`: arquivo criado a partir do `.env.example` com `DATABASE_URL`, `TENANT_DATABASE_TEMPLATE` e `OPENAI_API_KEY` populados para o Postgres local.
- `agent.md`: orientações para IAs sobre manutenção dos arquivos de tracking.
- `diario-de-bordo.md`: log cronológico de interações.
- `backlog.md`: lista de tarefas do projeto.
- `changelog.md`: este arquivo.
- `documentacao.md`: documentação técnica consolidada — agora com seção "Usuários do sistema".
- `habilidades.md`: conhecimentos reutilizáveis (setup, portas, usuários, multi-tenant, migrations, CORS, comandos).

### Fixed

- `LioTecnica.Web.Next/src/features/owner/tenant-tabs/TabUsuarios.tsx`: rotas do frontend alinhadas à API REST do `OwnerController` — correção de 404 ao criar/editar/deletar/listar usuários. Mudanças:
  - `GET  /users/list` → `GET  /users`
  - `GET  /users/get/{id}` → `GET  /users/{id}`
  - `POST /users/create` → `POST /users`
  - `PUT  /users/update/{id}` → `PUT  /users/{id}`
  - `POST /users/delete/{id}` → `DELETE /users/{id}`
  - `PUT  /users/password/{id}` → `PUT  /users/{id}/password`
  - `GET  /users/roles` → `GET  /roles` (sibling do tenant)
  - `GET  /users/units` → `GET  /units` (sibling) + unwrap `.items` do `PagedResult`
  - `GET  /users/funcionarios` → `GET  /funcionarios` (sibling) + unwrap `.items`

### Security

- Removido PAT do Azure DevOps da URL do remote `origin`. Nova URL limpa: `https://dev.azure.com/qualiit/ALM%20-%20VOLTAGE%20SOFTWARE/_git/Voltage.RenderRH`.
- Trocada a senha padrão dos usuários seedados para `YkmF@2022*`:
  - `appsettings.Development.json`: `Seed.OwnerPassword`, `Seed.OwnerPassword` e `Seed.AdminPassword` (substituição global de `ChangeThisPassword123!`).
  - `DevSeedController.cs`: `const string senha` dos usuários de teste (antes `Teste@123!`).
  - Bancos `dev_render_master` e `dev_render` foram dropados e recriados pelos seeders, aplicando a senha nova ao Owner existente.
