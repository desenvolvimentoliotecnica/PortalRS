# lucas — Runbook operacional de IA

> **Autor:** Lucas Machado · **Branch:** `devops_Lucas` · **Data inicial:** 2026-04-26
> Como diagnosticar, rotacionar e mudar a configuração de IA do RenderRH em produção sem causar downtime. Arquivo vivo — atualizar quando mudar a estrutura.

---

## 0. Visão de 30 segundos

A IA é controlada em **3 níveis**:

| Nível | Quem | O quê | Onde |
|---|---|---|---|
| **L1 — Comercial** | Owner | Liga/desliga IA por tenant (módulo `ai`) | `Master.TenantModules` · UI `/Owner/Tenants/[id]/modules` |
| **L2 — Provedores** | Owner | Quais provedores têm chave (OpenAI, Gemini, Anthropic, Ollama) | `Master.AiProviderKeys` (encrypted) · UI `/Owner/IA` |
| **L3 — Escolha** | Admin do tenant | Qual provider/modelo este tenant usa | `AppDb.TenantConfiguracoes` · UI `/app/admin/ia` |

**Toda chamada IA passa por:** `UnifiedAiService.InvokeWithOutcomeAsync` → checa L1 → resolve L2+L3 → chama provider → grava `AiUsageRecord`.

---

## 1. Sintomas mais comuns e como diagnosticar

### 1.1 "A IA parou de responder em todos os tenants"

```bash
# 1. RHPortal.Ai (Python) está no ar?
curl -s http://localhost:8000/health/ready

# Esperado:
# {"status":"ok","db":"ok","llm_provider":"...","embedding_provider":"...","gemini_key":"ok"}
# Se 503: provider key faltando ou DB caiu.

# 2. API .NET está no ar?
curl -s http://localhost:5056/health
# Esperado: status Healthy.

# 3. Qual provider está sendo usado AGORA?
curl -s http://localhost:8000/health/ready | jq '.llm_provider, .embedding_provider'

# 4. Tem chave configurada?
grep -E "OPENAI_API_KEY|GEMINI_API_KEY" /Users/.../RHPortal.Ai/.env
grep -A2 '"Ai"' /Users/.../RHPortal.Api/RHPortal.Api/appsettings.Development.json | head
```

**Causas comuns:**
- Chave expirou/foi revogada → rotacionar (§3)
- Cota ultrapassada no provider → checar dashboard do provider, trocar para outro (§4)
- Ollama parou (se for o provider escolhido) → `pgrep -fl ollama`; reiniciar `ollama serve`

### 1.2 "Cliente X reclama que a IA não funciona, mas Y está OK"

Provavelmente o tenant X tem o módulo `ai` desligado. Verificar:

```sql
-- Master DB
SELECT "TenantId", "ModuleKey", "IsEnabled", "UpdatedAtUtc"
FROM "TenantModules"
WHERE "TenantId" = 'cliente-x' AND "ModuleKey" = 'ai';
```

Se `IsEnabled = false` → ligar via UI Owner OU SQL:
```sql
UPDATE "TenantModules" SET "IsEnabled" = true, "UpdatedAtUtc" = NOW()
WHERE "TenantId" = 'cliente-x' AND "ModuleKey" = 'ai';
```

A próxima chamada IA passa imediatamente (sem restart).

### 1.3 "Frontend mostra 503 — IA desabilitada"

A partir da Fase 5, o `AiController` retorna `503 Service Unavailable` com `ProblemDetails.Extensions.reason`. Lê o `reason` para saber o que arrumar:

| `reason` | O que fazer |
|---|---|
| `ModuleDisabled` | Owner liga o módulo `ai` para esse tenant |
| `NoProviderConfigured` | Owner cadastra chave em `/Owner/IA` (ou preenche `appsettings.Ai.{Provider}.ApiKey`) |
| `ProviderResolutionFailed` | Tenant escolheu provider com nome inválido — `UPDATE "TenantConfiguracoes" SET "LlmProvider" = NULL WHERE "TenantId" = '...';` |

### 1.4 "Matching IA está retornando score 0 para todos os candidatos"

Não passa pelo `UnifiedAiService` — o pipeline é Python (`unified_matching.py`). Diagnóstico:

```bash
# 1. Vaga tem embedding?
PGPASSWORD='...' psql -h ... -d dev_render_<tenant> -tAc \
  "SELECT \"Id\", embedding IS NOT NULL FROM \"Vagas\" WHERE \"Id\" = '<vaga-uuid>';"

# 2. Há embeddings de candidatos?
PGPASSWORD='...' psql -h ... -d dev_render_<tenant> -tAc \
  "SELECT COUNT(*) FROM \"CandidatoEmbeddings\";"

# 3. Logs do Python:
tail -100 /tmp/renderrh-logs/ai.log | grep -E "matching|error|provider"

# 4. Forçar reindex (síncrono, demora):
curl -X POST http://localhost:5056/api/assistente-ia/embeddings/reindexar?force=true \
  -H "X-Tenant-Id: <tenant>" -H "Authorization: Bearer <admin-jwt>"
```

Causa frequente: o tenant está com `EmbeddingProvider=gemini` (3072 dims) mas a coluna `embedding` é `vector(1024)` — **LUC-115 no backlog**.

### 1.5 "Matching demora 60s ou mais"

```bash
# Olhar no log do Python:
grep "matching_done" /tmp/renderrh-logs/ai.log | tail -5
# Cada linha tem elapsed_s — ver qual fase está lenta.

# Causas comuns:
# - LLM batch eval em CPU (Ollama qwen2.5:7b → ~15-30s por batch de 6)
# - Cold start do modelo Ollama (~30-60s na primeira chamada)
# - Provider externo lento (OpenAI/Gemini geralmente ~8-15s)
```

Mitigação rápida: reduzir `DEFAULT_RANKING_SIZE` no `.env` do Python, ou aumentar `BATCH_SIZE` (mais candidatos por chamada LLM).

---

## 2. Métricas e observabilidade

### 2.1 Endpoint de métricas do tenant

```http
GET /api/admin/ai/metrics?days=30
Authorization: Bearer <admin jwt>
X-Tenant-Id: <tenant>
```

Retorna:
- `totalCalls`, `totalCostUsd` no período
- Breakdown `byModule` (CV extract, descrição cargo, etc.)
- Breakdown `byModel` (gpt-4o-mini, gemini-2.5-flash, etc.)
- Série diária `byDay` para gráfico

### 2.2 Métricas cross-tenant (Owner)

```http
GET /api/owner/ai/usage/summary-by-tenant?from=...&to=...
GET /api/owner/ai/usage/summary-by-user?from=...&to=...
GET /api/owner/ai/usage/detail?page=1&pageSize=50
```

Já existem desde a Fase 2 — UI em `/Owner/IA → aba Dashboard`.

### 2.3 Logs estruturados

Cada chamada IA emite (Fase 5):

```text
ai.invoke tenant=liotecnica user=admin@dev.local provider=Gemini model=gemini-2.5-flash
          module=cv-extract latency_ms=1247 cost_usd=0.00001500 from_config=True content_len=512
```

Quando bloqueado:

```text
ai.invoke tenant=cliente-x status=blocked reason=ModuleDisabled module=cv-extract
ai.invoke tenant=cliente-y status=blocked reason=NoProviderConfigured module=descricao-cargo known=OpenAI,Gemini
```

Buscar no log:
```bash
grep "^.*ai\.invoke" /tmp/renderrh-logs/api.log | tail -20
grep "status=blocked" /tmp/renderrh-logs/api.log | wc -l
```

---

## 3. Rotação de chave sem downtime

### Cenário: chave Gemini foi exposta, precisa trocar AGORA.

**Estratégia: cadastrar a nova chave ANTES de revogar a antiga.**

```bash
# 1. Login como owner
TOKEN=$(curl -s -X POST http://renderrh/api/owner/auth/login \
  -d '{"email":"...","password":"..."}' | jq -r .accessToken)

# 2. Cadastrar a NOVA chave Gemini (mantendo a antiga ainda ativa)
curl -X POST http://renderrh/api/owner/ai/keys \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "provider": "Gemini",
    "name": "Gemini prod (rotacionada 2026-04-26)",
    "key": "AIzaSy<NEW>",
    "isDefault": true
  }'

# 3. Marcar a antiga como inativa (UI ou API)
curl -X PUT http://renderrh/api/owner/ai/keys/<old-id> \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"...","isActive":false,"isDefault":false,"key":null}'

# 4. Próxima chamada já usa a nova chave (UnifiedAiService busca IsDefault=true primeiro,
#    depois ordena por CreatedAtUtc — não precisa restart)

# 5. Revogar a antiga no Google AI Studio: https://aistudio.google.com/apikey

# 6. Conferir nas métricas que tudo voltou ao normal
curl -H "Authorization: Bearer $TOKEN" http://renderrh/api/owner/ai/usage/detail?page=1
```

**Cuidado:** nunca delete a chave antiga ANTES de cadastrar a nova — janela de zero downtime exige sobreposição.

---

## 4. Mudar provider em produção

### Cenário: cliente Acme quer migrar de OpenAI para Gemini.

```bash
# Pré-requisito: chave Gemini já cadastrada (Owner /Owner/IA)

# 1. Admin do tenant Acme abre /app/admin/ia
# 2. Provider de LLM = "Google Gemini", Modelo = "gemini-2.5-flash"
#    Provider de Embeddings = "Google Gemini" (cuidado: ver §5 sobre dims)
# 3. Salvar
# 4. Próxima chamada IA já usa Gemini.

# Equivalente via SQL (no banco do tenant):
PGPASSWORD='...' psql -h ... -d dev_render_acme -c \
  "UPDATE \"TenantConfiguracoes\"
   SET \"LlmProvider\" = 'gemini',
       \"LlmModel\" = 'gemini-2.5-flash',
       \"EmbeddingProvider\" = 'gemini',
       \"EmbeddingModel\" = 'models/gemini-embedding-001',
       \"UpdatedAtUtc\" = NOW();"

# Validar:
curl -H "X-Tenant-Id: acme" -H "Authorization: Bearer <admin>" \
  http://renderrh/api/tenant-configuracao/ai | jq .effectiveLlmProvider
# → "gemini"
```

**Cuidado:** mudar provider de embeddings invalida embeddings antigos (dimensões diferentes). Reindexar via:
```http
POST /api/assistente-ia/embeddings/reindexar?force=true
```

---

## 5. Pegadinhas conhecidas

### 5.1 Embedding dimensions mismatch (LUC-115 ⚠️)

A coluna `Embedding` em `CandidatoEmbeddings` e `DescricaoCargoItemEmbeddings` é `vector(1024)` (dimensão de Ollama bge-m3). Trocar para:
- OpenAI `text-embedding-3-small` (1536) → INSERT falha
- OpenAI `text-embedding-3-large` (3072) → INSERT falha
- Gemini `gemini-embedding-001` (3072) → INSERT falha

Por enquanto, **só Ollama bge-m3 funciona em produção real** para o caminho `EmbeddingService` (.NET, indexer). O caminho Python `embeddings.py` espera colunas inline `Vagas.embedding vector(1536)` que **não existem no schema atual**. Item LUC-115 detalha as 3 opções de resolução.

### 5.2 Tenant escolhe provider sem chave (LUC-116 ⚠️)

Se admin do tenant escolhe `LlmProvider=anthropic` mas não há chave Anthropic em lugar nenhum, hoje cai silenciosamente em outro provider que tenha chave. UI mostra "effective" diferente do escolhido. **Próxima sprint torna estrito.**

### 5.3 Migration corrompida

Migration `20260411055438_AddUnidadeLotacaoHierarchyV2` foi gerada com schema completo por engano. Em bancos novos, aplicar `bash __scripts__/dev/fix-broken-migrations.sh` se a API quebrar com "relação X já existe".

### 5.4 Token JWT expira em 24h

Default em dev. Prod: aumentar `Jwt:AccessTokenExpirationMinutes` no appsettings ou implementar refresh-token (já existe `POST /api/auth/refresh-token`).

---

## 6. Comandos úteis (cola rápida)

```bash
# Reiniciar tudo (sequencial)
bash __scripts__/dev/kill-ports.sh
bash __scripts__/dev/dev-all.sh

# Provider ativo no Python
curl -s http://localhost:8000/health/ready | jq

# Provider ativo + status do tenant
curl -s -H "X-Tenant-Id: $T" -H "Authorization: Bearer $JWT" \
  http://localhost:5056/api/tenant-configuracao/ai | jq

# Métricas IA do tenant (últimos 7 dias)
curl -s -H "X-Tenant-Id: $T" -H "Authorization: Bearer $JWT" \
  "http://localhost:5056/api/admin/ai/metrics?days=7" | jq

# Forçar reindex de embeddings
curl -X POST -H "X-Tenant-Id: $T" -H "Authorization: Bearer $JWT" \
  "http://localhost:5056/api/assistente-ia/embeddings/reindexar?force=true"

# Logs estruturados de IA
grep "ai\.invoke" /tmp/renderrh-logs/api.log | tail -20

# Quantos blocks por motivo (últimos 1000 chamados)
grep "status=blocked" /tmp/renderrh-logs/api.log | tail -1000 | \
  awk '{for(i=1;i<=NF;i++) if($i ~ /^reason=/) print $i}' | sort | uniq -c
```

---

## 7. Quem reclama de quê — escalação

| Quem reclama | Provavelmente é | Quem resolve |
|---|---|---|
| Recrutador: matching demora muito | Cold start Ollama / batch grande | Dev (ajustar `DEFAULT_RANKING_SIZE`) |
| Admin tenant: "IA não funciona" | Módulo `ai` desligado OU sem provider | Owner / Suporte |
| Owner: custo OpenAI estourou | Falta rate limit por tenant | Dev (Fase 6+) |
| Recrutador: scores parecem errados | LLM scoring com modelo fraco | Admin (mudar para `gemini-2.5-pro` ou `gpt-4o`) |
| Compliance: "dados saindo do país" | Usar Ollama local | Owner cadastra chave Ollama, admin escolhe |

---

**Atualizar este runbook sempre que descobrir algo novo. A próxima pessoa não tem o contexto que você tem agora.**
