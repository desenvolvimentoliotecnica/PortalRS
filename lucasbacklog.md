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
- **Status:** 📋 backlog
- **Tipo:** spike
- **Contexto:** Subir tudo localmente, gerar embeddings, rodar `/matching/run` com `rule_version=v2_65_35_strict` e comparar com v1 lado-a-lado para uma vaga conhecida. Anotar diferenças de ranking.
- **Aceite:**
  - [ ] Top 20 da v1 e da v2 capturados em CSV
  - [ ] Pelo menos 3 vagas testadas (1 ampla, 1 técnica restrita, 1 com poucos obrigatórios)
  - [ ] Anotar % de candidatos cuja posição mudou e diferença média de score
- **Dep.:** ambiente local rodando

### LUC-002 — Persistir ranking de Talentos em `CandidatoVagaMatchingScores`
- **Status:** 📋 backlog
- **Tipo:** feature
- **Contexto:** Hoje a busca UNION traz Talentos, o LLM os avalia, mas só Candidatos são salvos. RH perde os Talentos ranqueados quando o cache expira.
- **Aceite:**
  - [ ] Decidir entre estender `CandidatoVagaMatchingScores` (com coluna `Source: Candidato | Talento`) ou criar `TalentoVagaMatchingScores`
  - [ ] Migration EF Core criada (seguir regra do `CLAUDE.md`)
  - [ ] `RHPortalAiMatchClient` parseia e persiste talentos do retorno
  - [ ] Frontend exibe badge "Talento" no ranking
- **Dep.:** LUC-001 (entender comportamento atual)

### LUC-003 — Config de `ranking_size` por tenant
- **Status:** 📋 backlog
- **Tipo:** feature
- **Contexto:** Hoje fixo em `DEFAULT_RANKING_SIZE` (20). Tenants grandes querem 50, pequenos 10. Adicionar em `TenantConfiguracao` e propagar até o body do `/matching/run`.
- **Aceite:**
  - [ ] Coluna `MatchingRankingSize` em `TenantConfiguracao` (com default 20)
  - [ ] `RHPortalAiMatchClient` envia esse valor no body
  - [ ] UI de admin tem o campo
  - [ ] Migration EF + UI

### LUC-004 — Validação backend: vaga não pode ser publicada sem filtros mínimos
- **Status:** 📋 backlog
- **Tipo:** feature
- **Contexto:** Plano 65/35 Fase 2 — invariantes. Hoje dá para publicar vaga com `MatchingFiltrosRaw` vazio, e a IA pena. Bloquear no backend.
- **Aceite:**
  - [ ] Regra: ao mudar status para "Aberta", validar que existe pelo menos N requisitos obrigatórios OU `MatchingFiltrosRaw` não vazio
  - [ ] Mensagem de erro amigável (`InfrastructureErrors.resx`)
  - [ ] Teste de integração

---

## 🟡 Prioridade média

### LUC-010 — Spike: rerank LLM dos top-K
- **Status:** 📋 backlog
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
- **Status:** 📋 backlog
- **Tipo:** infra
- **Contexto:** Plano 65/35 Fase 5. Hoje só tem log estruturado. Adicionar métricas agregadas que dão para colocar em dashboard.
- **Aceite:**
  - [ ] Métrica: P50, P90, P95 de `score_final` por tenant
  - [ ] Métrica: taxa de fallback (RHPortal.Ai indisponível)
  - [ ] Métrica: latência média de `/matching/run` por tenant
  - [ ] Endpoint `/metrics` (Prometheus format) ou exportar para CloudWatch
  - [ ] Dashboard grafana / cloudwatch documentado

### LUC-013 — Worker Datasul para movimentações
- **Status:** 📋 backlog
- **Tipo:** feature
- **Contexto:** Hoje API `/api/integracao-totvs/painel?tipo=4` lista pendentes mas ninguém consome. Implementar consumer dentro de `Liotecnica.Integration.RM/` (mesma stack).
- **Aceite:**
  - [ ] Novo BackgroundService `DatasulMovimentacaoWorker`
  - [ ] Polling configurável (default 2 min)
  - [ ] POST para `apisftransferencia.p` com transformação correta
  - [ ] Reporta resultado via `POST /api/integracao-totvs/4/{id}/resultado`
  - [ ] Logs e métricas

### LUC-014 — Adicionar healthcheck de RHPortal.Ai dentro da API .NET
- **Status:** 📋 backlog
- **Tipo:** infra
- **Contexto:** Hoje API .NET não sabe se Python está vivo até a primeira request. Expor em `/health` da API um item `RHPortalAi: ok|down|degraded`.
- **Aceite:**
  - [ ] `RHPortalAiHealthCheck : IHealthCheck`
  - [ ] Registrado em `AddHealthChecks()`
  - [ ] Swagger reflete

---

## 🟢 Prioridade baixa

### LUC-020 — Inbox watcher: parser de .eml
- **Status:** 📋 backlog
- **Tipo:** feature
- **Contexto:** Infra do `InboxFolderWatcherService` está pronta mas o parser não. Quando alguém manda CV por e-mail, fica esquecido em `Inbox/incoming/`.
- **Aceite:**
  - [ ] Parser `.eml` (MimeKit)
  - [ ] Cria Candidato a partir do remetente
  - [ ] Importa anexo PDF como CV (chama `CvImportWorker`)
  - [ ] Move arquivo para `processado/` ou `erro/`

### LUC-021 — Migrar secrets para AWS Secrets Manager
- **Status:** 📋 backlog
- **Tipo:** infra
- **Contexto:** Hoje OpenAI key, RM password, JWT signing key vivem em `appsettings.json`. Em prod isso é risco.
- **Aceite:**
  - [ ] Substituir por leitura de Secrets Manager via SDK AWS
  - [ ] Documentar processo de rotação
  - [ ] Manter fallback para `appsettings` em dev

### LUC-022 — Limpeza dos HTMLs estáticos no raiz
- **Status:** 📋 backlog
- **Tipo:** refactor
- **Contexto:** Os arquivos `vagas.html`, `candidatos.html`, `dashboardv1.html`, `Matching.html`, `triagem.html`, `usuarios_perfis.html`, `relatorios.html`, `EntradaEmailPasta.html` no raiz eram mockups antes da migração para Next.js. Não estão em uso. Confirmar com time e remover.
- **Aceite:**
  - [ ] Confirmar com time que ninguém referencia
  - [ ] Backup em `__analise__/mockups-mvc/`
  - [ ] Remover do raiz
  - [ ] Atualizar `.gitignore`

### LUC-023 — Documentar runbook de troubleshooting de matching
- **Status:** 📋 backlog
- **Tipo:** docs
- **Contexto:** Quando "todos os candidatos dão score 0" ou "matching demora 60s", ninguém sabe por onde começar. Centralizar checklist.
- **Aceite:**
  - [ ] Criar `lucasRUNBOOK_MATCHING.md`
  - [ ] Sintomas → causas → comandos de diagnóstico
  - [ ] Quando reindexar embeddings
  - [ ] Como ler logs `log.matching`

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

### LUC-112 — Fase 4: Cadastro de chaves no Owner UI
- **Status:** 📋 backlog · **Tipo:** feature
- **Contexto:** `AiProviderKey` já existe no Master DB — a UI `/Owner/IA` é esqueleto.
- **Aceite:**
  - [ ] `/Owner/IA` lista chaves por provider
  - [ ] Adicionar chave: escolhe provider + cola chave + testa (chama endpoint de teste que bate no provider)
  - [ ] Editar/rotacionar chave (criptografado via `ISecretProtector`)
  - [ ] Deletar (com confirmação)
  - [ ] Catálogo de modelos (`AiModel`) — cadastrar modelos disponíveis por provider

### LUC-113 — Fase 5: Observabilidade + docs operacionais
- **Status:** 📋 backlog · **Tipo:** infra + docs
- **Contexto:** Fechar o épico com métricas e runbook.
- **Aceite:**
  - [ ] Log estruturado: cada chamada IA loga `{provider, model, tenant, module, latency_ms, tokens, cost_usd}`
  - [ ] Métricas Prometheus/CloudWatch: qual provider está sendo mais usado, taxa de erro por provider
  - [ ] `lucasRUNBOOK_IA.md` — troubleshooting, rotação de chave, mudar de provider em prod

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
