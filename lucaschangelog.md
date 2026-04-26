# lucas — Changelog pessoal

> **Autor:** Lucas Machado · **Branch:** `feature/ia-rag-fase-4-5_v2`
> Histórico do que **eu** efetivamente fiz no projeto. Independente do `changelog.md` global do time. Cada entrada vincula ao item do `lucasbacklog.md` quando aplicável.

> **Convenção:** entradas em ordem reversa (mais recente em cima). Cabeçalho de cada dia: `## YYYY-MM-DD`. Cada item: tipo (✨ feature, 🐛 bugfix, 🔧 refactor, 📝 docs, 🏗️ infra, 🔬 spike) + título + impacto resumido + commit/PR (quando houver).

---

## 2026-04-26

### 🧹 chore · A+B — Limpeza pós-épico LLM-agnóstico (LUC-014, LUC-022, AssistenteIa 503)
- **Itens backlog:** LUC-014 e LUC-022 encerrados; LUC-012 marcado como parcial (60% coberto pela Fase 5); LUC-001/002/010/013/020/021 documentados como "🛑 BLOQUEADO" com nota explicando o que destrava cada um; LUC-023 marcado como coberto pelo `lucasRUNBOOK_IA.md`. LUC-003 e LUC-004 ficam "📋 PRONTO PARA TOCAR" (sem bloqueador).
- **Contexto:** Após fechar o épico LLM-agnóstico (5 fases), faxinada de "ranchos abertos" — 3 entregas pequenas + reorganização do backlog para deixar claro o que pode ser tocado solo vs o que precisa de input externo (Leonardo, dados reais, AWS).
- **O que foi entregue:**
  - **LUC-014** — `RHPortalAiHealthCheck : IHealthCheck` em `Infrastructure/HealthChecks/`. Bate em `{RhAi.BaseUrl}/health/ready` com timeout 3s. Reporta `Healthy` (200), `Degraded` (non-2xx — Python responde mas não pronto), `Unhealthy` (timeout/rede). Quando `RhAi.BaseUrl` vazio, retorna `Healthy/skipped` para evitar falso negativo. Registrado em `AddHealthChecks()` com `failureStatus: Degraded` (Python down não tira API do ar). `appsettings.Development.json` ganhou `"RhAi.BaseUrl": "http://localhost:8000"` para o check virar real em dev.
  - **AssistenteIaController + 503** — pendência da Fase 5. Criei `RequireAiModuleAttribute` em `Infrastructure/Filters/` (action filter `IAsyncActionFilter`); aplicado em 5 endpoints (`/chat`, `/chat/stream`, `/descricao-cargo/gerar`, `/cv/resumir/{id}`, `/vagas/sugerir-salario/{id}`, `/embeddings/reindexar`). `/health` do assistente NÃO recebe (é status do Ollama, faz sentido ficar sempre disponível). Resposta 503 com mesmo `ProblemDetails` do `AiController` (`reason: ModuleDisabled`, `tenantId`, `detail` amigável).
  - **LUC-022** — 8 HTMLs (`EntradaEmailPasta`, `Matching`, `candidatos`, `dashboardv1`, `relatorios`, `triagem`, `usuarios_perfis`, `vagas`) movidos via `git mv` para `__analise__/mockups-mvc/`. Verificado antes que **só docs `lucas*`** referenciavam — zero código produtivo afetado. `lucasVISAO_GERAL.md` atualizado para apontar nova localização.
  - **LUC-012 doc** — atualizado no backlog dizendo que ~60% já foi entregue na Fase 5 (logs estruturados + endpoint `/api/admin/ai/metrics` + healthcheck). Pendente: exporter Prometheus formal, métricas P50/P90/P95 (precisa dados reais), dashboard Grafana.
  - **Bloqueadores documentados** no backlog: LUC-001 (DB zerado), LUC-002 (depende de LUC-001 + decisão arquitetural), LUC-010 (precisa ground-truth), LUC-013 (sem Datasul de teste), LUC-020 (sem mailbox de teste), LUC-021 (sem AWS prod). Cada item tem nota "Para destravar: ..." explicando o que falta.
- **Validação:**
  - `GET /health` → `rhportal_ai: Healthy "RHPortal.Ai OK"` ✅
  - `POST /api/assistente-ia/chat` com IA ON → `200 — "pong"` ✅
  - `POST /api/assistente-ia/chat` com IA OFF → `503 ProblemDetails` ✅
  - `POST /api/assistente-ia/descricao-cargo/gerar` com IA OFF → `503 ProblemDetails` ✅
  - Raiz limpo de HTMLs ✅
  - Build "Compilação com êxito" ✅
- **Arquivos:** 2 novos (`RHPortalAiHealthCheck.cs`, `RequireAiModuleAttribute.cs`) + 4 modificados (`Program.cs`, `AssistenteIaController.cs`, `appsettings.Development.json`, `lucasVISAO_GERAL.md`) + 8 movidos (HTMLs raiz → `__analise__/mockups-mvc/`).
- **Commit:** *(pendente)*
- **Estado do backlog após esta limpeza:**
  - ✅ Concluídos: LUC-014, LUC-022, LUC-023 (coberto), Fase 5 (LUC-113), LUC-117
  - 🟡 Parcial: LUC-012 (60%)
  - 📋 Pronto pra tocar solo: LUC-003 (~2h), LUC-004 (~2.5h), LUC-115 (5-8h, com risco), LUC-110b (12-16h, refactor grande), LUC-116 (~1.5h)
  - 🛑 Bloqueado por input externo: LUC-001, LUC-002, LUC-010, LUC-013, LUC-020, LUC-021, LUC-101, LUC-102

### ✨ feature · Fase 5 (ÚLTIMA) do épico LLM-agnóstico — Observabilidade + 503 estruturado + runbook · 🎯 ÉPICO FECHADO
- **Itens backlog:** LUC-113 e LUC-117 encerrados.
- **Contexto:** Fechamento do épico iniciado em 2026-04-25. Fases 1-4 entregaram a infraestrutura (factories Python+.NET, escolha por tenant, on/off por tenant). Faltava observabilidade decente e runbook operacional para que o time consiga **operar** o sistema em prod sem precisar abrir o código toda vez. LUC-117 (refinement de 404→503) foi puxado pra Fase 5 já que mexia nos mesmos arquivos.
- **O que mudou:**
  - **`Contracts/Ai/AiContracts.cs`** — `AiUnavailableReason` enum (`ModuleDisabled`, `NoProviderConfigured`, `ProviderResolutionFailed`) + `AiInvokeOutcome` record (`Response?`, `Reason?`, `Detail?`).
  - **`Application/Ai/UnifiedAiService.cs`** — novo método `InvokeWithOutcomeAsync` retorna o outcome estruturado; `InvokeAsync` legacy delega. **Logging estruturado em todas as paths**: sucesso (`ai.invoke tenant=X user=Y provider=Z model=W module=M latency_ms=N cost_usd=C from_config=B content_len=L`), bloqueado (`ai.invoke tenant=X status=blocked reason=ModuleDisabled module=M`).
  - **`Controllers/AiController.cs`** — usa `InvokeWithOutcomeAsync`; quando `outcome.Response == null`, monta `ProblemDetails` com `Status=503`, `Title` legível, `Detail`, e `Extensions[reason]` + `Extensions[tenantId]`. Retorna `503 Service Unavailable`.
  - **Novo:** `Controllers/AiMetricsController.cs` — endpoint `GET /api/admin/ai/metrics?days=N` (default 30, max 365). Admin-only, scoped por tenant atual. Agrega `AiUsageRecord` em `byModule`, `byModel` (com nome do provider), `byDay`. Retorna `totalCalls` e `totalCostUsd`.
  - **Novo:** `lucasRUNBOOK_IA.md` — 7 seções operacionais: visão 30s, sintomas comuns + diagnóstico, métricas, rotação de chave sem downtime, mudar provider em prod, pegadinhas conhecidas (LUC-115/116), comandos cola-rápida, escalação por tipo de reclamação.
- **Validação (smoke test passou):**
  - Invoke com módulo ON → `200 — "alpha"` cost $8.1e-06
  - Owner desliga módulo `ai`
  - Invoke com módulo OFF → `503 ProblemDetails`: `{title: "IA desabilitada para este tenant", reason: "ModuleDisabled", tenantId: "liotecnica", detail: "...Contate o owner..."}`
  - Religa + invoke → `200 — "beta"` cost $7.2e-06
  - `/api/admin/ai/metrics?days=7` → JSON estruturado (totalCalls, byModule, byModel, byDay)
  - Logs estruturados gravados ao vivo, fáceis de grep
- **Limitação documentada (lucasIA_RAG.md §20.4):** `/api/admin/ai/metrics` agrega `AiUsageRecord`, que só persiste quando provider vem do DB (`AiProviderKey`). Quando vem do fallback config (`appsettings.Ai.{Provider}.ApiKey`), só os logs estruturados ficam. Em prod com chaves cadastradas no Owner UI, métricas funcionam normalmente.
- **Arquivos:** 1 novo controller (`AiMetricsController`) + 1 novo doc (`lucasRUNBOOK_IA.md`) + 3 modificados (`AiContracts.cs`, `UnifiedAiService.cs`, `AiController.cs`).
- **Commit:** *(pendente)*
- **🎯 Épico LLM-agnóstico FECHADO** — 5 fases entregues em 2 dias (2026-04-25 a 26). Próximas evoluções voltam para o backlog ad-hoc:
  - **LUC-115** (alta): reconciliar caminho Python `embeddings.py` com schema real (tabelas dedicadas vs colunas inline)
  - **LUC-116** (média): resolver "estrito" quando tenant escolhe provider sem chave
  - **LUC-110b** (média): trocar `IOllamaClient` direto pelo factory nos 7 serviços que ainda dependem dele
  - Pendente Fase 5+: estender padrão 503/ProblemDetails do `AiController` para `AssistenteIaController` (chat, descricao-cargo, sugerir-salario, cv-resumir)
- **Docs atualizadas:** `lucasIA_RAG.md` (§16.7 + §19.6 + §20 nova), `lucasINDEX.md` (entrada do RUNBOOK), `lucasbacklog.md` (LUC-113 e LUC-117 fechados).

### ✨ feature · Fase 4 do épico LLM-agnóstico — Owner liga/desliga IA por tenant + UI tenant respeita disponibilidade real
- **Item backlog:** LUC-112 (encerrado). LUC-117 adicionado como melhoria.
- **Contexto:** Após Fases 1-3 (multi-provider + escolha por tenant), faltava o "switch master" — owner controlando se cada cliente tem direito a IA, e a UI tenant honrando essa decisão. Investigação revelou que `/Owner/IA` **já era funcional** (CRUD chaves dos 3 providers + modelos + dashboard usage); minha doc inicial chamou de "esqueleto" erroneamente. Escopo real da Fase 4 ficou no gating + UX.
- **O que mudou:**
  - **`Infrastructure/Modules/ModuleCatalog.cs`** — novo módulo standalone `"ai"` (transversal, sem PackageKey). Default ON em tenants novos via `EnsureDefaultsAsync`. Para tenants existentes, o `DbSeeder.MigrateAndSeedAsync` chama `EnsureDefaults` no startup → módulo aparece automaticamente sem migration.
  - **`Application/Ai/TenantAiSettingsResolver.cs`** — `IsAiEnabledAsync()` consulta `TenantModuleService.GetEnabledModuleKeysAsync` via `IServiceProvider` lazy (não falha em endpoints owner-level). Owner/system sempre retorna `true` (não há "tenant" para gating).
  - **`Application/Ai/UnifiedAiService.cs`** — early-return no início de `InvokeAsync`: se módulo `ai` off, loga info e devolve `null`. AiController traduz para 404 (ver LUC-117 para refinar para 503).
  - **`Application/TenantConfiguracao/TenantConfiguracaoService.cs`** — `TenantAiConfigDto` ganha `AvailableProviders` (intersecção: Master.AiProviderKey ativos + appsettings.Ai.{Provider}.ApiKey preenchidos + Ollama enabled) e `AiEnabled`. `BuildAiConfigDto` virou async. Injeta `MasterDbContext` e `ITenantAiSettingsResolver`.
  - **`LioTecnica.Web.Next/src/features/admin/ia/IaConfigScreen.tsx`** — banner amarelo "IA não habilitada" quando `aiEnabled=false`; banner separado "nenhum provider com chave"; dropdowns filtrados via `buildProviderOptions(availableProviders)`. Imports `AlertTriangle`.
- **Validação (smoke test 7/7):**
  - Estado inicial liotecnica: `aiEnabled=true`, `availableProviders=['gemini','ollama']`
  - Invoke com IA ON → `200 — "AI is on."` ($9.3e-06)
  - `PUT /api/owner/tenants/liotecnica/modules/ai {isEnabled:false}` → `200`
  - `GET /api/tenant-configuracao/ai` → `aiEnabled=false`
  - Invoke com IA OFF → `404` (esperado — UnifiedAiService devolveu null)
  - Religa → `200`
  - Invoke novamente → `200 — "voltei"` ($6.6e-06)
- **Hierarquia de gating documentada em `lucasIA_RAG.md` §19.3:**
  - Tenant tem IA? → Owner decide (TenantModule)
  - Quais providers? → Owner cadastra chaves (`/Owner/IA`)
  - Qual provider/modelo? → Admin do tenant escolhe (`/app/admin/ia`, Fase 3)
- **Arquivos:** 5 modificados (1 entidade catalog + 3 services .NET + 1 UI). Zero migration EF (módulo é code-first via `ModuleCatalog`, persistência via `EnsureDefaults`).
- **Commit:** *(pendente)*
- **Impacto:** modelo de licenciamento de IA fica viável — cliente "básico" sem IA, "pro" com Ollama local (zero custo + LGPD), "premium" com OpenAI/Gemini/Anthropic. Owner controla margem; admin do tenant tem autonomia dentro do que foi liberado.
- **LUC-117 adicionado:** AiController/AssistenteIaController devem retornar 503 (não 404) quando IA desabilitada — semanticamente mais correto, ajuda debug e UX no frontend.
- **Docs atualizadas:** `lucasIA_RAG.md` (§16.7 + §19 nova), `lucasMODULOS_FUNCIONALIDADES.md` (toggle no Owner), `lucasbacklog.md` (LUC-112 fechado, LUC-117 adicionado).

### ✨ feature · Fase 3 do épico LLM-agnóstico — Seleção de provider POR TENANT
- **Item backlog:** LUC-111 (encerrado). LUC-116 adicionado como melhoria.
- **Contexto:** Fases 1 e 2 deixaram o sistema multi-provider (OpenAI/Gemini/Anthropic/Ollama), mas a escolha era global (env var no Python, `appsettings.Ai.DefaultProvider` no .NET). Tenants diferentes não podiam ter providers diferentes. Esta fase muda isso: cada tenant escolhe seu provider/modelo na própria sidebar admin, persistido no banco do tenant, com fallback para o default global quando vazio.
- **O que mudou — backend .NET:**
  - **Novo:** `Application/Ai/TenantAiSettingsResolver.cs` — `ITenantAiSettingsResolver.GetCurrentAsync()` lê o `AppDbContext` do tenant atual via `IServiceProvider` lazy (não falha em endpoints owner-level sem tenant).
  - `Domain/Entities/TenantConfiguracao.cs` — 4 campos novos nullable: `LlmProvider`, `LlmModel`, `EmbeddingProvider`, `EmbeddingModel`. `null` = herda global.
  - **Migration EF** `20260425135252_AddLlmProviderFieldsToTenantConfiguracao` totalmente idempotente (`ADD COLUMN IF NOT EXISTS`), conforme `CLAUDE.md`. O scaffold gerou drift antigo do snapshot junto — também ficou idempotente para não quebrar tenants existentes.
  - `Application/Ai/UnifiedAiService.cs` — resolução ganha **passo 0**: se o tenant tem `LlmProvider` preenchido, força esse provider (filtra `Master.AiProviderKey` por nome; cai para `Ai.{Provider}` config quando sem chave).
  - `Application/TenantConfiguracao/TenantConfiguracaoService.cs` — DTOs `TenantAiConfigDto`/`TenantAiConfigRequest`, métodos `GetAiConfigAsync` / `UpsertAiConfigAsync`. Whitelist de providers (`openai|gemini|anthropic|ollama`); valores desconhecidos viram `null`. Calcula "effective" pós-fallback.
  - `Controllers/TenantConfiguracaoController.cs` — endpoints `GET /api/tenant-configuracao/ai` e `PUT /api/tenant-configuracao/ai` (admin only).
  - `Infrastructure/Ai/RHPortalAiMatchClient.cs` — cada payload para o Python carrega `llm_provider`, `llm_model`, `embedding_provider`, `embedding_model` do tenant atual.
  - `Program.cs` — registra `ITenantAiSettingsResolver` no DI.
- **O que mudou — Python:**
  - **Novo:** `app/request_context.py` — `RequestOverrides` + `use_request_overrides()` ContextManager via `contextvars` (thread/async-safe).
  - `app/main.py` — `MatchRequest` + `EvaluateOneRequest` ganham 4 campos opcionais; endpoints envolvem chamadas em `with use_request_overrides(...)`.
  - `app/llm_factory.py` — `get_chat_llm()` e `get_embeddings_client()` consultam `request_context.get_overrides()` antes do default.
- **O que mudou — frontend:**
  - **Novo:** `src/app/(app)/admin/ia/page.tsx` (rota `/app/admin/ia`).
  - **Novo:** `src/features/admin/ia/IaConfigScreen.tsx` — selects de provider, inputs de modelo, painel "effective", botão Salvar.
- **Validação (smoke test ponta-a-ponta com 2 tenants):**
  - Estado inicial sem override → `effective: gemini/2.5-flash` (global) ✅
  - PUT liotecnica → `anthropic/claude-3-5-haiku` → persistido + effective trocou ✅
  - dev (sem override) continua `gemini` (isolado por tenant) ✅
  - `/api/ai/invoke` em ambos retornou conteúdo real, cost contabilizado ✅
  - Revert liotecnica → null → effective volta a `gemini` global ✅
  - Migration aplicou nos 3 bancos (master + liotecnica + dev) automaticamente no startup ✅
- **Pendência descoberta (LUC-116):** quando tenant escolhe provider X mas X não tem chave, o resolver atual cai silenciosamente no próximo provider com chave. Mascara erro de configuração. Próxima sprint.
- **Arquivos:** 5 novos (`TenantAiSettingsResolver.cs`, `request_context.py`, migration .cs/.Designer.cs, `IaConfigScreen.tsx` + `page.tsx`) + 8 modificados.
- **Commit:** *(pendente)*
- **Impacto:** primeira feature multi-tenant de IA real — cada cliente escolhe seu próprio LLM dentro do que está disponível. Próxima fase amplia: Owner cadastra chaves e liga/desliga IA por tenant.
- **Docs atualizadas:** `lucasIA_RAG.md` (§17 ampliada com tabela de fases + §18 nova), `lucasMODULOS_FUNCIONALIDADES.md` (nova rota `/app/admin/ia`), `lucasbacklog.md` (LUC-111 encerrado, LUC-116 adicionado).

---

## 2026-04-25

### ✨ feature · Fase 2 do épico LLM-agnóstico — API .NET aceita OpenAI / Gemini / Anthropic via factory
- **Item backlog:** LUC-110 (encerrado)
- **Contexto:** Pós Fase 1 (Python provider-agnóstico), faltava a API .NET. O `UnifiedAiService` injetava `IAiProvider` único (OpenAI). Todos os fluxos OpenAI da API .NET (CV extract, doc validation via vision, `POST /api/ai/invoke`) ficavam refém desse provider.
- **O que mudou:**
  - **Novos:**
    - `Application/Ai/GeminiProvider.cs` — implementa `IAiProvider` via HTTP para Google Generative Language API (`generativelanguage.googleapis.com/v1beta/models/{m}:generateContent`). Suporta texto + vision (inline_data com `mime_type` e `data`). Estima custo simples por modelo (flash $0.30/1M, pro $3/1M).
    - `Application/Ai/AnthropicProvider.cs` — implementa `IAiProvider` para Anthropic Messages API (`api.anthropic.com/v1/messages`). Headers obrigatórios `x-api-key` + `anthropic-version: 2023-06-01`. Multimodal via `image` block. Custo por modelo (haiku/sonnet/opus, in/out separados).
    - `Application/Ai/AiProviderFactory.cs` — `IAiProviderFactory.Resolve(name)` enumera `IEnumerable<IAiProvider>` registrados e mapeia por nome canônico + aliases (OpenAI/Gpt/Azure, Gemini/Google, Anthropic/Claude, Stub).
  - **Refatorados:**
    - `Application/Ai/AiOptions.cs` — adiciona `GeminiOptions`, `AnthropicOptions`, `DefaultProvider`. Cada uma com `ApiKey`, `DefaultModel`, `ApiBase`.
    - `Application/Ai/UnifiedAiService.cs` — substitui injeção direta de `IAiProvider` por `IAiProviderFactory`. Resolução: (1) `Master.AiProviderKey` ativo se existe → usa; (2) senão, fallback por config respeitando `Ai.DefaultProvider`. Modela "ProviderResolution" interna para deixar o caminho explícito.
    - `Program.cs` — registra `OpenAiProvider`, `GeminiProvider`, `AnthropicProvider`, `AiProviderFactory` no DI.
    - `appsettings.Development.json` — seções novas `Ai.Gemini`, `Ai.Anthropic`, e `Ai.DefaultProvider="gemini"` para teste local.
- **Validação (smoke test):**
  - DB sem `AiProviderKey`, `Ai.OpenAI.ApiKey=""`, `Ai.Gemini.ApiKey="AIza..."`, `Ai.DefaultProvider="gemini"`.
  - `POST /api/ai/invoke` com prompt simples → resposta `{"result":"pong"}` do `gemini-2.5-flash` com cost `$1.68e-05`.
  - Build do `RHPortal.Api.csproj`: ✅ "Compilação com êxito".
  - API rodando no ar em `:5056`, login admin OK, endpoint `/api/ai/invoke` 200.
- **Pendência (intencionalmente fora):** os 7 serviços hoje amarrados em `IOllamaClient` direto (LlmAssistantService, EmbeddingService, VectorSearchService, DescricaoCargoGeneratorService, SalarioSuggesterService, CvResumoService, LlmMatchingService) **continuam Ollama-only** — registrado como **LUC-110b** no backlog. A migração desses serviços para um `ILlmClient`/`IEmbeddingClient` abstrato será feita junto com a Fase 3 (escolha por tenant), quando passa a fazer sentido cada tenant escolher seu provider.
- **LUC-115 ajustado:** descobri durante a investigação que o Python `embeddings.py` espera colunas inline `Vagas.embedding` que **não existem no schema atual** (.NET usa tabelas dedicadas `CandidatoEmbeddings`/`DescricaoCargoItemEmbeddings` `vector(1024)`). Atualizei o item no backlog com essa realidade e 3 opções de resolução.
- **Arquivos:** 3 novos + 5 modificados em `RHPortal.Api/`. Zero mudança em Python.
- **Commit:** *(pendente)*
- **Impacto:** qualquer tenant com chave Gemini ou Anthropic agora consegue rodar CV extract, doc validation e o endpoint genérico `/api/ai/invoke` sem nenhuma chave OpenAI.
- **Docs atualizadas:** `lucasIA_RAG.md` (§17 nova), `lucasSTACK_TECNOLOGICA.md` (§3.2.bis), `lucasINTEGRACOES.md` (seção 4 reescrita), `lucasbacklog.md` (LUC-110 fechado, LUC-110b adicionado, LUC-115 expandido).

### ✨ feature · Fase 1 do épico LLM-agnóstico — RHPortal.Ai suporta OpenAI / Gemini / Ollama
- **Item backlog:** LUC-100 (encerrado — desdobrado em LUC-110..LUC-115 para as demais fases)
- **Contexto:** Usuário precisava rodar a IA com chave Gemini sem ter chave OpenAI. O código exigia `OPENAI_API_KEY` hardcoded no startup e `ChatOpenAI` era direto em 3 pipelines. A Fase 1 torna o serviço Python **provider-agnóstico**.
- **O que mudou:**
  - **Novo:** `RHPortal.Ai/app/llm_factory.py` — expõe `get_chat_llm()`, `get_embeddings_client()`, `active_providers()`. Imports lazy por provider.
  - `config.py` — adiciona `LLM_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_CHAT_MODEL`, `GEMINI_LANGCHAIN_EMBEDDING_MODEL`, `OLLAMA_*`. Fail-fast agora é **condicional** ao provider escolhido.
  - `unified_matching.py`, `gemini_matching.py`, `matching.py` — todas as chamadas `ChatOpenAI(...)` e `OpenAIEmbeddings(...)` substituídas pelo factory. Type hints `llm: ChatOpenAI` → `llm: Any`. Guards redundantes de `if not OPENAI_API_KEY` removidos (o factory já valida).
  - `embeddings.py` — `get_embeddings_model()` virou wrapper retrocompat do factory.
  - `main.py` — `/health/ready` reporta `llm_provider`, `embedding_provider`, e valida a chave do provider **ativo** (não mais OpenAI hardcoded).
  - `requirements.txt` — `+ langchain-google-genai>=2.0.0`, `+ langchain-ollama>=0.2.0`.
  - `.env` — `LLM_PROVIDER=gemini`, `EMBEDDING_PROVIDER=gemini`, `GEMINI_API_KEY=...` (gitignored).
- **Validação:**
  - `python -m app.main` sobe sem `OPENAI_API_KEY`.
  - `GET /health/ready` → `{"status":"ok", "llm_provider":"gemini", "embedding_provider":"gemini", "gemini_key":"ok"}`.
  - Chat test via factory: Gemini 2.5 Flash respondeu `pong`.
  - Embedding test: `gemini-embedding-001` retornou vetor 3072-dim.
- **Arquivos:** 7 modificados + 1 novo (`llm_factory.py`). Zero `.NET` alterado.
- **Commit:** *(pendente)*
- **Impacto:** qualquer tenant pode rodar o matching IA com Gemini ou Ollama sem nenhuma conta OpenAI.
- **Pendência descoberta:** LUC-115 — Gemini gera 3072 dims mas a coluna `embedding` é `vector(1536)`. Persistência pode quebrar. Priorizar antes de migrar tenants para `EMBEDDING_PROVIDER=gemini` em produção.
- **Docs atualizadas:** `lucasIA_RAG.md` (§16 nova), `lucasSTACK_TECNOLOGICA.md` (§4.2, §4.3, §4.4.bis, §4.5), `lucasbacklog.md` (novos LUC-110..LUC-115).

### 🏗️ infra · Ambiente local up + push inicial no GitHub
- PostgreSQL 18.3 limpo (só `shieldops` preservado) + `dev_render`, `dev_render_master`, `dev_render_liotecnica`, `dev_render_dev` provisionados.
- RHPortal.Api (.NET :5056), LioTecnica.Web.Next (:3001), RHPortal.Ai (:8000) no ar.
- Login owner `owner@dev.local` e admin `admin@dev.local` validados.
- Branch `devops_Lucas` criada e pushada para https://github.com/munizlmachado-jpg/RH (remote `github`).
- **Importante:** push agora vai apenas para `github`. `origin` (Azure DevOps) fica intocado.

---

## 2026-04-24

### 📝 docs · Onboarding inicial — leitura completa do projeto + documentação derivada
- **O que fiz:**
  - Cloneei o repo do Azure DevOps (branch `feature/ia-rag-fase-4-5_v2`).
  - Naveguei pelo monorepo inteiro: frontend Next.js, API .NET, serviço Python de IA, worker de integração TOTVS, scripts, knowledge-base, dumps.
  - Li `README.md`, `CLAUDE.md`, `VISAO_GERAL_PROJETO.md`, `GUIA_IA_RAG.md`, `FLUXO_IA_MATCHING.md`, `STATUS_MATCHING_VETORIZADO.md`, `PLANO_EVOLUCAO_MATCHING_65_35.md`, `COMO_USAR_MATCHING_IA.md`, `INTEGRACAO-MOVIMENTACOES-DATASUL.md`, `RECRUTAMENTO_FLUXO.md`, `PORTAL_MVC_INVENTARIO_E_MIGRACAO.md`.
  - Mapeei: 98 controllers, 146 entidades de domínio, 369 migrations EF, ~10 background workers, 12 sub-services do worker RM, ~4900 LoC do serviço Python.
- **Arquivos novos meus:**
  - `lucasVISAO_GERAL.md` — visão de negócio executiva, personas, domínios, mapa visual, glossário.
  - `lucasSTACK_TECNOLOGICA.md` — inventário técnico completo (front, API, IA, worker RM, banco, infra, CI/CD, ferramentas dev).
  - `lucasMODULOS_FUNCIONALIDADES.md` — mapa tela por tela (28 módulos), abas internas, ações, endpoints consumidos, permissões.
  - `lucasINTEGRACOES.md` — inventário de integrações externas e sub-projetos (TOTVS RM, Datasul, Entra ID, OpenAI, Gemini, Ollama, S3, SMTP, WhatsApp, Blip, Nominatim, pgvector, Inbox, CI/CD, Docker).
  - `lucasIA_RAG.md` — foco na Fase 4.5: pipeline RAG detalhado, regra v1 vs v2 (65/35 + gates), componentes, persistência, gatilhos, perf, plano de rollout.
  - `lucasbacklog.md` — meu backlog pessoal (LUC-001…LUC-023, LUC-100+).
  - `lucaschangelog.md` — este arquivo.
- **Impacto:** tenho o mapa mental do projeto inteiro. Próximos commits podem ir direto pra implementação sem reabrir o monorepo.

---

## Como vou registrar a partir daqui

Sempre que eu:
- **Implementar uma feature** → entrada com ✨ + descrição + arquivos tocados + commit/PR
- **Corrigir bug** → 🐛 + sintoma + causa + correção
- **Refatorar** → 🔧 + por que (não o quê — o quê fica no diff)
- **Adicionar/mudar doc** → 📝
- **Mexer em infra** → 🏗️ (CI, docker, scripts, migrations não-código)
- **Fazer spike** → 🔬 + decisão go/no-go + dados

Modelo de entrada:
```md
### {emoji} {tipo} · {título curto}
- **Contexto:** por que estava fazendo
- **O que mudou:** lista pontual
- **Arquivos:** principais
- **Commit/PR:** sha ou link (quando houver)
- **Item backlog:** LUC-XXX (se vier do backlog)
- **Impacto:** uma linha
```
