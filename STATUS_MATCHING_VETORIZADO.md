# Status da implementação – Matching vetorizado unificado

Resumo do que foi verificado no código em relação ao plano: **texto canônico → embeddings (OpenAI) → pré-filtro vetorial (pgvector) → LLM 80/20 → ranking**.

---

## ✅ O que está implementado

### 1. Texto canônico e embeddings (RHPortal.Ai)

- **`embeddings.py`**
  - `_build_vaga_text_for_embedding`: texto canônico da vaga com **todos** os dados (título, código, senioridade, modalidade, escolaridade, descrições, stack, idiomas, filtros, requisitos obrigatórios/desejáveis, etc.).
  - `_build_candidato_text_for_embedding`: candidato (nome, resumo, CV, competências, localização).
  - `_build_talento_text_for_embedding`: talento (nome, resumo, competências, experiências, formação, localização).
- Geração de embedding via **OpenAI** (`text-embedding-3-small`) e **salvamento no banco** (Vagas, Candidatos, Talentos).
- Endpoints: `POST /embeddings/vaga/{id}`, `POST /embeddings/candidato/{id}`, `POST /embeddings/talento/{id}`.

### 2. Banco de dados

- **Migrations**
  - `AddEmbeddingSupport.sql`: Vagas e Candidatos (colunas de embedding + índice).
  - `AddTalentoEmbedding.sql`: Talentos (colunas `"Embedding"`, `"EmbeddingGeneratedAtUtc"` + índice).
- **db.py**
  - `get_vaga_perfil`: vaga completa + requisitos.
  - `get_talento_perfil`: talento com competências, experiências, formação.
  - `get_talentos_ids`, `get_vagas_abertas_ids` para uso em lote.

### 3. Busca vetorial (pgvector)

- **`vector_search.py`**
  - `search_all_by_similarity`: **UNION** de Candidatos e Talentos por similaridade de cosseno com a vaga; retorna top N com `similaridade` 0–100 e `source` (candidato/talento).
  - Suporte a `tenant_id`, `limit`, `min_score`.

### 4. Pipeline unificado (vetorial + LLM 80/20)

- **`unified_matching.py`**
  - `run_unified_matching`: garante embedding da vaga → busca vetorial (top N) → LLM avalia cada um (score_filtros 80%, score_requisitos 20%) → retorna ranking por `score_final`.
  - `evaluate_single_person`: avalia **uma** pessoa (candidato ou talento) contra uma vaga (para inclusão incremental no ranking).
- **RHPortal.Ai**
  - `POST /matching/run`: executa o matching completo e devolve ranking com `score_final`, `score_filtros`, `score_requisitos`, `justificativa`, `source`, `similaridade_vetorial`.
  - `POST /matching/evaluate-one`: avalia uma pessoa contra uma vaga.

### 5. API e front (pontos na aba de matching)

- **VagasController.GetMatchingCandidates**
  - Chama `RunUnifiedMatchingAsync` (POST /matching/run no RHPortal.Ai).
  - Retorna itens com `Score` (= score_final), `ScoreFiltros`, `ScoreRequisitos`, `Justificativa`, `Source`.
- **Front (matching.js + Matching.cshtml)**
  - Consome `GET .../matching-candidates` e exibe o **score** (percentual) na lista e no detalhe. Os pontos exibidos vêm do pipeline que **começa nos embeddings** (vetor → LLM 80/20).

### 6. Geração de embedding em background

- **Vaga**: ao criar ou atualizar vaga, `VagaService` chama `TryGenerateVagaEmbeddingAsync` (fire-and-forget).
- **Candidato**: ao criar ou atualizar candidato, `CandidatoService` chama `TryGenerateCandidatoEmbeddingAsync` (fire-and-forget).

---

## ⚠️ Parcial ou divergente do plano

### 1. Recalc em background ao atualizar filtros

- **VagasController**: ao dar PATCH em matching-filtros, chama `RecalcMatchingScoresInBackgroundAsync`.
- Esse método usa **`GetMatchingByFiltersAsync`** → POST **`/match`** (endpoint **legado**, não o unificado).
- Ou seja: o recalc em background **não** usa o pipeline vetorial + LLM 80/20; usa o matching antigo por critérios/keywords.

**Sugestão:** fazer `RecalcMatchingScoresInBackgroundAsync` chamar `RunUnifiedMatchingAsync` e, em seguida, persistir o ranking (respeitando limitações de CandidatoVagaMatchingScore – ver item 3).

### 2. Novo candidato → score no ranking — **CORRIGIDO**

- **CandidatoService.TrySaveAiScoreAsync** passa a chamar **`EvaluateOneUnifiedAsync`** (POST `/matching/evaluate-one`) primeiro; em caso de falha, faz fallback para `GetScoreForOneAsync` (legado). O score é persistido em `CandidatoVagaMatchingScore`.

### 3. Persistência do ranking (CandidatoVagaMatchingScore)

- A **tabela** e o **service** só têm **CandidatoId** (e VagaId, Score, etc.).
- O matching unificado retorna **candidatos e talentos** (`person_id` + `source`).
- Hoje o ranking **persistido** não pode incluir talentos; só candidatos. O fallback “ler do store” em GetMatchingCandidates só mostra candidatos.
- O comentário em `unified_matching.py` (“Persiste ranking em CandidatoVagaMatchingScore”) reflete a intenção; na prática, a API **não** chama o store após `/matching/run` para gravar esse ranking (e mesmo que chamasse, talentos seriam ignorados pelo modelo atual da tabela).

**Sugestão:**
- Ou estender o modelo (ex.: `PersonId` + `Source` candidato/talento) e o store para permitir ranking misto,
- Ou manter store só para candidatos e documentar que “ranking persistido = apenas candidatos”.

### 4. Config de ranking por tenant (0–100)

- Limite do ranking é **fixo** por env: `DEFAULT_RANKING_SIZE` (default 40) no `config.py` do RHPortal.Ai.
- Não há **configuração por tenant** (ex.: “este tenant quer top 60”) no banco ou no código.

**Sugestão:** se for requisito, acrescentar campo (ex.: `RankingSize` ou `MatchingRankingLimit`) na config do tenant e passar esse valor nas chamadas a `/matching/run` e no recalc em background.

### 5. Worker “ao criar vaga” para todos os talentos

- Hoje, ao criar/abrir vaga, só é disparada a **geração do embedding da vaga**.
- Não existe worker que, ao criar/abrir vaga, **gere embeddings em lote** para todos os talentos do tenant (nem que rode o matching completo e persista o ranking).
- Embeddings de talentos são gerados sob demanda (chamada ao endpoint por talento), não em lote por evento de vaga.

**Sugestão:** se for requisito “ao criar/atualizar vaga, garantir embeddings de talentos e/ou rodar matching”, criar job/worker que:
- liste talentos do tenant,
- chame POST /embeddings/talento/{id} para os que ainda não têm embedding (ou reprocessar),
- e/ou chame `/matching/run` e persista o ranking (respeitando modelo da tabela de scores).

---

## 🔴 Pontos de atenção

### 1. Nome das colunas de embedding (Vagas / Candidatos) — **CORRIGIDO**

- **embeddings.py** e **vector_search.py** passaram a usar **minúsculas** (`embedding`, `embedding_generated_at_utc`) para as tabelas **Vagas** e **Candidatos**, alinhados à **AddEmbeddingSupport.sql**.
- A tabela **Talentos** continua com **PascalCase** (`"Embedding"`, `"EmbeddingGeneratedAtUtc"`) conforme **AddTalentoEmbedding.sql**.

### 2. “Pontos com base nos embeddings”

- O fluxo atual já é **baseado em embeddings**: texto canônico → embedding vaga/pessoa → busca vetorial → LLM 80/20 → score_final.
- Os pontos exibidos na aba de matching **são** o resultado desse pipeline (score_final). A “similaridade vetorial” também está disponível no retorno (`similaridade_vetorial`) e pode ser exibida no front se quiserem mostrar “vetor” e “LLM” separados.

---

## Resumo rápido

| Item do plano | Status |
|---------------|--------|
| Texto canônico vaga/candidato/talento | ✅ |
| Embeddings OpenAI + salvar no banco | ✅ |
| Pré-filtro vetorial (pgvector) + UNION candidatos/talentos | ✅ |
| Limite do ranking (0–100) | ✅ (fixo por env, não por tenant) |
| LLM 80% filtros / 20% requisitos | ✅ |
| Pontos exibidos na aba de matching com base nesse pipeline | ✅ |
| Worker ao criar vaga (só embedding vaga) | ✅ (não em lote para talentos) |
| Recalc ao atualizar filtros | ✅ Usa RunUnifiedMatchingAsync e persiste candidatos |
| Novo candidato → entrar no ranking (evaluate-one) | ✅ TrySaveAiScoreAsync usa EvaluateOneUnifiedAsync |
| Ranking persistido (store) | ✅ Persistido em background após GetMatchingCandidates e no recalc |
| Config ranking por tenant | ❌ Não implementado (continua env DEFAULT_RANKING_SIZE) |
| Embeddings em lote de talentos ao criar vaga | ✅ Batch /embeddings/talentos/batch + Talento create/update gera embedding |
| Colunas Vagas/Candidatos (embedding) | ✅ Minúsculas no Python (compatível com migration) |

Se quiser, posso propor patches concretos (C# + Python) para: (1) recalc usar `/matching/run`, (2) novo candidato usar `/matching/evaluate-one`, (3) alinhar nomes de colunas de embedding e (4) opcionalmente persistir ranking após `/matching/run` (só candidatos ou modelo estendido).
