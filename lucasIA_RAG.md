# lucas — IA, RAG e Matching (Fase 4.5)

> **Autor:** Lucas Machado · **Branch:** `feature/ia-rag-fase-4-5_v2` / `devops_Lucas` · **Data inicial:** 2026-04-24
> Documento focado no que é **mais novo e crítico** do projeto agora: o pipeline de matching com IA + RAG. Aqui eu sintetizo o que está pronto, o que está em rollout (regra v2 65/35) e o que ainda falta, para eu não me perder enquanto continuo a fase.
>
> **Atualização 2026-04-25 — Fase 1 do LLM-agnóstico concluída.** O serviço `RHPortal.Ai` agora aceita OpenAI, Gemini ou Ollama via env vars (`LLM_PROVIDER`, `EMBEDDING_PROVIDER`). Veja §16.

---

## 1. Resumo de uma linha

A Fase 4.5 trocou (ou está trocando) a regra **v1 (80/20) sem gates** pela regra **v2 (65/35) com gates duros + tetos por cobertura de obrigatórios**, mantendo o mesmo pipeline RAG (pgvector → LLM batch).

---

## 2. Pipeline RAG (estado atual)

```
┌────────────────────────────────────────────────────────────────┐
│  POST /matching/run                                            │
│  body: { vaga_id, tenant_id, limit, rule_version }             │
└──────────────────────┬─────────────────────────────────────────┘
                       │
        ┌──────────────▼──────────────────────────────────┐
        │ FASE 1 — Garante embedding da vaga               │
        │ Se faltar, gera com text-embedding-3-small       │
        │ (1536d) ou gemini-embedding-002 (768d, v2)       │
        └──────────────┬──────────────────────────────────┘
                       │
        ┌──────────────▼──────────────────────────────────┐
        │ FASE 2 — Pré-filtro VETORIAL (pgvector)          │
        │ SELECT UNION:                                    │
        │   • Candidatos do tenant (embedding NOT NULL)    │
        │   • Talentos (sem candidatura ativa)             │
        │ Distância coseno (operador <=>) → similaridade   │
        │   = (1 - distância) * 100                        │
        │ Limite: ranking_size * 2 (default 40)            │
        │ Latência: <10ms (índice IVFFlat lists=100)       │
        └──────────────┬──────────────────────────────────┘
                       │
        ┌──────────────▼──────────────────────────────────┐
        │ FASE 2.5 — Hybrid pre-filter (opcional)          │
        │ Se HYBRID_PRE_FILTER_ENABLED=true e há requisitos:│
        │   hybrid = 0.6 * sim_vetor + 0.4 * keyword       │
        │   keyword = TF-IDF + stem pt-br                  │
        │   Descarta abaixo de HYBRID_MIN_THRESHOLD (15)   │
        └──────────────┬──────────────────────────────────┘
                       │
        ┌──────────────▼──────────────────────────────────┐
        │ FASE 3 — Fetch profile data (paralelo)           │
        │ ThreadPoolExecutor max_workers=10                │
        │ Para cada pessoa: profile_text + meta            │
        └──────────────┬──────────────────────────────────┘
                       │
        ┌──────────────▼──────────────────────────────────┐
        │ FASE 4 — LLM batch evaluation                    │
        │ Agrupa em batches de 6                           │
        │ Para cada batch: gpt-4o-mini avalia 4 dimensões │
        │   • score_competencia (0-100)                    │
        │   • score_experiencia (0-100)                    │
        │   • score_formacao (0-100)                       │
        │   • score_localidade (0-100)                     │
        │ Retorna scores + justificativa                   │
        └──────────────┬──────────────────────────────────┘
                       │
        ┌──────────────▼──────────────────────────────────┐
        │ FASE 5 — Cálculo de score final                  │
        │ Usa rule_version para escolher fórmula           │
        │ (ver seção 3 abaixo)                             │
        └──────────────┬──────────────────────────────────┘
                       │
        ┌──────────────▼──────────────────────────────────┐
        │ FASE 6 — Ordena por score_final DESC             │
        │ Trunca em ranking_size (default 20)              │
        │ Retorna MatchResponse com ranking + scores       │
        └─────────────────────────────────────────────────┘

Latência total típica: 25-40s para top 20 (depende de batches LLM).
```

---

## 3. Regras de score (a mudança da Fase 4.5)

### 3.1 Regra v1 — `v1_80_20` (em produção)

```python
score_filtros = média ponderada das 4 dimensões LLM
score_requisitos = % de requisitos obrigatórios cobertos
score_final = 0.80 * score_filtros + 0.20 * score_requisitos
# Sem gates. 100 é alcançável fácil demais.
```

### 3.2 Regra v2 — `v2_65_35_strict` (Fase 4.5, em rollout)

```python
base = 0.65 * score_filtros + 0.35 * score_requisitos

# Gate 1: penalidade por obrigatório faltando
mandatory_missing = total_obrigatorios - atendidos
penalty = min(mandatory_missing * 20, 60)  # -20 cada, máximo -60
score_final = max(0, base - penalty)

# Gate 2: tetos por cobertura
coverage = (atendidos / total_obrigatorios) * 100
if coverage < 50:  score_final = min(score_final, 60)
elif coverage < 70: score_final = min(score_final, 79)
elif coverage < 100: score_final = min(score_final, 89)

# Gate 3: 100 só com tudo cobrindo + ambos scores ≥ 95
if coverage == 100 and score_filtros >= 95 and score_requisitos >= 95:
    score_final = 100

return clamp(score_final, 0, 100)
```

**Por que mudou:** v1 inflava — qualquer candidato com presença vetorial razoável ficava em 70-80, e era muito comum ver 100 sem cobertura plena. v2 torna o 100 raro e penaliza ausência de obrigatórios (preserva a confiança do recrutador no ranking).

**Como ativa por tenant:**
```jsonc
"RhAi": {
  "DefaultRuleVersion": "v1_80_20",
  "TenantRuleVersions": {
    "liotecnica": "v2_65_35_strict"
  }
}
```

---

## 4. Componentes — quem faz o quê

| Componente | Linguagem | Função |
|---|---|---|
| **`RHPortal.Ai/app/main.py`** | Python (FastAPI) | Endpoints REST `/matching/run`, `/matching/evaluate-one`, `/embeddings/*`, `/v2/*`, `/health` |
| **`unified_matching.py`** | Python | Pipeline v1 (OpenAI + pgvector + LLM batch + score 80/20 ou 65/35) |
| **`gemini_matching.py`** | Python | Pipeline v2 (Gemini 002 + pgvector específico Gemini) |
| **`embeddings.py`** | Python | Constrói texto canônico (vaga / candidato / talento) e gera embedding |
| **`vector_search.py`** | Python | Busca UNION pgvector entre Candidatos + Talentos |
| **`db.py`** | Python | Queries PostgreSQL (lê vaga, requisitos, candidatos, competências) |
| **`config.py`** | Python | Variáveis de ambiente, `get_database_url(tenant_id)` |
| **`keyword_scoring.py`** | Python | TF-IDF + stem pt-br para hybrid pre-filter e fallback |
| **`location_scoring.py`** | Python | Haversine para localidade (cidade↔cidade), respeita modalidade |
| **`retry.py`** | Python | Decorador retry com backoff (OpenAI, DB) |
| **`RHPortalAiMatchClient.cs`** | C# | Cliente HTTP da .NET para chamar o serviço Python |
| **`UnifiedAiService.cs`** | C# | Orquestra invocações IA (auditoria + fallback) |
| **`AiController.cs`** | C# | Endpoint `/api/ai/invoke` para chamadas customizadas |
| **`OwnerAiController.cs`** | C# | Gerência de chaves e modelos no Master DB |
| **`MatchingService.cs`** | C# | Matching legado por keyword (ainda em uso para fallback) |
| **`HybridMatchingService.cs`** | C# | Combina keyword + IA |
| **`VagaUnifiedMatchingCacheService.cs`** | C# | Cache de scores (lê/escreve em `CandidatoVagaMatchingScores`) |
| **`BatchMatchingRunnerService.cs`** | C# | Job em lote para recompute |

---

## 5. Persistência de scores

Tabela: `CandidatoVagaMatchingScores`

| Coluna | Conteúdo |
|---|---|
| `CandidatoId`, `VagaId` | Chave composta |
| `ScoreTotal` | Score final 0-100 |
| `ScoreEducacao`, `ScoreExperiencia`, `ScoreCompetencias` | Breakdowns parciais |
| `ComputadoEmUtc` | Timestamp do último cálculo |

Tabela companion: `CandidatoVagaLlmScore` — score do LLM separado + justificativa.

Tabela cache: `VagaUnifiedMatchingCache` — JSON com ranking inteiro para evitar recomputo a cada GET.

⚠️ **Furo conhecido:** Talentos são **avaliados** mas **não persistidos** — só Candidatos vão para `CandidatoVagaMatchingScores`. Item no backlog.

---

## 6. Quem dispara a IA (gatilhos)

| Gatilho | Onde | Endpoint chamado |
|---|---|---|
| Recrutador abre tela de Matching | Frontend → API → cache do banco | `GET /api/vagas/{id}/matching-candidates` (lê cache) |
| Cache stale ou vazio | Background job .NET → Python | `POST /matching/run` |
| Candidato se candidata | API .NET → Python | `POST /matching/evaluate-one` |
| RH atribui candidato a vaga | API .NET → Python | `POST /matching/evaluate-one` |
| Filtros da vaga editados (`PATCH matching-filtros`) | API .NET enfileira recompute | `POST /matching/run` em background |
| Vaga nova criada | Worker .NET gera embedding | `POST /embeddings/vaga/{id}` |
| Talento novo importado | Worker .NET gera embedding | `POST /embeddings/talento/{id}` ou `/embeddings/talentos/batch` |
| Vaga aprovada (Gemini v2) | Trigger automático | `POST /v2/matching/trigger` |

A tela do recrutador **não chama o Python em real-time** — ela lê do cache. Isso mantém latência de UI baixa (<200ms) e permite recompute assíncrono.

---

## 7. Como o texto é construído (RAG no detalhe)

### 7.1 Vaga (`embeddings.py:_build_vaga_text_for_embedding`)

```
Título + Código
Senioridade, Modalidade, Escolaridade, Formação
Experiência mínima, Localização (Cidade/UF)
Descrição Interna + Pública + Resumo Pitch
Stack Tecnológica + Palavras-chave + Idiomas + Diferenciais
Flags (Aceita PCD, Exige CNH, Urgente)
MatchingFiltrosRaw (texto livre do recrutador)
Requisitos detalhados (nome, sinônimos, obrigatório?, peso, nível mínimo)
```
Tamanho típico: 1.000-2.000 chars.

### 7.2 Candidato

```
Nome + Email + ResumoProfissional
CvText completo
Competências (lista de CandidatoCompetencias)
Localização (Cidade, UF)
Pretensão Salarial
```
Tamanho típico: 500-3.000 chars.

### 7.3 Talento

```
Pessoa: Nome, Resumo, Email
TalentoCompetencias (skills)
TalentoExperiencias (cargos, empresas, duração)
TalentoFormacoes (educação)
Localização
```
Tamanho típico: 800-2.500 chars.

> **Princípio:** maximizar densidade semântica para que a busca vetorial encontre relacionamentos conceituais (não só keyword match). É por isso que o texto canônico é tão "completo".

---

## 8. Performance e custos (benchmarks observados)

| Operação | Latência | Custo aproximado |
|---|---|---|
| Health `/health` | 50ms | — |
| Embedding 1 vaga | 200ms | ~$0,00002 por vaga |
| Embedding 1 candidato | 180ms | ~$0,00002 por candidato |
| Pré-filtro vetorial | <10ms | — |
| Fetch profiles (40 pessoas, paralelo) | 300ms | — |
| LLM batch (6 candidatos) | 8-15s | ~$0,01 por batch |
| `/matching/run` completo (top 20) | **25-40s** | **~$0,10-$0,20 por matching** |
| Re-indexação de tudo (40 itens + 20 candidatos) | 14s | ~$0,001 |

**Throughput:**
- 3-5 chamadas `/matching/run` simultâneas (limitado por LLM batching)
- ~500-1000 candidatos avaliados/dia em produção típica
- Custo OpenAI mensal: $10-$50 por tenant ativo

---

## 9. Health checks e resiliência

| Cenário | Comportamento |
|---|---|
| `RHPortal.Ai` offline | API .NET cai para ranking legado (keyword) — não quebra UI |
| OpenAI fora | `/health/ready` 503 → endpoints retornam 503 → API .NET usa fallback |
| Vaga sem embedding | Backfill automático em background; próxima request tem resultado |
| Candidato sem dados suficientes | Retorna score 0, não inclui no ranking |
| DB conexão pool exausta | psycopg2 pool faz queue (até 20 conexões) |

`/health` (liveness) — não checa dependências
`/health/ready` (readiness) — checa DB + `OPENAI_API_KEY`

---

## 10. Observabilidade

Logging estruturado em `RHPortal.Ai/app/log.py`:

- `log.requests` — middleware HTTP
- `log.matching` — pipeline (timings, candidatos processados, batches)
- `log.db` — queries (erros)

Exemplo de log de matching:
```json
{
  "message": "matching_done",
  "context": {
    "tenant": "liotecnica",
    "vaga": "550e8400-e29b-41d4-a716-446655440000",
    "rule": "v2_65_35_strict",
    "ranking_size": 20,
    "vector_limit": 40,
    "batch_size": 6,
    "batches": 7,
    "avaliados": 18,
    "elapsed_s": 25.4
  }
}
```

⚠️ **Falta:** métricas agregadas (NDCG, P50/P90 de score, taxa de fallback) — item no backlog (Fase 5).

---

## 11. Status detalhado da Fase 4.5

### ✅ Pronto
- Stack base FastAPI + pgvector em produção
- Embeddings OpenAI 1536d operando
- Busca UNION (Candidatos + Talentos) via pgvector
- Pipeline v1 (80/20) em produção
- Integração `RHPortalAiMatchClient` (HttpClient + retry)
- Multi-tenant routing (`get_database_url(tenant_id)`)
- Embeddings Gemini 002 (provider alternativo, em teste)
- Endpoints `/v2/*` paralelos para Gemini
- Backfill automático de embeddings em background
- Batch endpoint para talentos sem embedding
- Health checks (`/health`, `/health/ready`)

### 🔄 Em andamento
- **Feature flag v2_65_35_strict** — rollout gradual por tenant
- **Persistência de ranking incluindo Talentos** — codando
- **Rerank LLM dos top-K** — avaliação de POC

### 📋 Pendente (ordem sugerida)
1. **Config de ranking_size por tenant** (hoje fixo em `DEFAULT_RANKING_SIZE`) — Sprint +1
2. **Validação backend de filtros obrigatórios** (não deixar criar vaga sem filtros mínimos) — Sprint +1
3. **`matchingFiltrosJson` + versionamento** (canonicalizar o texto livre em estrutura) — Sprint +2
4. **Endpoint de detalhe oficial de score** (fonte única para frontend) — Sprint +2
5. **Métricas (NDCG, P50/P90, taxa de fallback)** — Sprint +3
6. **Fine-tuning com histórico de feedback do recrutador** — pós 6 meses

### Plano de rollout v2 (próximas 4 semanas)

| Semana | Ação |
|---|---|
| 1 | Implementar gates definitivos + teste A/B |
| 2 | Rollout v2 para 10% → 50% dos tenants (feature flag) |
| 2 | Monitorar distribuição de scores (P50, P90, % de 100s) |
| 3 | Persistir Talentos em `CandidatoVagaMatchingScores` |
| 3 | POC rerank LLM |
| 4 | Rollout v2 para 100% dos tenants |
| 4 | Documentação de operação (runbook) |

---

## 12. Configuração rápida (subir o serviço)

```bash
# 1. Setup pgvector (uma vez)
bash scripts/setup-pgvector.sh   # macOS — instala extensão
psql -d dev_render_liotecnica -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 2. .env do RHPortal.Ai
cat > RHPortal.Ai/.env <<EOF
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://postgres:admin@localhost:5432/dev_render_liotecnica
TENANT_DATABASE_TEMPLATE=postgresql://postgres:admin@localhost:5432/dev_render_{0}
EMBEDDING_MODEL=text-embedding-3-small
OPENAI_CHAT_MODEL=gpt-4o-mini
DEFAULT_RANKING_SIZE=20
MATCHING_RULE_VERSION=v2_65_35_strict
HOST=0.0.0.0
PORT=8000
EOF

# 3. Instalar deps + subir
cd RHPortal.Ai
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m app.main                 # ou: uvicorn app.main:app --host 0.0.0.0 --port 8000

# 4. Configurar .NET para chamar o serviço
# em appsettings.Development.json:
# "RhAi": { "BaseUrl": "http://localhost:8000", "DefaultRuleVersion": "v2_65_35_strict" }

# 5. Reindexação inicial dos embeddings (uma vez por tenant)
curl -X POST http://localhost:5056/api/assistente-ia/embeddings/reindexar?force=true \
  -H "X-Tenant-Id: liotecnica" -H "Authorization: Bearer <jwt>"
```

---

## 13. Endpoints relevantes — referência rápida

### `RHPortal.Ai` (Python, :8000)

| Endpoint | Função |
|---|---|
| `POST /matching/run` | Pipeline completo v1 |
| `POST /matching/evaluate-one` | Avalia 1 pessoa para 1 vaga |
| `POST /embeddings/vaga/{id}` | Gera + salva embedding da vaga |
| `POST /embeddings/candidato/{id}` | Idem candidato |
| `POST /embeddings/talento/{id}` | Idem talento |
| `POST /embeddings/talentos/batch` | Lote de talentos sem embedding |
| `POST /similarity` | Score de similaridade vaga × candidato (debug) |
| `POST /v2/matching/run` | Pipeline Gemini v2 |
| `POST /v2/embeddings/generate` | Embedding Gemini |
| `GET /v2/stats` | Estatísticas de embeddings Gemini |
| `GET /health`, `/health/ready` | Liveness / Readiness |
| `POST /match`, `/match-one`, `/match-hybrid` | **Legados** (filtros) — preferir `/matching/run` |

### `RHPortal.Api` (.NET, :5056) — endpoints IA

| Endpoint | Função |
|---|---|
| `GET /api/vagas/{id}/matching-candidates` | Lê ranking do cache (não chama Python em real-time) |
| `POST /api/matching/recompute/{vagaId}` | Força recompute (chama Python em background) |
| `POST /api/matching/feedback` | Recrutador dá feedback sobre qualidade do match |
| `POST /api/ai/invoke` | Invocação genérica de IA (UnifiedAiService) |
| `POST /api/owner/ai/keys` | Owner cadastra chave OpenAI/Gemini |
| `POST /api/vagas/{id}/generate-description` | LLM gera descrição da vaga |
| `POST /api/cargos/{id}/suggest-salary` | LLM sugere salário |
| `POST /api/candidatos/{id}/documentos/curriculo-extrair` | LLM extrai dados do CV (PDF) |
| `POST /api/assistente-ia/embeddings/reindexar` | Reindex dos embeddings |

---

## 14. Documentos originais que eu uso de referência

| Doc original | Conteúdo |
|---|---|
| `GUIA_IA_RAG.md` | Setup detalhado (Ollama, pgvector), arquitetura, performance |
| `FLUXO_IA_MATCHING.md` | Quando dispara, onde grava, quem lê |
| `STATUS_MATCHING_VETORIZADO.md` | Checklist de implementação (✅ / ⚠️ / ❌) |
| `PLANO_EVOLUCAO_MATCHING_65_35.md` | Plano em 6 fases para v2 |
| `COMO_USAR_MATCHING_IA.md` | Manual do recrutador (5 passos + benchmarks reais) |

---

## 15. Lições do que já vi no código

- O pipeline **separa em fases bem claras** — fácil de ir trocando partes (ex.: trocar embedding sem mexer em ranking).
- **Batching** é crítico — chamar LLM um por um seria 10x mais lento.
- **pgvector é mais simples** do que se imagina — não precisa de Pinecone/Weaviate para o volume atual.
- A regra v2 com gates é **conservadora demais para algumas vagas** (vagas amplas, sem requisitos obrigatórios fortes, ficam com ranking baixo). Pode precisar de calibração por tenant ou por categoria de vaga.
- **Talentos no UNION** é uma decisão importante — aumenta o pool sem custar muito (eles já têm embedding).

---

**Próximo passo (meu):** abrir `lucasbacklog.md` e listar o que vou efetivamente atacar nesta branch.

---

## 16. Provider-agnóstico — Fase 1 (LUC-100, 2026-04-25)

### 16.1 O que mudou

O serviço Python passou a ter uma **factory** que escolhe o provider de LLM e embeddings em runtime, com base em env vars. **Zero dependência hardcoded de OpenAI** no caminho do pipeline.

```python
# app/llm_factory.py
from app.llm_factory import get_chat_llm, get_embeddings_client

llm = get_chat_llm(temperature=0)      # respeita LLM_PROVIDER
emb = get_embeddings_client()          # respeita EMBEDDING_PROVIDER
```

### 16.2 Env vars

| Var | Valores | Default | Observação |
|---|---|---|---|
| `LLM_PROVIDER` | `openai` \| `gemini` \| `ollama` | `openai` | escolhe o LLM de scoring |
| `EMBEDDING_PROVIDER` | `openai` \| `gemini` \| `ollama` | `openai` | escolhe o embedder |
| `OPENAI_API_KEY` | string | — | **só exigida** se algum provider = openai |
| `GEMINI_API_KEY` | string | — | **só exigida** se algum provider = gemini |
| `OPENAI_CHAT_MODEL` | string | `gpt-4o-mini` | — |
| `GEMINI_CHAT_MODEL` | string | `gemini-2.5-flash` | — |
| `GEMINI_LANGCHAIN_EMBEDDING_MODEL` | string | `models/gemini-embedding-001` | embeddings via LangChain |
| `OLLAMA_BASE_URL` | URL | `http://localhost:11434` | — |
| `OLLAMA_CHAT_MODEL` | string | `qwen2.5:7b` | — |
| `OLLAMA_EMBEDDING_MODEL` | string | `bge-m3` | — |

### 16.3 Fail-fast condicional

Antes: `OPENAI_API_KEY` era obrigatória sempre.
Agora: só a chave do **provider selecionado** é obrigatória. Bateria de validação (`config.py`):

```text
[FATAL] Variáveis de ambiente obrigatórias ausentes: ['GEMINI_API_KEY (requerida porque LLM_PROVIDER ou EMBEDDING_PROVIDER = gemini)']
```

### 16.4 Arquivos tocados

| Arquivo | Mudança |
|---|---|
| `app/llm_factory.py` | **novo** — `get_chat_llm()` + `get_embeddings_client()` + `active_providers()` |
| `app/config.py` | Novas vars Gemini/Ollama, fail-fast condicional, `LLM_PROVIDER` adicionado |
| `app/unified_matching.py` | Todas as chamadas `ChatOpenAI(...)` → `get_chat_llm(...)` |
| `app/gemini_matching.py` | Idem; guards `OPENAI_API_KEY` removidos |
| `app/matching.py` (legado) | Idem; `OpenAIEmbeddings` → `get_embeddings_client()` |
| `app/embeddings.py` | `get_embeddings_model()` é agora um wrapper do factory (retrocompat) |
| `app/main.py` | `/health/ready` reporta `llm_provider`, `embedding_provider`, valida chave do provider ativo |
| `requirements.txt` | `+ langchain-google-genai>=2.0.0`, `+ langchain-ollama>=0.2.0` |

### 16.5 Smoke test (validado localmente)

```bash
curl http://localhost:8000/health/ready
# {
#   "status": "ok",
#   "db": "ok",
#   "llm_provider": "gemini",
#   "embedding_provider": "gemini",
#   "gemini_key": "ok"
# }
```

```python
from app.llm_factory import get_chat_llm, get_embeddings_client
llm = get_chat_llm()            # → ChatGoogleGenerativeAI
llm.invoke([...]).content       # → "pong"
get_embeddings_client().embed_query("...")  # → vetor 3072-dim
```

### 16.6 Observação importante — pipeline v2 Gemini (embeddings.py vs gemini_embeddings.py)

O código **já tinha** um caminho específico `gemini_embeddings.py` que usa o SDK `google-genai` direto para persistir numa coluna separada (`gemini_embedding vector(768)` nas tabelas `Vagas`/`Candidatos`/`Talentos`). Esse caminho **não passa pelo factory** — foi mantido intocado para não quebrar o schema existente.

O factory cobre o **caminho LangChain padrão** (`embeddings.py`, que é onde o pipeline v1 grava na coluna `embedding` 1536-dim/3072-dim).

Consequência: com `EMBEDDING_PROVIDER=gemini`, os embeddings vão para a **coluna padrão `embedding`** em formato Gemini (3072 dims) — **não** para `gemini_embedding`. Isso pode impactar busca vetorial se a coluna foi criada como `vector(1536)`. Item novo no backlog (LUC-115).

### 16.7 Próximas fases (roadmap LLM-agnóstico)

| Fase | Escopo | Status |
|---|---|---|
| **1** | Python: factory (OpenAI/Gemini/Ollama) | ✅ concluído (2026-04-25) |
| **2** | API .NET provider-agnóstica (`UnifiedAiService` aceita OpenAI/Gemini/Anthropic via factory) | ✅ concluído (2026-04-25) |
| 3 | Seleção por tenant (TenantConfiguracao + UI admin) | 📋 backlog |
| 4 | Cadastro de chaves no Owner (`/Owner/IA` funcional) | 📋 backlog |
| 5 | Observabilidade + docs operacionais | 📋 backlog |

Ver `lucasbacklog.md` (LUC-110..LUC-115 e derivados) para detalhes.

---

## 17. Provider-agnóstico — Fase 2 (API .NET, 2026-04-25)

### 17.1 O que mudou

A API .NET (`RHPortal.Api`) ganhou suporte real a **OpenAI / Gemini / Anthropic** via uma camada de factory. Antes só `OpenAiProvider` estava registrado; agora o `IAiProviderFactory` resolve qual `IAiProvider` usar baseado no nome do provider.

**Pontos cobertos pela Fase 2:** o caminho `UnifiedAiService.InvokeAsync(...)` — usado por:
- `POST /api/ai/invoke` (endpoint genérico de IA)
- `CvGptExtractor` (extração de dados de CV)
- `DocumentAiExtractor` (extração de dados de RG/CNH/comprovante via vision)
- Qualquer feature nova que injete `IUnifiedAiService`

**Fora do escopo (intencional):** os 7 serviços que hoje chamam `IOllamaClient` direto (`LlmAssistantService`, `EmbeddingService`, `VectorSearchService`, `DescricaoCargoGeneratorService`, `SalarioSuggesterService`, `CvResumoService`, `LlmMatchingService`). Esses ficam Ollama-only por enquanto — Fase 3 leva a escolha desses para o tenant.

### 17.2 Arquivos novos / modificados

| Arquivo | Mudança |
|---|---|
| `Application/Ai/AiOptions.cs` | **+** `GeminiOptions`, `AnthropicOptions`, `DefaultProvider` |
| `Application/Ai/GeminiProvider.cs` | **novo** — implementa `IAiProvider` para Google Generative Language API (`models/{model}:generateContent`) |
| `Application/Ai/AnthropicProvider.cs` | **novo** — implementa `IAiProvider` para Anthropic Messages API (`/v1/messages` + headers `x-api-key`, `anthropic-version`) |
| `Application/Ai/AiProviderFactory.cs` | **novo** — `IAiProviderFactory.Resolve(name)` → escolhe entre os providers registrados |
| `Application/Ai/UnifiedAiService.cs` | refatorado: usa o factory, e tenta resolver via `Master.AiProviderKey` primeiro, com fallback para `appsettings.Ai.{OpenAI|Gemini|Anthropic}` respeitando `Ai.DefaultProvider` |
| `Program.cs` | registra `OpenAiProvider`, `GeminiProvider`, `AnthropicProvider`, `AiProviderFactory` no DI |
| `appsettings.Development.json` | seções novas `Ai.Gemini` e `Ai.Anthropic` + `Ai.DefaultProvider` |

### 17.3 Ordem de resolução (lógica em `UnifiedAiService`)

```
1. Master.AiProviderKey (IsActive=true, IsDefault primeiro) →
   se existir, decripta + busca AiModel default do provider
2. Se DB vazio → fallback por config (Ai:DefaultProvider):
   2a. ordered1 = "OpenAI" | "Gemini" | "Anthropic" (conforme DefaultProvider)
   2b. para cada [ordered1, "OpenAI", "Gemini", "Anthropic"]:
       se ApiKey daquela seção != "" → usa
3. Se nada está configurado → retorna null (caller não chama IA)
```

### 17.4 Smoke test (validado localmente)

```bash
# Ambiente: AiProviderKey=0 (DB vazio), DefaultProvider="gemini",
# Ai.Gemini.ApiKey preenchida, Ai.OpenAI.ApiKey="".

curl -X POST http://localhost:5056/api/ai/invoke \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: liotecnica" \
  -H "Authorization: Bearer <jwt>" \
  -d '{"module":"smoke","payload":{"prompt":"...","cvText":"..."}}'

# → 200 OK
# → { "content": "{\"result\":\"pong\"}", "cost": 1.68e-05 }
```

A resposta veio do `gemini-2.5-flash` via factory. Nenhuma chave OpenAI envolvida.

### 17.5 Como adicionar um quarto provider (ex.: Mistral, Cohere)

1. Implemente `IAiProvider` em uma nova classe `MistralProvider`
2. Adicione `MistralOptions` em `AiOptions`
3. Registre no `Program.cs`: `builder.Services.AddScoped<IAiProvider, MistralProvider>()`
4. Adicione um caso no `AiProviderFactory.cs` mapeando o nome
5. Adicione seção `Ai.Mistral` no `appsettings.json`

Sem mexer em `UnifiedAiService` nem em nenhum caller existente.
