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

## 🔬 Pesquisa / spikes futuros (sem prioridade ainda)

### LUC-100 — Avaliar substituir gpt-4o-mini por modelo open via Ollama
- **Tipo:** spike
- **Razão:** custo + LGPD para tenants com requisitos rígidos
- **Comparar:** qwen2.5:7b, llama3.1:8b vs gpt-4o-mini em qualidade de scoring

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
