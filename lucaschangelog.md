# lucas — Changelog pessoal

> **Autor:** Lucas Machado · **Branch:** `feature/ia-rag-fase-4-5_v2`
> Histórico do que **eu** efetivamente fiz no projeto. Independente do `changelog.md` global do time. Cada entrada vincula ao item do `lucasbacklog.md` quando aplicável.

> **Convenção:** entradas em ordem reversa (mais recente em cima). Cabeçalho de cada dia: `## YYYY-MM-DD`. Cada item: tipo (✨ feature, 🐛 bugfix, 🔧 refactor, 📝 docs, 🏗️ infra, 🔬 spike) + título + impacto resumido + commit/PR (quando houver).

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
