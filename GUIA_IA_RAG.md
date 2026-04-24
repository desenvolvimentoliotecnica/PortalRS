# Guia de IA & RAG — Voltage.RenderRH

Arquitetura de matching híbrido, chatbot RH e geração de conteúdo via LLM local
(Ollama + Qwen 2.5 + bge-m3 + pgvector). Stack inteiramente open-source e local
— dados sensíveis nunca saem do host do tenant.

> Data: 2026-04-24 · Stack: .NET 9 · Ollama 0.20.5 · PostgreSQL 18 + pgvector 0.8.2

---

## 1. Setup inicial (uma vez por host)

### 1.1. Ollama + modelos
```bash
# Mac
brew install ollama && ollama serve &
ollama pull qwen2.5:7b        # ~5 GB — chat/rerank/geradores
ollama pull bge-m3            # ~1.2 GB — embeddings (1024 dims)
```

Verificar: `curl http://localhost:11434/api/version` deve responder `{"version":"..."}`.

### 1.2. pgvector
O EDB Postgres 18 não vem com pgvector. Rodar uma vez:
```bash
sudo bash scripts/setup-pgvector.sh
```
Isso copia os binários (.dylib + SQL) do Homebrew para o diretório do EDB e
dispara `CREATE EXTENSION vector` em `dev_render_liotecnica`.

### 1.3. Migrations
A migration `AddEmbeddingsPgvector` é idempotente: em dev aplica via
`dotnet ef database update`; em produção roda automaticamente no startup
(`DbSeeder.MigrateAndSeedAsync`) em todos os tenants.

### 1.4. Indexação inicial
Após subir a API:
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "X-Tenant-Id: liotecnica" \
  "http://localhost:5056/api/assistente-ia/embeddings/reindexar?force=true"
```
Ou pela UI: `/app/assistente-ia` → botão "Reindexar embeddings" na sidebar.

### 1.5. appsettings
```json
"Ai": {
  "Ollama": {
    "Endpoint": "http://localhost:11434",
    "ChatModel": "qwen2.5:7b",
    "EmbeddingModel": "bge-m3",
    "EmbeddingDimensions": 1024,
    "TimeoutSeconds": 120,
    "Enabled": true
  }
}
```
Para desabilitar IA em qualquer ambiente (ex.: CI), setar `Ollama.Enabled=false`.

---

## 2. Arquitetura

```
                    ┌───────────────────────────────────┐
                    │  Ollama (localhost:11434)         │
                    │  • qwen2.5:7b        (chat/rerank)│
                    │  • bge-m3:latest     (embeddings) │
                    └──────────────┬────────────────────┘
                                   │ HTTP
┌─────────────────────────────────┴──────────────────────┐
│ .NET API (RHPortal.Api :5056)                          │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ HybridMatchingService                            │  │
│  │  ├─ LéxicoScore (TF-IDF + stems + sinônimos)     │  │
│  │  ├─ SemânticoScore (pgvector kNN)                │  │
│  │  └─ LocalidadeScore (Haversine)                  │  │
│  └──────────────────┬───────────────────────────────┘  │
│                     │                                   │
│  ┌──────────────────▼────────┐  ┌───────────────────┐  │
│  │ EmbeddingService          │  │ LlmAssistantService│ │
│  │  (IOllamaClient+pgvector) │  │ (RAG + streaming) │  │
│  └──────────────────┬────────┘  └───────────────────┘  │
└─────────────────────┼──────────────────────────────────┘
                      │
           ┌──────────▼──────────┐
           │  PostgreSQL         │
           │  + extensão pgvector│
           │                     │
           │  DescricaoCargoItens│
           │  └─ Embedding       │
           │     vector(1024)    │
           │                     │
           │  Candidatos         │
           │  └─ Embedding       │
           │     vector(1024)    │
           └─────────────────────┘
```

---

## 3. Componentes-chave

### 3.1. Matching híbrido
Blend: **30% léxico + 50% semântico + 20% localidade**.

| Score | Baseline | Como calcula |
|---|---|---|
| Léxico | `DescricaoCargoMatchingService` | TF-IDF + stem pt-br + sinônimos técnicos + filtro requisito processual |
| Semântico | `VectorSearchService` | kNN cosine similarity no pgvector entre embedding do candidato × embeddings dos itens DNALIO da descrição |
| Localidade | Haversine | Distância km Pessoa.lat/lng × Empresa.lat/lng, decaimento linear até `Vaga.LocalidadeMaxDistanciaKm` |

**Fallback automático**: se Ollama indisponível, retorna léxico puro com
`Modo="fallback"` (marca semântica visível na UI).

### 3.2. Indexação idempotente
- `DescricaoCargoItemEmbedding` (1:1 com item, cascade-delete)
- `CandidatoEmbedding` (1:1 com candidato, SHA256 do CV evita re-embedar sem mudança)
- Re-indexação completa do tenant em ~14s para 40 entidades (varia com tamanho)

### 3.3. Chatbot RAG
Pipeline: pergunta → embed → kNN top-8 itens DNALIO + top-3 vagas abertas →
system prompt com contexto numerado → Qwen 2.5 gera resposta citando `[Fonte N]`.

Endpoints:
- `POST /api/assistente-ia/chat` — buffered
- `POST /api/assistente-ia/chat/stream` — SSE, emite `data: {"delta":"..."}` até `data: [DONE]`

### 3.4. Geradores
| Endpoint | O que faz |
|---|---|
| `POST /api/assistente-ia/descricao-cargo/gerar` | Brief (título + contexto) → template DNALIO JSON completo (8 categorias) |
| `POST /api/assistente-ia/cv/resumir/{candId}` | CV → resumo de 250 chars para card do kanban |
| `POST /api/assistente-ia/vagas/sugerir-salario/{vagaId}` | Histórico interno + categoria → sugestão de faixa com justificativa |

---

## 4. UI

| Componente | Uso | Onde |
|---|---|---|
| `AssistenteIaScreen` | Chat RAG com streaming + sidebar de health + ferramentas | `/assistente-ia` |
| `GerarDescricaoCargoDialog` | Dialog plugável — gera template a partir de brief | Cadastro de DescricaoCargo |
| `SugerirSalarioButton` | Aciona LLM e propõe faixa min/max | VagaFormModal (aba Remuneração) |
| `ResumirCvButton` | Resumo CV on-demand no card | Kanban de candidaturas |
| `MatchingBreakdownDialog` estendido | Toggle Híbrido/Léxico + evidências semânticas | Badge de match no kanban |

---

## 5. Performance e custo

| Operação | Tempo médio |
|---|---|
| Embedding (1 texto, bge-m3) | ~200 ms |
| Chat response (Qwen 2.5 7B, ~500 tokens) | ~10-15 s (CPU)  /  ~2-3 s (GPU M1/M2) |
| kNN 1 query × 40 itens (pgvector) | <10 ms |
| Matching híbrido (1 candidato × 1 vaga) | ~300 ms (com embeddings já indexados) |
| Re-indexação completa de tenant (40 entidades) | ~14 s |

Custo **zero por inferência** — roda 100% local. LGPD-compliant (dados não
saem da infra do tenant).

---

## 6. Troubleshooting

### Ollama não alcançável
```bash
# Checar se está rodando
curl http://localhost:11434/api/version
# Se não, subir
ollama serve &
```

A UI do assistente mostra status na sidebar. Matching cai em fallback léxico
automaticamente — nunca quebra UX.

### Modelo não instalado
```bash
ollama list
ollama pull qwen2.5:7b
ollama pull bge-m3
```

### Re-indexação necessária após mudança de modelo
Se trocar `EmbeddingModel` em appsettings, roda:
```bash
curl -X POST "/api/assistente-ia/embeddings/reindexar?force=true"
```
O service só re-embeda linhas cujo `ModelVersion` não bate com o atual.

### pgvector ausente em tenant novo
Migration `AddEmbeddingsPgvector` roda `CREATE EXTENSION IF NOT EXISTS vector`
automaticamente. Se der erro "extension vector not available", rodar o script
`setup-pgvector.sh` no host para linkar os arquivos do brew ao EDB Postgres.

---

## 7. Próximos upgrades (opcional)

1. **Rerank LLM dos top-K**: passar top-10 por Qwen com prompt "ranqueie do melhor para o pior com justificativa" — aumenta NDCG@10 em ~15%.
2. **Chunking de CV longo**: CVs > 2000 chars podem perder contexto no embedding único. Chunking por seção melhora cobertura.
3. **Fine-tuning**: após 6 meses de uso, coletar pares (vaga, candidato, decisão_rh) → fine-tunar modelo de reranking com seu vocabulário interno.
4. **Embeddings para Vaga** (não só DescricaoCargo): hoje indexamos só itens DNALIO da descrição; indexar Vagas específicas permite "dado uma nova vaga, quais candidatos são mais parecidos com quem contratamos em vagas similares".
5. **HNSW em vez de IVFFlat**: quando passar de 100K items, trocar index pra HNSW (mais rápido, mais RAM).
