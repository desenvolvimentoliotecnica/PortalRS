# lucas — Stack Tecnológica do Voltage.RenderRH

> **Autor:** Lucas Machado · **Data inicial:** 2026-04-24
> Inventário técnico completo: linguagens, frameworks, bibliotecas, infra, ferramentas de dev. Use para onboarding e para decisões arquiteturais.

---

## 1. Resumo "elevator pitch"

| Camada | Stack |
|---|---|
| **Frontend** | Next.js 16 (App Router, static export) + React 19 + TypeScript + Tailwind + shadcn/ui |
| **API principal** | .NET 8 / ASP.NET Core (com salto progressivo para .NET 9 em algumas migrations) + EF Core |
| **IA / RAG** | Python 3.11 + FastAPI + LangChain + OpenAI (text-embedding-3-small + gpt-4o-mini) + pgvector + Gemini Embedding 002 (em rollout) |
| **Worker integração TOTVS** | .NET BackgroundService + Npgsql/SqlClient (lê SQL Server do TOTVS RM) |
| **Banco** | PostgreSQL 15+ (multi-tenant, banco por tenant) + extensão `pgvector` |
| **SSO** | Microsoft Entra ID (Azure AD) — OAuth2 Authorization Code + PKCE |
| **Storage** | AWS S3 (presigned URLs) — fallback local |
| **Mensageria** | SMTP (fila + retry no DB) + Twilio/Meta WhatsApp + Blip |
| **CI/CD** | Azure Pipelines (build Next.js + push artefato) |
| **Containerização** | Docker Compose (api, web-next, ai) — imagens em ECR (AWS) |

---

## 2. Frontend — `LioTecnica.Web.Next/`

### 2.1 Linguagens e framework

- **Next.js 16** (App Router) com **static export** (output: `out/`)
  - Servida sob `/app` no domínio raiz (proxied por algum CDN/edge — não há SSR em runtime)
- **React 19**
- **TypeScript** strict
- Gerenciador: **pnpm 8+**
- Node: **20 LTS**

### 2.2 UI / estilização

- **Tailwind CSS** (utility-first)
- **shadcn/ui** (componentes Radix sob a hood)
- **Lucide icons**

### 2.3 Estado e dados

- Padrão "feature folders": `src/features/{vagas,candidatos,matching,...}/`
- Cliente HTTP: `src/lib/api.ts` — função `apiFetch` injeta `Authorization: Bearer` (do JWT) e `X-Tenant-Id` (do JWT decodificado em sessionStorage)
- Sem proxy backend: o browser fala **direto** com `RHPortal.Api`
- Variáveis de ambiente:
  - `NEXT_PUBLIC_API_BASE` — URL pública da API .NET (ex.: `https://renderrh.qualiit.com.br/`)

### 2.4 Layouts

- `src/app/(app)/` — área autenticada do tenant (vagas, candidatos, etc.)
- `src/app/(admin)/` — área de admin do tenant
- `src/app/(owner)/` — área do super-admin (multi-tenant)
- `src/app/(public)/` — portal público de vagas e candidatura

---

## 3. API .NET — `RHPortal.Api/`

### 3.1 Linguagens e framework

- **C#** com **.NET 8** (target principal) e **.NET 9** em runtime quando disponível
  - O `README.md` cita `.NET 8.0`, mas algumas migrations e CLAUDE.md mencionam `.NET 9` — tratei como **.NET 8/9 unified** durante a migração
- **ASP.NET Core** (Minimal APIs + MVC controllers)
- **Entity Framework Core 9** (provider Npgsql para PostgreSQL)
- **ASP.NET Core Identity** para autenticação local (UserManager / RoleManager)

### 3.2 Bibliotecas principais

| Biblioteca | Para quê |
|---|---|
| `Npgsql.EntityFrameworkCore.PostgreSQL` | EF Core sobre PostgreSQL |
| `Pgvector` (Npgsql plugin) | Embeddings vetoriais nas tabelas `CandidatoEmbeddings` / `DescricaoCargoItemEmbeddings` |
| `Microsoft.AspNetCore.Identity.EntityFrameworkCore` | Identity tradicional |
| `Microsoft.AspNetCore.Authentication.JwtBearer` | JWT |
| `Microsoft.Identity.Web` (provavelmente) | Validação Entra ID |
| `AWSSDK.S3` | Storage de arquivos |
| `Twilio` SDK | Provider WhatsApp |
| `MailKit` ou `System.Net.Mail` | Envio SMTP |
| `Serilog` ou `Microsoft.Extensions.Logging` + DbLogWriterService | Logs no DB |
| `Polly` | Retry/circuit breaker (HttpClient para RHPortal.Ai) |

### 3.2.bis Providers de IA na API .NET (Fase 2 LLM-agnóstico — 2026-04-25)

A API .NET ganhou um sistema de **factory** que escolhe o provider em runtime entre OpenAI, Gemini, Anthropic e (futuro) outros via HTTP. Implementação em `Application/Ai/`:

| Arquivo | Função |
|---|---|
| `IAiProvider.cs` | Interface comum: `InvokeAsync(decryptedKey, providerName, modelId, payload, ct) → (Content, Cost)` |
| `OpenAiProvider.cs` | Cliente HTTP para `api.openai.com/v1/chat/completions` |
| `GeminiProvider.cs` | **novo** — Cliente HTTP para `generativelanguage.googleapis.com/v1beta/models/{m}:generateContent` |
| `AnthropicProvider.cs` | **novo** — Cliente HTTP para `api.anthropic.com/v1/messages` |
| `AiProviderFactory.cs` | **novo** — `IAiProviderFactory.Resolve(name)` → retorna o provider concreto |
| `UnifiedAiService.cs` | Orquestrador: resolve via DB (`AiProviderKey`) ou config (`Ai.{OpenAI\|Gemini\|Anthropic}`), respeitando `Ai.DefaultProvider` |

Detalhes em `lucasIA_RAG.md` §17. **Ollama** continua como cliente HTTP separado (`IOllamaClient`) para os serviços de chat/embeddings locais — Fase 3 unifica essa decisão por tenant.

### 3.3 Multi-tenancy

- **`MasterDbContext`** — 8 tabelas (Tenants, Owners, AiProviderKeys, AiModels, AiUsageRecords, OwnerAwsSettings, TenantModule, TenantPackage, TenantScreen)
- **`AppDbContext`** — 160+ DbSets (todas as tabelas de negócio do tenant)
- **`TenantMiddleware`** lê `X-Tenant-Id` do header (ou claim `tenant` do JWT) → resolve via `ITenantConnectionResolver` → `TenantTemplate = "dev_render_{0}"`
- **`TenantProvisioningService`** cria DB novo, aplica migrations, faz seed quando um tenant novo é criado

### 3.4 Autenticação e autorização

- **JWT Bearer**
  - Issuer/Audience: `RhPortal`
  - Duração: 1440 min (24h) configurável
  - Claims: `sub`, `email`, `tenant`, roles, permissions
- **Entra ID** (SSO Microsoft) — config armazenada criptografada por tenant em `EntraIdConfigs`
- **API Key** (header `X-Api-Key`) — para integrações backend-to-backend (RM, webhooks)
- **Magic Link** — `ApprovalMagicLink` para aprovação pública sem login

### 3.5 Background jobs

| Worker | Função |
|---|---|
| `EmailDispatchWorker` | Lê fila `EmailMessages`, envia via SMTP, retry |
| `CvImportWorker` | Processa CV (PDF) com IA — extrai texto, gera embedding |
| `EmbeddingIndexerHostedService` | Reindex de embeddings em pgvector |
| `BatchMatchingRunnerService` | Recompute matching em lote (sob demanda) |
| `MatchingRecomputeWorker` | Recomputa scores quando cache expira |
| `VagaUnifiedMatchingCacheCleanupService` | Limpeza de cache periódica |
| `ApprovalReminderService` | Envia lembretes de aprovação pendente |
| `IntegracaoRetryService` | Reintenta integrações TOTVS falhas |
| `InboxFolderWatcherService` | Monitora pasta de e-mails físicos |
| `DbLogWriterService` | Persiste logs no banco |

### 3.6 Performance

- **Rate limiter** global (300 req/min por IP, isenção via `X-Api-Key`)
- **Output caching** (policy "lookup", 5 min, varia por tenant + querystring)
- **Compressão** Brotli + Gzip
- **Connection pooling** Npgsql (32 conexões)

### 3.7 Localization

- pt-BR (padrão) + en-US
- `RequestLocalizationMiddleware` + `Resources/` com .resx

---

## 4. Serviço de IA / RAG — `RHPortal.Ai/`

### 4.1 Linguagem e framework

- **Python 3.11+**
- **FastAPI** (servidor REST assíncrono)
- **Uvicorn** (ASGI host)

### 4.2 Bibliotecas principais (`requirements.txt`)

| Biblioteca | Versão | Para quê |
|---|---|---|
| `fastapi` | ≥0.109.0 | Servidor REST |
| `uvicorn` | ≥0.27.0 | ASGI host |
| `langchain` | ≥0.1.0 | Framework base |
| `langchain-openai` | ≥0.0.5 | Provider OpenAI (chat + embeddings) |
| `langchain-google-genai` | ≥2.0.0 | Provider Gemini (chat + embeddings) — **Fase 1 LLM-agnóstico** |
| `langchain-ollama` | ≥0.2.0 | Provider Ollama local (chat + embeddings) — **Fase 1 LLM-agnóstico** |
| `langchain-community` | ≥0.0.20 | Integrações diversas (Chroma) |
| `openai` | 1.12.0 | Cliente OpenAI direto |
| `google-genai` | ≥1.0.0 | Cliente Gemini direto (usado em `gemini_embeddings.py` para coluna 768-dim) |
| `pgvector` | 0.8.2 | Cliente Python para pgvector |
| `psycopg2-binary` | ≥2.9.9 | Driver PostgreSQL |
| `tenacity` | ≥8.2.0 | Retry com backoff exponencial |
| `python-dotenv` | — | Lê `.env` |

**Factory provider-agnóstica:** `app/llm_factory.py` seleciona o client LangChain (OpenAI/Gemini/Ollama) com base em `LLM_PROVIDER` e `EMBEDDING_PROVIDER` no `.env`. Detalhes em `lucasIA_RAG.md` §16.

### 4.3 Modelos de IA disponíveis (selecionáveis via `.env`)

| Modelo | Provider | Para quê | Status |
|---|---|---|---|
| `text-embedding-3-small` | OpenAI | Embeddings 1536-dim | ✅ disponível |
| `gpt-4o-mini` | OpenAI | LLM scoring | ✅ disponível |
| `gemini-embedding-001` | Google | Embeddings 3072-dim (via LangChain) | ✅ disponível (**Fase 1**) |
| `gemini-embedding-002` | Google | Embeddings 768-dim (via SDK direto, coluna separada) | ✅ pipeline v2 (já existia) |
| `gemini-2.5-flash` | Google | LLM scoring (rápido, barato) | ✅ disponível (**Fase 1**) |
| `gemini-2.5-pro` | Google | LLM de alta qualidade | ✅ disponível (override) |
| `qwen2.5:7b` | Ollama (local) | Chat e rerank (LGPD-compliant) | ✅ disponível (**Fase 1**) |
| `bge-m3` | Ollama (local) | Embeddings locais | ✅ disponível (**Fase 1**) |

> O **provider ativo** por chamada é controlado por `LLM_PROVIDER` e `EMBEDDING_PROVIDER` no `.env`. Fase 3 do roadmap LLM-agnóstico faz isso ser configurável **por tenant** no DB.

### 4.4 Pipeline RAG

```
1. Pré-filtro vetorial (pgvector, distância coseno) → top 40
2. (Opcional) Hybrid pre-filter: 60% vetorial + 40% TF-IDF/stem pt-br → descarta fracos
3. Fetch profile data paralelo (ThreadPoolExecutor, 10 workers)
4. LLM avalia em BATCH (6 candidatos/chamada, gpt-4o-mini)
   → 4 dimensões: competência, experiência, formação, localidade
5. Cálculo de score:
   - v1: 80% filtros + 20% requisitos
   - v2: 65% filtros + 35% requisitos + gates duros
        (penalidade -20 por obrigatório faltando, teto por cobertura)
6. Ordena por score_final, retorna top N (default 20)
```

Latência típica: **25-40 s** para top 20 candidatos.

### 4.4.bis Factory provider-agnóstica (Fase 1 — 2026-04-25)

`app/llm_factory.py` expõe:

```python
from app.llm_factory import get_chat_llm, get_embeddings_client

llm = get_chat_llm(temperature=0)   # ChatOpenAI | ChatGoogleGenerativeAI | ChatOllama
emb = get_embeddings_client()       # OpenAIEmbeddings | GoogleGenerativeAIEmbeddings | OllamaEmbeddings
```

A escolha é dirigida por `LLM_PROVIDER` e `EMBEDDING_PROVIDER` no `.env`. Todos os pipelines (`unified_matching.py`, `gemini_matching.py`, `matching.py`) passam pelo factory. Detalhes completos em `lucasIA_RAG.md` §16.

### 4.5 Configuração

- `.env` no diretório `RHPortal.Ai/`:
  - `DATABASE_URL` (obrigatória)
  - `TENANT_DATABASE_TEMPLATE` (`dev_render_{0}`)
  - `LLM_PROVIDER` (`openai` | `gemini` | `ollama`) — **Fase 1 LLM-agnóstico**
  - `EMBEDDING_PROVIDER` (`openai` | `gemini` | `ollama`)
  - `OPENAI_API_KEY` (obrigatória se algum provider = `openai`)
  - `GEMINI_API_KEY` (obrigatória se algum provider = `gemini`)
  - `OPENAI_CHAT_MODEL`, `EMBEDDING_MODEL` (defaults OpenAI)
  - `GEMINI_CHAT_MODEL`, `GEMINI_LANGCHAIN_EMBEDDING_MODEL` (defaults Gemini)
  - `OLLAMA_BASE_URL`, `OLLAMA_CHAT_MODEL`, `OLLAMA_EMBEDDING_MODEL` (defaults Ollama)
  - `MATCHING_RULE_VERSION` (`v1_80_20` | `v2_65_35_strict`)
  - `HOST`, `PORT` (default 0.0.0.0:8000)
  - `DEFAULT_RANKING_SIZE` (default 20)

---

## 5. Worker de integração TOTVS — `Liotecnica.Integration.RM/`

### 5.1 Stack

- **.NET 8** (mesmo target da API)
- **BackgroundService** (`RmSyncWorker`)
- **SqlClient** para SQL Server (TOTVS RM)
- **HttpClient** para POST/PATCH na `RHPortal.Api`

### 5.2 Configuração

```jsonc
{
  "Rm": {
    "Server": "172.19.30.7",
    "Database": "CORPORERM_HMG",
    "UserId": "rm",
    "Password": "rm",
    "Encrypt": true
  },
  "RmSync": {
    "IntervalMinutes": 5,
    "SyncUnits": true,
    "SyncVagas": true,
    "SyncCandidatosVaga": true,
    "SyncCandidatosPerfilCv": true
  },
  "Portal": {
    "BaseUrl": "https://renderrh-qa.qualiit.com.br/api",
    "TenantId": "liotecnica-dev",
    "ApiKey": "..."
  }
}
```

### 5.3 Comandos suportados

```
dotnet run -- sync                      # Ciclo único de sync
dotnet run -- extract                   # Salva schema RM em JSON
dotnet run -- clean                     # Limpa dados sincronizados
dotnet run -- clean-candidatos-and-sync # Limpa candidatos + re-sync
dotnet run -- import-cv-by-talento <id> # Importa PDF de currículo de um talento
```

---

## 6. Banco de dados

### 6.1 PostgreSQL

- **Versão mínima:** 15
- **Recomendada para IA:** 18 (com `pgvector` 0.8.2)

### 6.2 Estratégia multi-tenant

- **Banco por tenant** via template `dev_render_{tenantId}`
- Bancos no setup local: `dev_render`, `dev_render_dev`, `dev_render_liotecnica`, `dev_render_master`

### 6.3 Migrations EF Core

- `AppDbContext`: 369 migrations (no momento da clonagem) + 10 migrations órfãs (SQL puro idempotente para features como Notifications, EmailTemplates, Celebrations, Feedback, OneOnOne, Mood, Gamification, BatchMatchingRuns)
- `MasterDbContext`: ~8 migrations
- **Regra crítica do projeto:** *toda alteração em entidade exige migration nova* (ver `CLAUDE.md`)

### 6.4 Extensões

- `pgvector` (embeddings + IVFFlat indexes para Candidatos, Vagas, DescricaoCargoItem)

### 6.5 Migration corrompida conhecida

- `20260411055438_AddUnidadeLotacaoHierarchyV2` foi gerada com schema completo por engano
- Workaround: `bash __scripts__/dev/fix-broken-migrations.sh` (marca como aplicada sem executar)

---

## 7. Cloud / Infra

### 7.1 AWS

| Serviço | Para quê |
|---|---|
| **S3** | Documentos (CVs, contratos, certificados) — presigned URL 15 min |
| **ECR** | Imagens Docker (`render-api`, `render-web-next`, `render-ai`) |

### 7.2 Azure

| Serviço | Para quê |
|---|---|
| **Azure DevOps** | Repo Git + Pipelines (CI/CD) |
| **Entra ID (Azure AD)** | SSO Microsoft (login corporativo do cliente) |

### 7.3 Containerização

- `docker-compose.yml` orquestra `api` (porta 5000), `web-next` (porta 3000) e `ai` (porta 8000) em produção, todas com healthcheck `/health`.

---

## 8. CI/CD — `azure-pipelines.yml`

- **Trigger:** push em `develop`
- **Stages:**
  1. Build Next.js (`pnpm install` + `next build` → gera `out/`)
  2. Compactação do projeto (tar.gz, exclui `node_modules`, `.next`, `.git`, CVs, logs)
  3. Publish artifact em Azure Artifacts
- **Características:**
  - Node 20 LTS
  - Suporta pnpm workspaces (com fallback)
  - Webpack forçado para garantir export estático
  - Verifica saída em `out/` ou `.next/export`

---

## 9. Ferramentas de desenvolvimento

### 9.1 Pré-requisitos locais

| Ferramenta | Versão mínima |
|---|---|
| .NET SDK | 8.0 |
| Node.js | 20 LTS |
| pnpm | 8+ |
| PostgreSQL | 15+ |
| Python | 3.11+ |
| Git Bash (Windows) | obrigatório para `.sh` |

### 9.2 Scripts úteis (`__scripts__/dev/`)

| Script | Função |
|---|---|
| `dev-all.sh` | Sobe API (5056), Next (3000), AI (8000), worker RM em paralelo |
| `fix-broken-migrations.sh` | Corrige migration V2 corrompida |
| `apply-all-tenant-migrations.sh` | Aplica migrations em todos os tenants |
| `kill-ports.sh` | Mata processos nas portas do projeto |
| `ports.sh` | Utilitários de gerenciamento de portas |

### 9.3 Script de bateria de testes

- `__scripts__/test-battery.sh` — testa 50+ endpoints críticos (auth, vagas, candidatos, matching, email)

### 9.4 Mocks TOTVS

- `__scripts__/totvs/qa-mock-totvs-admissao.ts` (TS)
- `__scripts__/totvs/qa-mock-fullflow-admissao.py` (Python)
- Para simular respostas TOTVS sem precisar do RM real

### 9.5 Setup pgvector (Windows)

- `scripts/` tem instalador para Windows com PostgreSQL EDB (copia .dylib do Homebrew em macOS)

---

## 10. Credenciais de dev (já documentadas no README)

| Tipo | E-mail | Senha |
|---|---|---|
| Owner (super admin) | `owner@dev.local` | `ChangeThisPassword123!` |
| Admin de tenant | `admin@dev.local` | `ChangeThisPassword123!` |

URLs:
- Frontend Next.js: `http://localhost:3000/app`
- API .NET (Swagger): `http://localhost:5056/swagger`
- IA Python (FastAPI docs): `http://localhost:8000/docs`

---

## 11. Riscos e dívidas técnicas conhecidas

| Item | Onde tratar |
|---|---|
| Migration corrompida `AddUnidadeLotacaoHierarchyV2` | Workaround documentado (script bash) |
| RHPortal.Ai com `DATABASE_URL` única — multi-tenant precisa do template | Já há `get_database_url(tenant_id)` em `config.py` |
| Inbox watcher: infra pronta, worker ativo | Implementar parser de `.eml` |
| Worker Datasul não roda automaticamente | Implementar consumer da fila `IntegracaoTotvsController` |
| Secrets em `appsettings.json` (RM password, OpenAI key) | Migrar para Azure Key Vault em produção |
| Ranking persiste só Candidatos (Talentos avaliados mas não salvos) | Estender `CandidatoVagaMatchingScores` ou criar nova tabela |

---

**Fim do inventário técnico — manterei atualizado conforme as decisões da Fase 4.5 evoluírem.**
