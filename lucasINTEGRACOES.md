# lucas — Integrações e Sub-projetos

> **Autor:** Lucas Machado · **Data inicial:** 2026-04-24
> Inventário das integrações externas e dos sub-projetos auxiliares. Para cada item: **propósito de negócio**, **como funciona**, **status atual** e **arquivos-chave**.

---

## Sumário rápido (status)

| Integração / sub-projeto | Tipo | Status | Onde |
|---|---|---|---|
| TOTVS RM (sync de mestres) | ETL RM → Portal | ✅ Em produção | `Liotecnica.Integration.RM/` |
| TOTVS Datasul (movimentações) | API Portal → ERP | ⚠️ API pronta, worker manual | `RHPortal.Api/...IntegracaoTotvsController` |
| Microsoft Entra ID (SSO) | OAuth2 | ✅ Em produção, por tenant | `RHPortal.Api/Application/Authentication/` |
| OpenAI (LLM + embeddings) | API | ✅ Em produção | `RHPortal.Api/Application/Ai/` + `RHPortal.Ai/app/` |
| **Gemini (chat + embeddings)** | API | ✅ **Em produção via factory** (Fase 1+2 LLM-agnóstico) | `RHPortal.Ai/app/llm_factory.py`, `RHPortal.Api/Application/Ai/GeminiProvider.cs` |
| **Anthropic (Claude)** | API | ✅ **Implementado** (sem chave configurada) | `RHPortal.Api/Application/Ai/AnthropicProvider.cs` |
| Ollama (LLMs locais) | LLM local | ✅ Suportado opcional | `RHPortal.Ai/` |
| AWS S3 | Storage | ✅ Em produção | `RHPortal.Api/Infrastructure/Storage/` |
| AWS ECR | Container registry | ✅ Em produção | `docker-compose.yml` |
| SMTP (e-mail) | Mensageria | ✅ Em produção | `RHPortal.Api/Messaging/Email/` |
| WhatsApp (Twilio) | Mensageria | ⚠️ Implementado, provider "Logging" ativo | `RHPortal.Api/Messaging/WhatsApp/` |
| WhatsApp (Meta Cloud) | Mensageria | ⚠️ Implementado, sem credencial em prod | idem |
| Blip (chatbot) | Mensageria | ⚠️ Implementado, uso pontual | `RHPortal.Api/Controllers/ComunicacaoController.cs` |
| Nominatim (geocoding) | API pública | ✅ Em uso (location scoring) | `RHPortal.Ai/app/location_scoring.py` |
| pgvector | Extensão DB | ✅ Em produção | PostgreSQL |
| Inbox de e-mails (.eml) | Folder watcher | ⚠️ Infra pronta, worker inativo | `RHPortal.Api/.../InboxFolderWatcherService.cs` |
| Azure DevOps Pipelines | CI/CD | ✅ Em produção | `azure-pipelines.yml` |

---

## 1. TOTVS RM — `Liotecnica.Integration.RM/`

### 1.1 Propósito

Sincroniza dados-mestres do **TOTVS RM** (sistema de RH legado da Liotécnica) para o Portal RenderRH. É o caminho **RM → Portal** (one-way para a maioria das entidades).

### 1.2 Entidades sincronizadas

| Entidade RM | Tabela RM | → Entidade Portal |
|---|---|---|
| Departamento | `PSECAO` | Areas |
| Função | `PFUNCAO` | Categorias/Funções |
| Cargo | `PCARGO` | Cargos |
| Unidade/Filial | `GFILIAL` | Units |
| Pessoa | `PPESSOA` | Pessoas |
| Funcionário | `SEMPRESAFUNCIONARIO` | Funcionarios |
| Vaga | `VRSVAGAS` | Vagas |
| Candidato (com CV) | extração | Candidatos + CandidatoDocumento |

### 1.3 Como roda

- **`RmSyncWorker`** (BackgroundService .NET) — ciclo a cada **5 minutos** (configurável via `RmSync:IntervalMinutes`).
- **`RmDataExtractor`** lê o SQL Server do RM via `SqlClient`.
- 12 services especializados (`PortalAreaSyncService`, `PortalCargoSyncService`, etc.) fazem **POST/PATCH** na `RHPortal.Api` autenticando com `X-Api-Key`.
- **`ExtractionLogWriter`** gera relatórios em `Liotecnica.Integration.RM.Logs/`.

### 1.4 Configuração (`appsettings.json`)

```jsonc
{
  "Rm": {
    "Server": "172.19.30.7",
    "Database": "CORPORERM_HMG",
    "UserId": "rm",
    "Password": "rm",
    "Encrypt": true
  },
  "RmSchema": {
    "Schema": "dbo",
    "AreaTable": "BAREA",
    "CargoTable": "PCARGO",
    "VagaTable": "VRSVAGAS",
    "FuncionarioTable": "SEMPRESAFUNCIONARIO"
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
    "ApiKey": "hJf2X6nDohX8AG7vq3Te4aVwpnxnYVEvdEBkQkqkZFc"
  }
}
```

### 1.5 Comandos manuais

```bash
dotnet run -- sync                       # Um ciclo único de sync
dotnet run -- extract                    # Salva schema RM em JSON (para análise)
dotnet run -- clean                      # Limpa dados sincronizados no Portal
dotnet run -- clean-candidatos-and-sync  # Reset candidatos + re-sync completo
dotnet run -- import-cv-by-talento <id>  # Importa PDF de currículo de um talento
```

### 1.6 Sub-projetos relacionados

- **`Liotecnica.Integration.RM.Schema/`** — define `RmSchemaOptions` e nomes de tabelas como classe.
- **`Liotecnica.Integration.RM.Schema.Tables/`** — JSONs com extrações offline do schema (área, cargo, departamento, funcionário, etc.) para desenvolvimento sem precisar do RM.

### 1.7 Status

✅ **Em produção** — sincronização contínua, logs com histórico completo.

---

## 2. TOTVS Datasul (movimentações) — `RHPortal.Api`

### 2.1 Propósito

Direção contrária do RM: o Portal **empurra** movimentações (promoção, transferência, mérito, reclassificação de cargo, transferência de centro de custo) para o **Datasul** (módulo de folha do TOTVS).

### 2.2 Tipos de movimentação

- `Promocao`
- `Merito`
- `ReclassificacaoCargo`
- `TransferenciaCC`
- `PromocaoTransferenciaBase`
- `Outros`

Também cobre **Pré-admissão**, **Desligamento** e **Férias** (entidades com campos `IntegracaoResultado`, `IntegracaoMensagem`, `IntegradaEmUtc`).

### 2.3 Endpoints (Portal lado server)

| Endpoint | O que faz |
|---|---|
| `GET /api/integracao-totvs/painel?tipo=4` | Lista movimentações pendentes (campo `integracaoResultado: null`) |
| `GET /api/integracao-totvs/4/{id}` | Detalha uma movimentação |
| `POST /api/integracao-totvs/4/{id}/resultado` | Reporta sucesso/falha após envio |
| `POST /api/integracao-totvs/{tipo}/{id}/retry` | Reintenta envio falho |
| `POST /api/integracao-totvs/{tipo}/{id}/marcar-sucesso` | Marca como sucesso manual |
| `POST /api/integracao-totvs/{tipo}/{id}/marcar-falha` | Marca como falha irreversível |

### 2.4 Worker consumer

**Não está implementado dentro do projeto** — o Datasul espera receber via `POST http://localhost:5056/apisftransferencia.p` (procedure Progress). A ideia é:

1. Worker externo (ou um futuro `DatasulWorker` no `Liotecnica.Integration.RM/`) faz polling de `/api/integracao-totvs/painel?tipo=4`
2. Para cada item, envia para a procedure Datasul
3. Reporta resultado em `POST /api/integracao-totvs/4/{id}/resultado` com `{ "resultado": 1 ou 2, "mensagem": "..." }`

### 2.5 Status

⚠️ **API pronta, worker manual** — disparo é manual ou via integração externa por enquanto. Documentação completa em `INTEGRACAO-MOVIMENTACOES-DATASUL.md`.

---

## 3. Microsoft Entra ID (SSO)

### 3.1 Propósito

Login corporativo via **Microsoft Azure AD (Entra ID)** — usuário do tenant clica "Login com Microsoft" e é autenticado via Office 365 sem precisar criar senha local.

### 3.2 Fluxo OAuth2 Authorization Code

```
1. Usuário acessa /app/login
2. Clica "Login com Microsoft"
3. Frontend chama GET /api/auth/entra/challenge
   → API retorna URL de redirecionamento + state + nonce + code_challenge (PKCE)
4. Browser redireciona para login.microsoftonline.com
5. Usuário autoriza
6. Microsoft redireciona para GET /api/auth/entra/callback?code=...&state=...
7. API valida via EntraTokenValidator
   → troca code por token
   → valida assinatura JWT contra chaves do Entra
   → extrai claims (email, sub, tid)
8. API cria/atualiza ApplicationUser + emite JWT do RhPortal
9. Frontend armazena JWT, decodifica claim `tenant`, segue navegando
```

### 3.3 Configuração (por tenant, no banco)

| Campo | Origem |
|---|---|
| `IsEnabled` | UI de admin |
| `EntraTenantId` (Microsoft) | Console Entra |
| `ClientId` (App Registration) | Console Entra |
| `ClientSecret` (criptografado) | Console Entra |
| `CallbackPath` | `/api/auth/entra/callback` |

Tabela: `EntraIdConfigs` no banco do tenant.

### 3.4 Serviços envolvidos

- `IEntraIdConfigService` — gerência das credenciais (criptografadas via `ISecretProtector`)
- `IEntraChallengeService` — gera/valida nonce + state PKCE
- `IEntraTokenValidator` — valida JWT do Entra
- `EntraIdConfigController` — CRUD de config
- `AuthController` — endpoints `/entra/{enabled,challenge,callback}`

### 3.5 Status

✅ **Em produção** — login corporativo 100% funcional, configurável por tenant.

---

## 4. LLMs externos (OpenAI / Gemini / Anthropic) — provider-agnóstico

> **Atualização Fase 1+2 (2026-04-25):** o projeto agora aceita **OpenAI, Gemini ou Anthropic** via factory tanto no Python (`llm_factory.py`) quanto na API .NET (`AiProviderFactory`). Ollama continua disponível para uso local. A escolha do provider é por env (Python) ou por config + DB (.NET). Detalhes em `lucasIA_RAG.md` §16-17.

### 4.1 Onde é usado

| Uso | Onde | Modelo |
|---|---|---|
| Embeddings de vagas/candidatos/talentos | `RHPortal.Ai` (Python) | `text-embedding-3-small` (1536-dim) |
| LLM scoring em batch (4 dimensões) | `RHPortal.Ai` (Python) | `gpt-4o-mini` |
| Geração de descrição de cargo | `RHPortal.Api` (.NET) | `gpt-4o-mini` |
| Sugestão de salário | `RHPortal.Api` (.NET) | `gpt-4o-mini` |
| Extração de dados de CV (PDF→JSON) | `RHPortal.Api` `CvImportWorker` | `gpt-4o` ou `gpt-4o-mini` |
| Resumo de CV | `RHPortal.Api` AssistenteIaController | `gpt-4o-mini` |
| Chat assistente RH (RAG) | `RHPortal.Api` AssistenteIaController | depende do tenant |

### 4.2 Onde fica a chave

| Local | Caso |
|---|---|
| Master DB (`AiProviderKey`, criptografado) | Quando o owner gerencia (preferido em prod) |
| `appsettings.json` (`Ai:OpenAI:ApiKey`) | Fallback de dev — `UnifiedAiService` cai aqui se não houver chave no banco |
| `RHPortal.Ai/.env` (`OPENAI_API_KEY`) | Obrigatório para o serviço Python subir (fail-fast) |

### 4.3 Auditoria de uso

Tudo é registrado em `AiUsageRecord` (Master DB) — `userName`, `module`, `cost`, `tokens`, `requestMessage`. Permite billing detalhado por tenant.

### 4.4 Status

✅ **Em produção** — todos os fluxos IA funcionando.

---

## 5. Gemini Embedding 002 (em teste)

### 5.1 Propósito

Provider alternativo ao OpenAI para embeddings — multimodal nativo (texto + PDF), 768 dimensões (mais rápido), e independência de fornecedor.

### 5.2 Onde está

`RHPortal.Ai/app/gemini_*`:
- `gemini_config.py` — config (chave, modelo)
- `gemini_embeddings.py` — geração
- `gemini_matching.py` — pipeline paralelo
- `gemini_vector_search.py` — busca pgvector específica

Endpoints:
- `POST /v2/matching/run`
- `POST /v2/matching/trigger`
- `POST /v2/matching/evaluate-person`
- `POST /v2/embeddings/generate`
- `POST /v2/embeddings/batch-talentos`
- `GET /v2/stats`

### 5.3 Status

🔄 **Em teste (Fase 4.5)** — feature flag por tenant, ainda não rollout completo. Coluna no DB: `gemini_embedding vector(768)`.

---

## 6. Ollama (LLMs locais — opcional)

### 6.1 Propósito

Para tenants com requisitos LGPD rígidos: rodar **chat e rerank 100% local** sem mandar nada para nuvem.

### 6.2 Modelos sugeridos

- `qwen2.5:7b` — chat e rerank
- `bge-m3` — embeddings

### 6.3 Setup

```bash
brew install ollama
ollama pull qwen2.5:7b
ollama pull bge-m3
ollama serve  # em http://localhost:11434
```

Configurar no `appsettings.json` (.NET):
```json
"Ai": { "Ollama": { "BaseUrl": "http://localhost:11434", "Model": "qwen2.5:7b" } }
```

### 6.4 Status

✅ **Suportado opcional** — fallback automático para léxico puro se Ollama indisponível. Documentado em `GUIA_IA_RAG.md`.

---

## 7. AWS S3 (Storage)

### 7.1 Propósito

Storage seguro de **documentos** (CVs, portfólios, contratos, declarações, certificados, fotos).

### 7.2 Como funciona

- Upload via API .NET → `S3StorageService` empacota com Content-Type + chave estruturada (ex.: `{tenant}/{vagaId}/{fileHash}.pdf`)
- Bucket criptografado (AES256)
- Download via **presigned URL** (válida por 15 min — configurável)
- Deletes preservados (soft) com auditoria

### 7.3 Configuração

```jsonc
{
  "Aws": {
    "AccessKeyId": "AKIA...",
    "SecretAccessKey": "...",
    "Region": "us-east-1",
    "BucketName": "renderrh-docs-prod",
    "PresignedUrlExpirationMinutes": 15
  }
}
```

Pode ser por tenant (`TenantAwsSettings`) ou global do owner (`OwnerAwsSettings`) — credenciais sempre criptografadas.

### 7.4 Status

✅ **Em produção**. Fallback para storage local se S3 não configurado.

---

## 8. SMTP (E-mail transacional)

### 8.1 Propósito

Disparar e-mails transacionais (admissão, aprovação, agendamento, propostas, magic links, etc.) via SMTP do tenant.

### 8.2 Arquitetura

```
Evento → EmailQueueService.Enqueue(email)
       → EmailMessage persiste em DB (Pendente)
       → EmailDispatchWorker (BackgroundService 24/7)
       → EmailTemplateRenderer renderiza HTML
       → SmtpEmailSender envia
       → Marca Enviada ou Falha (retry até N vezes)
       → EmailAttempt registra cada tentativa
```

### 8.3 Configuração (por tenant)

Tabela `EmailConfigs` no banco do tenant:
- SmtpHost, SmtpPort (587 TLS ou 465 SSL)
- SmtpUser, PasswordEncrypted (via `ISecretProtector` com chave em `EmailConfig:EncryptionKey` no appsettings)
- FromAddress, FromName
- IsEnabled

### 8.4 Templates

`EmailTemplate`: nome, assunto, corpo HTML, variáveis suportadas. Editáveis via `/app/admin/email-templates`.

### 8.5 Status

✅ **Em produção** — fila com retry, suporte a anexos, templates editáveis.

---

## 9. WhatsApp (Twilio + Meta Cloud)

### 9.1 Propósito

Notificar candidatos e colaboradores via WhatsApp (confirmações, agendamentos, lembretes).

### 9.2 Multi-provider

| Provider | Library | Quando usar |
|---|---|---|
| `Twilio` | Twilio SDK | Quando o tenant tem conta Twilio Business |
| `MetaCloud` | HttpClient para Graph API | Quando o tenant tem WhatsApp Business API direto |
| `Logging` | (mock) | Dev/teste — só loga, não envia |

Selecionado via `WhatsApp:Provider` no `appsettings.json`.

### 9.3 Limitações de envio

- **Rate limit:** máx 5 mensagens / 60 minutos por pessoa
- **Horário silencioso:** respeita janela (ex.: 22h-08h não envia)
- **Idioma default:** pt-BR

### 9.4 Configuração

```jsonc
{
  "WhatsApp": {
    "Provider": "Logging",  // "Twilio" | "MetaCloud" | "Logging"
    "RateLimitMaxMensagens": 5,
    "RateLimitJanelaMinutos": 60,
    "RespeitarSilencio": true,
    "IdiomaDefault": "pt-BR",
    "Twilio": { "AccountSid": "AC...", "AuthToken": "...", "FromNumber": "+5511..." },
    "MetaCloud": { "PhoneNumberId": "...", "AccessToken": "...", "GraphVersion": "v18.0" }
  }
}
```

### 9.5 Status

⚠️ **Implementado, provider "Logging" em produção** — Twilio e Meta prontos para ativar quando credenciais forem provisionadas.

---

## 10. Blip (chatbot)

### 10.1 Propósito

Disparo de mensagens via plataforma Blip (chatbot omnichannel brasileiro).

### 10.2 Endpoint

`POST /api/comunicacao/blip` (em `ComunicacaoController`).

### 10.3 Configuração (por tenant)

Adicionada recentemente (migration `AddBlipApiUrlAndKeyNaTenantConfiguracao` em 2026-04-23): `BlipApiUrl` + `BlipApiKey` no `TenantConfiguracao`.

### 10.4 Status

⚠️ **Implementado, uso pontual** — depende de cada tenant ter conta Blip.

---

## 11. Nominatim (geocoding)

### 11.1 Propósito

Resolver coordenadas (lat/lon) de cidades para o **location scoring** do matching IA (cálculo de distância Haversine entre candidato e vaga).

### 11.2 Como funciona

`RHPortal.Ai/app/location_scoring.py` chama Nominatim (OpenStreetMap) para geocodificar e calcula distância. Modalidade da vaga (Remoto/Híbrido/Presencial) e `LocalidadeMaxDistanciaKm` da vaga determinam decay linear do score.

### 11.3 Status

✅ **Em uso**. Custo zero (API pública), usar com moderação (rate limit OSM).

---

## 12. pgvector (Postgres extension)

### 12.1 Propósito

Armazenar e buscar **embeddings vetoriais** dentro do próprio PostgreSQL (em vez de Chroma, Pinecone ou outro vector DB externo).

### 12.2 Tabelas com vetor

- `Vagas.embedding` — vector(1536) — embedding OpenAI da vaga
- `Vagas.gemini_embedding` — vector(768) — embedding Gemini (em teste)
- `Candidatos.embedding` — vector(1536)
- `Talentos."Embedding"` — vector(1536)
- `DescricaoCargoItemEmbedding` — vector
- `CandidatoEmbedding` — vector

### 12.3 Índices

IVFFlat (`lists=100`) — bom trade-off entre latência (<10 ms) e precisão.

### 12.4 Setup local

- Migration `AddEmbeddingsPgvector` cria a extensão e as colunas
- macOS: extensão vem com Homebrew
- Windows EDB: precisa `scripts/setup-pgvector-windows.ps1` que copia .dylib para o diretório de extensões do PostgreSQL

### 12.5 Status

✅ **Em produção**.

---

## 13. Inbox de e-mails físicos (.eml)

### 13.1 Propósito

Importar e-mails recebidos em pasta local (`Inbox/incoming/`) — útil para casos de candidatura por e-mail (CV chega como anexo).

### 13.2 Como funciona

- `InboxFolderWatcherService` (BackgroundService) faz polling
- Processa cada `.eml` → move para `processado/` ou `erro/`
- Retry: até 6 tentativas, delay 800ms

### 13.3 Configuração

```jsonc
{
  "InboxFolder": {
    "RootPath": "C:\\Projetos\\RHPortal\\Inbox",
    "IncomingFolderName": "incoming",
    "ProcessedFolderName": "processado",
    "ErrorFolderName": "erro",
    "RetryDelayMs": 800,
    "RetryCount": 6
  }
}
```

### 13.4 Status

⚠️ **Infra pronta, worker inativo** — falta o parser de `.eml` que dispara o workflow (criar candidato, importar CV anexo via IA).

---

## 14. CI/CD — Azure Pipelines

### 14.1 Trigger e stages

```yaml
trigger: develop

stages:
  - Build Next.js (pnpm install + next build → out/)
  - Compactação (tar.gz, exclui node_modules, .next, .git, CVs, logs)
  - Publish artifact em Azure Artifacts
```

### 14.2 Características

- Node 20 LTS
- pnpm workspaces (com fallback)
- Webpack forçado (garante static export)
- Verifica saída em `out/` ou `.next/export`

### 14.3 Status

✅ **Em produção** — pipeline rodando em todo push para `develop`.

---

## 15. Docker

### 15.1 Imagens (`docker-compose.yml`)

```yaml
api:      ECR/render-api:latest         :5000  /health
web-next: ECR/render-web-next:latest    :3000  /health
ai:       ECR/render-ai:latest          :8000  /health
```

Variáveis principais via `.env`: `AWS_ACCOUNT_ID`, `AWS_REGION`, `IMAGE_TAG`, connection strings, `OPENAI_API_KEY`, credenciais Entra ID.

### 15.2 Variantes

- `docker-compose.yml` — produção
- `docker-compose.qa.yml` — homologação

### 15.3 Status

✅ **Em produção** — deploy via ECR (AWS).

---

## 16. Sub-projetos auxiliares

### `__scripts__/`

| Subpasta | Função |
|---|---|
| `dev/` | Scripts de dev local (subir tudo, fix migrations, kill ports) |
| `totvs/` | Mocks TS de respostas TOTVS para QA |
| `totvs_to_success/` | Mocks Python de fluxo completo de admissão |
| (raiz) | `test-battery.sh` (testa 50+ endpoints), `apply-all-tenant-migrations.sh` |

### `scripts/`

Setup de pgvector para PostgreSQL Windows EDB e macOS (Homebrew).

### `knowledge-base/`

Documentação técnica de longo prazo:
- `visao-arquitetural.md` — diagrama de componentes
- `sidebar-blocos-e-abas.md` — mapa da UI
- `handoff-claude-code-2026-04-17.md` — notas de contexto entre sprints

### `__analise__/`

Extrações JSON do schema e dados RM (área, cargo, departamento, função, pessoa, unidade, vaga, funcionário) para análise offline sem precisar acessar o RM ao vivo.

### `backups/`

Dumps PostgreSQL de bancos de dev (`dev_render.dump`, `dev_render_liotecnica.dump`, `dev_render_master.dump`) para restore rápido em ambientes locais.

### `test-evidence/`

Evidências de teste (screenshots, gravações, exports CSV) anexas a casos de teste documentados.

---

## 17. Diagrama consolidado

```
                ┌─────────────────────────────────────────┐
                │ Microsoft Entra ID (Azure AD)            │
                │ ⇆ login OAuth2 por tenant               │
                └────────────────┬────────────────────────┘
                                 │
                                 ▼
        ┌───────────────────────────────────────────────┐
        │           RHPortal.Api (.NET 8/9)              │
        │  ┌─────────────────────────────────────────┐  │
        │  │ Controllers (~98) · Services (~65)      │  │
        │  └─────────────────────────────────────────┘  │
        └──┬───┬──────────┬─────────┬─────────┬────────┘
           │   │          │         │         │
           │   │          │         │         │
   ┌───────▼┐ ┌▼──────┐ ┌─▼────┐ ┌──▼────┐ ┌─▼─────────┐
   │ Postgres│ │RHPort.│ │AWS S3│ │ SMTP  │ │OpenAI/Gem.│
   │ + pgvec │ │.Ai    │ │      │ │WhatsAp│ │           │
   │ master+ │ │(Py)   │ │      │ │Blip   │ │           │
   │ tenants │ │ :8000 │ │      │ │       │ │           │
   └────▲────┘ └───────┘ └──────┘ └───────┘ └───────────┘
        │
        │
        │
   ┌────┴───────────────────────────────┐
   │ Liotecnica.Integration.RM (.NET)   │
   │ Worker BackgroundService :5min     │
   │ ⇆ TOTVS RM (SQL Server)            │
   │ ⇆ POST/PATCH RHPortal.Api          │
   └────┬───────────────────────────────┘
        │
        ▼
┌───────────────────┐
│  TOTVS RM         │
│  SQL Server       │
└───────────────────┘

   ┌─────────────────────────────────────┐
   │ Worker Datasul (não implementado)   │
   │ Faz polling /api/integracao-totvs   │
   │ Empurra movimentações ao Datasul    │
   └─────────────────────────────────────┘
```

---

## 18. Furos conhecidos / oportunidades de integração

| O que falta | Impacto |
|---|---|
| **Worker consumer Datasul** | Movimentações ficam pendentes no painel — RH precisa rodar manual |
| **Inbox watcher de e-mails** | Candidatos que mandam CV por e-mail não viram candidato automático |
| **WhatsApp em produção real** | Está em provider `Logging` — só loga, não envia |
| **Migrar secrets para Key Vault** | Hoje em `appsettings.json` (RM password, OpenAI key) |
| **Persistência de ranking incluindo Talentos** | `CandidatoVagaMatchingScores` só salva Candidatos — Talentos avaliados são jogados fora |
| **Healthcheck cross-service** | API .NET poderia checar `RHPortal.Ai` no startup |

---

**Fim do inventário de integrações. Atualizo conforme cada item evolui.**
