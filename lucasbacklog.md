# lucas — Backlog pessoal

> **Autor:** Lucas Machado · **Branch:** `feature/ia-rag-fase-4-5_v2`
> Lista do que **eu** vou tocar neste projeto. Independente do `backlog.md` global do time. Mantenho prioridade, status e quando algo vira "em progresso" / "concluído", muda para o `lucaschangelog.md`.

---

## Convenção

| Campo | Valores |
|---|---|
| **Prioridade** | 🔥 alta · 🟡 média · 🟢 baixa |
| **Status** | `📋 backlog` · `🔄 em progresso` · `🛑 bloqueado` · `✅ concluído` (move para changelog) |
| **Tipo** | `feature` · `bugfix` · `refactor` · `docs` · `infra` · `spike` |

Cada item tem: id, prioridade, status, tipo, título, contexto, critério de aceite, dependências (se houver).

---

## 🔥 Prioridade alta — Fase 4.5 (rule v2 65/35)

### LUC-001 — Validar pipeline v2 ponta-a-ponta no tenant `liotecnica-dev`
- **Status:** 🛑 **BLOQUEADO** — DB zerado. Precisa popular com vagas e candidatos reais (ou seed grande) para o spike fazer sentido.
- **Tipo:** spike
- **Contexto:** Subir tudo localmente, gerar embeddings, rodar `/matching/run` com `rule_version=v2_65_35_strict` e comparar com v1 lado-a-lado para uma vaga conhecida. Anotar diferenças de ranking.
- **Para destravar:** rodar o seed do projeto com `Seed.Vagas.Enabled=true` e `Seed.Candidatos.Enabled=true` no `appsettings.Development.json` (gera 50 vagas + 50 candidatos), OU importar dump real do tenant liotecnica de prod.
- **Aceite:**
  - [ ] Top 20 da v1 e da v2 capturados em CSV
  - [ ] Pelo menos 3 vagas testadas (1 ampla, 1 técnica restrita, 1 com poucos obrigatórios)
  - [ ] Anotar % de candidatos cuja posição mudou e diferença média de score

### LUC-002 — Persistir ranking de Talentos em `CandidatoVagaMatchingScores`
- **Status:** 🛑 **BLOQUEADO** — depende de LUC-001 + decisão arquitetural (estender tabela existente ou criar nova). Precisa do Leonardo OR validar com dados reais primeiro.
- **Tipo:** feature
- **Contexto:** Hoje a busca UNION traz Talentos, o LLM os avalia, mas só Candidatos são salvos. RH perde os Talentos ranqueados quando o cache expira.
- **Aceite:**
  - [ ] Decidir entre estender `CandidatoVagaMatchingScores` (com coluna `Source: Candidato | Talento`) ou criar `TalentoVagaMatchingScores`
  - [ ] Migration EF Core criada (seguir regra do `CLAUDE.md`)
  - [ ] `RHPortalAiMatchClient` parseia e persiste talentos do retorno
  - [ ] Frontend exibe badge "Talento" no ranking

### LUC-003 — Config de `ranking_size` por tenant
- **Status:** 📋 **PRONTO PARA TOCAR** — sem bloqueador. Pequeno (~2h).
- **Tipo:** feature
- **Contexto:** Hoje fixo em `DEFAULT_RANKING_SIZE` (20). Tenants grandes querem 50, pequenos 10. Adicionar em `TenantConfiguracao` e propagar até o body do `/matching/run`.
- **Aceite:**
  - [ ] Coluna `MatchingRankingSize` em `TenantConfiguracao` (com default 20)
  - [ ] `RHPortalAiMatchClient` envia esse valor no body
  - [ ] UI de admin tem o campo (estender `/app/admin/ia` que já existe)
  - [ ] Migration EF idempotente

### LUC-004 — Validação backend: vaga não pode ser publicada sem filtros mínimos
- **Status:** 📋 **PRONTO PARA TOCAR** — sem bloqueador. Médio (~2.5h).
- **Tipo:** feature
- **Contexto:** Plano 65/35 Fase 2 — invariantes. Hoje dá para publicar vaga com `MatchingFiltrosRaw` vazio, e a IA pena. Bloquear no backend.
- **Aceite:**
  - [ ] Regra: ao mudar status para "Aberta", validar que existe pelo menos N requisitos obrigatórios OU `MatchingFiltrosRaw` não vazio
  - [ ] Mensagem de erro amigável (`InfrastructureErrors.resx`)
  - [ ] Teste de integração

---

## 🟡 Prioridade média

### LUC-010 — Spike: rerank LLM dos top-K
- **Status:** 🛑 **BLOQUEADO** — spike de qualidade que precisa de dados reais (5 vagas com candidatos abundantes) + ground-truth (recrutador validando) para medir NDCG.
- **Tipo:** spike
- **Contexto:** Após batch eval (top 20), passar os top 10 por nova chamada LLM "ranqueie do melhor para o pior" para refinar ordem. Esperado +15% NDCG.
- **Aceite:**
  - [ ] Endpoint experimental `POST /matching/rerank-top-k`
  - [ ] Compare ranking antes/depois em 5 vagas
  - [ ] Decisão go/no-go documentada

### LUC-011 — `matchingFiltrosJson` + versionamento
- **Status:** 📋 backlog
- **Tipo:** refactor
- **Contexto:** Plano 65/35 Fase 3. O `MatchingFiltrosRaw` é texto livre — muda formato sem aviso. Canonicalizar como JSON estruturado + version + hash para detectar mudança e disparar recompute.
- **Aceite:**
  - [ ] Novo campo `MatchingFiltrosJson jsonb` na Vaga + `MatchingFiltrosHash`
  - [ ] Migration backfill (parse do raw para json)
  - [ ] `RHPortal.Ai` aceita ambos (compat)
  - [ ] Hash mudou → enfileira recompute

### LUC-012 — Métricas e observabilidade básicas
- **Status:** 🟡 **PARCIAL** — Fase 5 entregou ~60% deste item.
- **Tipo:** infra
- **Já entregue (Fase 5, 2026-04-26):**
  - ✅ Log estruturado em `UnifiedAiService` (tenant, user, provider, model, latency_ms, cost_usd, status=blocked reason=...)
  - ✅ Endpoint `GET /api/admin/ai/metrics?days=N` com agregados por módulo, modelo, dia
  - ✅ Healthcheck `rhportal_ai` no `/health` da API (LUC-014)
- **Pendente (próxima sprint):**
  - [ ] Endpoint `/metrics` no formato Prometheus (exporter padrão)
  - [ ] Métricas P50/P90/P95 de `score_final` (precisa de dados reais primeiro)
  - [ ] Dashboard Grafana/CloudWatch documentado (depende de Prometheus e ambiente prod)
  - [ ] Métrica explícita de "taxa de fallback" (RHPortal.Ai indisponível) — hoje dá para extrair via `grep "status=blocked reason="` nos logs

### LUC-013 — Worker Datasul para movimentações
- **Status:** 🛑 **BLOQUEADO** — precisa de Datasul de teste ou mock REST do procedure `apisftransferencia.p`. Discutir com Leonardo/Time.
- **Tipo:** feature
- **Contexto:** Hoje API `/api/integracao-totvs/painel?tipo=4` lista pendentes mas ninguém consome. Implementar consumer dentro de `Liotecnica.Integration.RM/` (mesma stack).
- **Aceite:**
  - [ ] Novo BackgroundService `DatasulMovimentacaoWorker`
  - [ ] Polling configurável (default 2 min)
  - [ ] POST para `apisftransferencia.p` com transformação correta
  - [ ] Reporta resultado via `POST /api/integracao-totvs/4/{id}/resultado`
  - [ ] Logs e métricas

### ~~LUC-014 — Healthcheck de RHPortal.Ai dentro da API .NET~~ ✅ CONCLUÍDO (2026-04-26)
> Movido para `lucaschangelog.md`. Entregue: `RHPortalAiHealthCheck : IHealthCheck`
> em `Infrastructure/HealthChecks/`, registrado em `AddHealthChecks()` com
> `failureStatus: Degraded` (Python down não tira a API do ar). Reporta `url`,
> `statusCode`, `body` (truncado a 500 chars). Quando `RhAi.BaseUrl` vazio,
> retorna `Healthy/skipped` para não causar falso negativo.

---

## 🟢 Prioridade baixa

### LUC-120 — Refactor multi-tenant do worker `Liotecnica.Integration.RM`
- **Status:** ⏸ **AGUARDANDO 2º cliente TOTVS** — não vale fazer com cliente único.
- **Tipo:** refactor / infra
- **Contexto:** Hoje o worker é deploy físico **um por cliente** — cada tenant que contrata TOTVS RM ganha sua própria instância com `appsettings` próprio (TenantId + RmCredentials + ApiKey). Funciona pra Liotécnica, mas duplica deploys quando cliente B chegar.
- **Quando atacar:** assim que aparecer 2º cliente TOTVS RM no roadmap comercial.
- **Aceite:**
  - [ ] Worker lê tenants ativos via `GET /api/owner/tenants?moduleEnabled=totvs-rm` (ou similar)
  - [ ] Loop de ciclo itera por tenant ativo, switching credentials RM
  - [ ] Master DB armazena `RmConnectionConfig` por tenant (encriptado — junto com LUC-121)
  - [ ] Healthcheck por tenant (último ciclo, contagem importada)
  - [ ] Single binary em vez de N deploys

### LUC-121 — Migrar `Portal.ApiKey` e `Rm.UserId/Password` do worker para Master DB encriptado
- **Status:** 📋 ABERTO — junta com onda da Fase 4 secrets (LUC-021).
- **Tipo:** infra / segurança
- **Contexto:** O `appsettings.Development.json` do `Liotecnica.Integration.RM/` hoje carrega `Portal.ApiKey` + `Rm.UserId/Password` em texto plano. Em dev local é OK; em prod é risco (mesmo padrão da OpenAI key, já listado em LUC-021).
- **Aceite:**
  - [ ] `RmConnectionConfig` por tenant encriptado em Master DB (col `EncryptedPasswordCipher` + KMS)
  - [ ] Worker lê via `IRmCredentialsResolver` (mesma API que o `IAiCredentialsResolver` da Fase 4)
  - [ ] Fallback `appsettings` em dev preservado
  - [ ] Plano de rotação documentado (junto com LUC-021)

### LUC-020 — Inbox watcher: parser de .eml
- **Status:** 🛑 **BLOQUEADO** — sem mailbox/dataset real para testar parsing + ataques (.eml malformado, encoding latin-1, anexos grandes)
- **Tipo:** feature
- **Contexto:** Infra do `InboxFolderWatcherService` está pronta mas o parser não. Quando alguém manda CV por e-mail, fica esquecido em `Inbox/incoming/`.
- **Para destravar:** subir uma caixa SMTP de teste OU usar o produtor TOTVS RM (que já manda e-mails) como fonte controlada.
- **Aceite:**
  - [ ] Parser `.eml` (MimeKit)
  - [ ] Cria Candidato a partir do remetente
  - [ ] Importa anexo PDF como CV (chama `CvImportWorker`)
  - [ ] Move arquivo para `processado/` ou `erro/`

### LUC-021 — Migrar secrets para AWS Secrets Manager
- **Status:** 🛑 **BLOQUEADO** — precisa conta AWS prod + IAM + plano de rotação coordenado com Leonardo
- **Tipo:** infra
- **Contexto:** Hoje OpenAI key, RM password, JWT signing key vivem em `appsettings.json`. Em prod isso é risco.
- **Para destravar:** definir região AWS, criar IAM role com `secretsmanager:GetSecretValue`, alinhar prod cutover.
- **Aceite:**
  - [ ] Substituir por leitura de Secrets Manager via SDK AWS
  - [ ] Documentar processo de rotação
  - [ ] Manter fallback para `appsettings` em dev

### ~~LUC-022 — Limpeza dos HTMLs estáticos no raiz~~ ✅ CONCLUÍDO (2026-04-26)
> Movido para `lucaschangelog.md`. Entregue: 8 HTMLs (`EntradaEmailPasta`, `Matching`,
> `candidatos`, `dashboardv1`, `relatorios`, `triagem`, `usuarios_perfis`, `vagas`)
> movidos via `git mv` para `__analise__/mockups-mvc/` (preserva história git).
> Verificado antes que só docs `lucas*` referenciavam — zero código produtivo afetado.

### ~~LUC-023 — Runbook de troubleshooting de matching~~ ✅ COBERTO (2026-04-26)
> Coberto pela criação de `lucasRUNBOOK_IA.md` (Fase 5). Esse runbook cobre todos
> os sintomas listados aqui (score 0, matching lento, IA off, embeddings dessync,
> trocar provider) e mais — vira "manual operacional de IA" geral, não só matching.

---

## 🟡 Prioridade média — épico LLM-agnóstico (continua após Fase 1)

### ~~LUC-110 — Fase 2: API .NET provider-agnóstica~~ ✅ CONCLUÍDO (2026-04-25)
> Movido para `lucaschangelog.md`. **Escopo entregue:** `UnifiedAiService` aceita
> OpenAI, Gemini e Anthropic via `IAiProviderFactory`. Smoke test com Gemini
> validado. **Escopo deferido para Fase 3:** os 7 serviços que hoje chamam
> `IOllamaClient` direto (LlmAssistantService, EmbeddingService, etc.) — esses
> ficam Ollama-only até a escolha por tenant.

### LUC-110b — Trocar `IOllamaClient` direto pelo factory nos 7 serviços
- **Status:** 📋 backlog · **Tipo:** refactor · **Relacionado:** Fase 3
- **Contexto:** A Fase 2 cobriu `UnifiedAiService` (caminho OpenAI já com factory). Mas os 7 serviços abaixo ainda chamam `IOllamaClient.ChatAsync(...)` direto, então **só rodam com Ollama local**:
  - `LlmAssistantService` (chat RAG do assistente RH)
  - `EmbeddingService` (gera embeddings em `CandidatoEmbeddings` / `DescricaoCargoItemEmbeddings`)
  - `VectorSearchService` (gera embedding da query para busca kNN)
  - `DescricaoCargoGeneratorService` (gera template DNALIO)
  - `SalarioSuggesterService` (sugere faixa salarial)
  - `CvResumoService` (resume CV em uma linha)
  - `LlmMatchingService` (LLM-as-judge para scoring final)
- **Solução:** criar `ILlmClient` (chat) e `IEmbeddingClient` (embeddings) como abstrações genéricas; `OllamaLlmClient` implementa via `IOllamaClient`; `OpenAiLlmClient`, `GeminiLlmClient` etc. implementam via HTTP direto. `Program.cs` registra a implementação ativa via factory.
- **Aceite:**
  - [ ] `ILlmClient` + N implementações
  - [ ] `IEmbeddingClient` + N implementações
  - [ ] Os 7 serviços usam `ILlmClient`/`IEmbeddingClient` em vez de `IOllamaClient`
  - [ ] Streaming/tool-calls preservados onde existem (LlmAssistantService)
  - [ ] Smoke tests para cada provider em cada um dos 7 serviços

### ~~LUC-111 — Fase 3: Seleção por tenant~~ ✅ CONCLUÍDO (2026-04-25)
> Movido para `lucaschangelog.md`. Entregue: 4 colunas em `TenantConfiguracao`,
> migration idempotente, `ITenantAiSettingsResolver`, `UnifiedAiService` tenant-aware,
> Python aceita override no body via `request_context.ContextVar`, UI `/app/admin/ia`.
> Smoke test ponta-a-ponta passou em 6/6 cenários.

### LUC-116 — Resolver "estrito" quando tenant escolhe provider sem chave
- **Status:** 📋 backlog · **Tipo:** bugfix · **Prioridade:** média
- **Contexto:** Descoberto durante o smoke test da Fase 3. Quando `TenantConfiguracao.LlmProvider="anthropic"` mas nenhuma chave Anthropic está configurada (nem `Master.AiProviderKey`, nem `Ai.Anthropic.ApiKey`), o `UnifiedAiService.ResolveProviderAsync` cai silenciosamente no próximo provider da fila (ex: Gemini, se tiver chave). Isso mascara erros de configuração — admin pensa que está usando Anthropic quando na verdade está usando Gemini.
- **Solução:** introduzir uma flag (default `true`) "modo estrito" — se tenant escolheu provider X e X não tem chave, retornar `null` (= 503) explícito em vez de fallback. Logar warning claro.
- **Aceite:**
  - [ ] Em `UnifiedAiService.ResolveProviderAsync`: se `tenantProviderOverride` definido E não há chave (DB nem config) para esse provider → retornar null com log warning
  - [ ] `_check_dependencies` no Python idem para overrides de request
  - [ ] UI `/app/admin/ia` mostra um "warning" no painel "effective" quando o effective ≠ provider escolhido

### ~~LUC-112 — Fase 4: Cadastro de chaves no Owner UI + on/off por tenant~~ ✅ CONCLUÍDO (2026-04-26)
> Movido para `lucaschangelog.md`. **Descoberto durante a fase:** `/Owner/IA`
> **já estava funcional** (CRUD chaves dos 3 providers + modelos + dashboard de
> uso) — minha doc inicial estava errada chamando-a de "esqueleto". O escopo
> efetivamente entregue na Fase 4 foi: módulo `"ai"` no `ModuleCatalog`
> (transversal, sem PackageKey), `UnifiedAiService` early-return quando módulo
> off, `AvailableProviders`/`AiEnabled` no DTO do tenant, banner "IA não habilitada"
> + dropdowns filtrados em `/app/admin/ia`. Smoke test 7/7 ponta-a-ponta.

### LUC-118 — Dashboard de Performance por Recrutador (widget próprio)
- **Status:** 🛑 **BLOQUEADO** — precisa volume de uso real (>10 vagas atribuídas + >50 candidatos com histórico) para validar métricas e calibrar UI.
- **Tipo:** feature
- **Contexto:** A feature de "Atribuição manual de vaga a recrutador" (entregue em 2026-04-26) populou `Vaga.RecrutadorResponsavelUserId` corretamente, mas o relatório `r6 SLA por recrutador` é só uma fatia. Quando houver dados, criar widget próprio no dashboard agregando: vagas abertas/fechadas por recrutador no mês, % SLA atingido, tempo médio Triagem→Proposta, taxa de aceite de proposta, ações no matching (`RecruiterMatchingFeedback`).
- **Aceite:**
  - [ ] Estender `DashboardAgregadoService.ParaRhAsync` com `recrutadoresPerformance: RecrutadorPerformanceItem[]`
  - [ ] Novo widget `RecrutadorPerformanceWidget.tsx` em `features/dashboard/widgets/`
  - [ ] Coluna "Performance" no `DashboardScreen` (visão RH)
  - [ ] Reuso de queries do relatório r6 + `CandidaturaEtapaHistorico` + `RecruiterMatchingFeedback`

### LUC-119 — Refatorar relatório r6 para usar só Guid (eliminar string)
- **Status:** 📋 backlog · **Prioridade:** baixa
- **Tipo:** refactor
- **Contexto:** Relatório `r6 SLA por recrutador` filtra por `RecrutadorResponsavelUserId` (Guid) mas agrupa por `RecrutadorResponsavel` (string). Hoje a feature de atribuição manual sincroniza ambos no `AssignRecrutadorAsync` e `SyncRecrutadorResponsavelStringAsync`, mantendo coerência. Mas o ideal é o relatório consultar `User.FullName` direto via JOIN no `RecrutadorResponsavelUser` — eliminando dependência da string desnormalizada.
- **Aceite:**
  - [ ] `ReportsController.GetSlaVaga` agrupa por `RecrutadorResponsavelUser.FullName` (Include navigation)
  - [ ] `RecrutadorResponsavel` (string) fica como campo "histórico" preservado, mas relatórios não dependem mais dele
  - [ ] Remover `SyncRecrutadorResponsavelStringAsync` se nada mais ler a string

### ~~LUC-117 — AiController retorna 503 (não 404) quando IA desabilitada~~ ✅ CONCLUÍDO (2026-04-26)
> Movido para `lucaschangelog.md`. Entregue junto com a Fase 5:
> `AiInvokeOutcome` carrega `AiUnavailableReason`; `AiController` retorna
> `503` com `ProblemDetails` estruturado contendo `reason` (`ModuleDisabled`,
> `NoProviderConfigured`, `ProviderResolutionFailed`) + `tenantId`.
> **Pendente para próxima sprint:** estender o mesmo padrão a
> `AssistenteIaController` (chat/descricao-cargo/sugerir-salario/cv-resumir).

### ~~LUC-113 — Fase 5: Observabilidade + docs operacionais~~ ✅ CONCLUÍDO (2026-04-26)
> Movido para `lucaschangelog.md`. Entregue: log estruturado em
> `UnifiedAiService` (`tenant`, `provider`, `model`, `latency_ms`, `cost_usd`,
> e `status=blocked reason=...` em bloqueios), endpoint
> `GET /api/admin/ai/metrics?days=N` (totalCalls + breakdown por
> módulo/modelo/dia), `lucasRUNBOOK_IA.md` (7 seções de operação).
> **🎯 Épico LLM-agnóstico FECHADO.**

### LUC-114 — .NET: Healthcheck do serviço Python reportando provider ativo
- **Status:** 📋 backlog · **Tipo:** infra · **Relacionado:** LUC-014
- **Aceite:**
  - [ ] `RHPortalAiHealthCheck` lê `/health/ready` do Python
  - [ ] Reporta no `/health` da API .NET: `rh_portal_ai: { status, llm_provider, embedding_provider }`

### LUC-115 — Reconciliar `RHPortal.Ai/app/embeddings.py` com schema real (.NET)
- **Status:** 📋 backlog · **Tipo:** bugfix · **Prioridade:** alta (bloqueia uso real do matching v1 Python em qualquer tenant)
- **Descoberta (2026-04-25):** a investigação para a Fase 1 revelou que **o schema real não é o que o Python espera**:
  - **Python (`embeddings.py`)** faz `UPDATE "Vagas" SET embedding = %s::vector` — espera **colunas inline** `Vagas.embedding` e `Candidatos.embedding` (`vector(1536)` para OpenAI na imaginação antiga). Também há `Talentos."Embedding"`.
  - **Schema .NET atual** (migration EF `20260424125643_AddEmbeddingsPgvector`) criou **tabelas dedicadas**:
    - `CandidatoEmbeddings` (Id, TenantId, CandidatoId, ModelVersion, Dimensions, **Embedding vector(1024)**, TextoSource, ConteudoHash, ...)
    - `DescricaoCargoItemEmbeddings` (análogo, com DescricaoCargoItemId)
  - **As colunas inline que o Python escreve simplesmente NÃO EXISTEM.** Se rodar `/matching/run` com embedding a gerar, quebra em "coluna embedding não encontrada".
  - **Origem do dessync:** há um arquivo SQL solto `RHPortal.Api/Migrations/AddEmbeddingSupport.sql` (com `ALTER TABLE Vagas ADD COLUMN embedding vector(1536)`) que PRECISA ser rodado **manualmente** segundo `COMO_RODAR_MIGRATION.md`, mas não está no `ApplyOrphanMigrationsAsync` e não é automático.
  - **1024 dims no schema atual:** foi pensado para Ollama **bge-m3** (1024d exatos), usado pela **API .NET via `EmbeddingService`** (caminho ativo em prod).
- **Duas arquiteturas de embeddings coexistem no repo hoje:**
  - **Caminho A — .NET `EmbeddingService`** (em prod): Ollama bge-m3 → 1024d → tabelas dedicadas. Usado pelo assistente IA, matching híbrido, sugestão salarial.
  - **Caminho B — Python `embeddings.py`**: tenta gravar em colunas inline que não existem. **Efetivamente morto.**
  - **Caminho C — Python `gemini_embeddings.py`** (v2, experimental): usa SDK google-genai direto, grava em coluna `gemini_embedding` — que **também não existe** no schema atual.
- **Opções de resolução (decisão em aberto):**
  1. **Refatorar Python para gravar/ler nas tabelas dedicadas** do .NET. Alinha as duas stacks; reaproveita schema ativo; a coluna ficaria `vector(1024)` para todos os providers com MRL quando possível. *(Maior alinhamento; mais trabalho.)*
  2. **Rodar `AddEmbeddingSupport.sql` manualmente + criar mais migrations para colunas por provider** (embedding_openai_1536, embedding_gemini_768, etc.). *(Preserva o Python sem mexer, mas polui schema.)*
  3. **Descontinuar Python `embeddings.py`** e fazer Python chamar a API .NET para persistência. *(Elegante mas alto acoplamento cross-service.)*
- **Aceite:**
  - [ ] Decisão arquitetural registrada em `lucasIA_RAG.md` §17
  - [ ] Caminho escolhido implementado e testado
  - [ ] Migration / script idempotente adicionado ao `ApplyOrphanMigrationsAsync` ou documentado
  - [ ] Teste de persistência local com Gemini E Ollama
  - [ ] `lucasIA_RAG.md` atualizado refletindo a verdade

---

## 🔬 Pesquisa / spikes futuros (sem prioridade ainda)

### LUC-101 — Fine-tuning com histórico de feedback do recrutador
- **Tipo:** spike
- **Razão:** `RecruiterMatchingFeedback` tem dados; usar para ajustar prompt/modelo
- **Pré-condição:** ≥ 6 meses de histórico (verificar volume)

### LUC-102 — Chunking de CV longo
- **Tipo:** spike
- **Razão:** CVs > 3.000 chars perdem informação no embedding único. Avaliar chunking + agregação max-pool.

---

## Backlog descartado / superseded

(vazio por enquanto — quando descartar algum item, anotar aqui com motivo)

---

**Mantenho este arquivo vivo. Quando começar a tocar um item, mudo para `🔄 em progresso`. Quando concluir, anoto no `lucaschangelog.md` e removo daqui.**
