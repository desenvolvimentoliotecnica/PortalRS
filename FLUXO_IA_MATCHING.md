# Fluxo completo: Matching por IA (persistido)

Este documento descreve como o **matching por IA** está implementado de ponta a ponta: quando o score é calculado, onde é armazenado e como a tela de Matching obtém o ranking.

---

## 1. Visão geral

- **Não** calculamos o ranking na hora em que o usuário abre a tela de Matching.
- O score por IA é **calculado e salvo** quando:
  1. O candidato **se candidata** à vaga (portal público),
  2. O candidato **é atribuído** à vaga (RH cria/edita candidato com VagaId),
  3. Os **filtros de matching da vaga** são editados (recálculo em background para todos os candidatos da vaga).
- Na tela de Matching: **só leitura do banco** (tabela `CandidatoVagaMatchingScores`), sem chamar o RHPortal.Ai no momento do clique.

---

## 2. Componentes

| Componente | Função |
|------------|--------|
| **RHPortal.Ai** (Python, FastAPI, porta 8000) | Serviço de matching: lê vaga e candidatos no PostgreSQL, usa LLM (OpenAI) para avaliar critérios da vaga e retorna score 0–100. Endpoints: `POST /match` (lote), `POST /match-one` (um candidato). |
| **RHPortal.Api** (.NET) | API principal. Persiste scores em `CandidatoVagaMatchingScores`, chama RHPortal.Ai quando há candidatura/atribuição/edição de filtros, e na rota de Matching lê só do banco. |
| **LioTecnica.Web** | Frontend. Chama `GET .../matching-candidates?useAi=true`; a API devolve o ranking já calculado (do banco). |
| **Liotecnica.Integration.RM** (.NET) | Worker de integração RM ↔ Portal (sync de vagas, candidatos, etc.). Opcional para o fluxo de IA; pode ser rodado em paralelo no dev. |

---

## 3. Fluxo detalhado

### 3.1 Candidatura (portal público)

1. Usuário envia candidatura (formulário público).
2. **PublicCandidaturasController** salva/atualiza o candidato e chama `CalculateAndStoreAsync` (matching por keywords).
3. Em seguida (best-effort): chama **RHPortal.Ai** `POST /match-one` com `vaga_id` e `candidato_id`.
4. RHPortal.Ai: busca vaga (`get_vaga_perfil`), candidato (`get_candidato_perfil`), executa `run_matching(vaga, [candidato], algorithm="filters", limit=1)` e retorna `similaridade` 0–100.
5. Se a API receber resposta válida, chama **SaveAiScoreAsync(candidatoId, vagaId, score)** → upsert em `CandidatoVagaMatchingScores`.

### 3.2 RH atribui candidato à vaga

1. RH cria ou edita candidato informando **VagaId**.
2. **CandidatoService** (CreateAsync/UpdateAsync) após `CalculateAndStoreAsync` chama **GetScoreForOneAsync** (RHPortal.Ai `POST /match-one`) e, se houver retorno, **SaveAiScoreAsync**.

### 3.3 Edição dos filtros de matching da vaga

1. RH faz **PATCH** em `.../vagas/{id}/matching-filtros`.
2. **VagasController** persiste os filtros e dispara em **background** `RecalcMatchingScoresInBackgroundAsync(vagaId, tenantId)`.
3. Em background: novo scope → **GetMatchingByFiltersAsync** (RHPortal.Ai `POST /match`) para a vaga (até 500 candidatos) → **ReplaceScoresForVagaAsync**: remove todos os scores da vaga e insere os novos retornados pela IA.
4. A resposta do PATCH retorna imediatamente (não espera o recálculo).

### 3.4 Usuário abre a tela de Matching

1. Frontend chama **GET** `.../vagas/{id}/matching-candidates?useAi=true&minScore=0&take=50`.
2. **VagasController.GetMatchingCandidates**: se `useAi=true`, chama **GetRankingByVagaFromStoreAsync** (consulta `CandidatoVagaMatchingScores` + join em Candidatos, ordenado por Score desc) e retorna a lista. **Não** chama RHPortal.Ai.
3. Se `useAi=false`, usa o ranking por keywords (IMatchingService.GetCandidatesWithScoresAsync).

---

## 4. RHPortal.Ai (Python) – resumo técnico

- **Banco**: PostgreSQL (mesmo do RHPortal); tabelas `Vagas`, `VagaRequisitos`, `Candidatos`, `CandidatoCompetencias`. Configuração via `DATABASE_URL` no `.env`.
- **Matching por filtros** (`algorithm="filters"`):  
  - Parse de `MatchingFiltrosRaw` da vaga em critérios.  
  - Para cada candidato: prompt ao LLM (OpenAI, ex.: gpt-4o-mini) com critérios e perfil do candidato; resposta SIM/NÃO por critério.  
  - Score = (critérios atendidos / total) × 100; candidatos com 0 são excluídos.
- **Endpoints**:
  - `GET /health` – saúde do serviço.
  - `POST /match` – body: `{ "vaga_id", "tenant_id?", "limit?" }` → retorna lista de candidatos com `similaridade`.
  - `POST /match-one` – body: `{ "vaga_id", "candidato_id", "tenant_id?" }` → retorna um item com `candidato_id`, `nome`, `email`, `similaridade`.

---

## 5. Banco de dados (RHPortal.Api)

- **Tabela** `CandidatoVagaMatchingScores`:  
  - `CandidatoId`, `VagaId` (PK composta), `Score` (0–100), `CalculatedAtUtc`, `TenantId`.  
  - Índice em `(VagaId, Score DESC)` para a consulta do ranking.
- Migration: `20260210180000_AddCandidatoVagaMatchingScore.cs`.

---

## 6. Como rodar o projeto Python (RHPortal.Ai)

O erro `ModuleNotFoundError: No module named 'app'` ocorre quando se executa `python main.py` **dentro** da pasta `app/`. O Python precisa do diretório raiz do projeto no path para resolver o módulo `app`.

**Sempre executar a partir da raiz do projeto RHPortal.Ai:**

```bash
cd Voltage.RenderRH/RHPortal.Ai
# Ativar o venv (Windows Git Bash / PowerShell):
source .venv/Scripts/activate
# Windows CMD:
# .venv\Scripts\activate.bat

# Executar (obrigatório usar -m para carregar o pacote app):
python -m app.main
```

Alternativa com uvicorn:

```bash
cd Voltage.RenderRH/RHPortal.Ai
source .venv/Scripts/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Health: **GET** http://localhost:8000/health  
- Porta e host podem vir do `.env` (`HOST`, `PORT`) ou de `Liotecnica.Integration.RM/appsettings.Development.json` (seção `AiService`).

---

## 7. Scripts de desenvolvimento (dev-all.sh)

O script `__scripts__/dev/dev-all.sh` sobe em um único terminal:

- **API** (RHPortal.Api) – background  
- **Portal** (LioTecnica.Web) – foreground  
- **RHPortal.Ai** (Python) – background  
- **Liotecnica.Integration.RM** (worker) – background  

Assim você tem API, Portal, IA e Integração rodando juntos. Ver seção 9 para como rodar cada parte manualmente e como testar.

---

## 8. Testes manuais sugeridos

### 8.1 Health do RHPortal.Ai

```bash
curl -s http://localhost:8000/health
# Esperado: {"status":"ok","service":"rhportal-ai"}
```

### 8.2 POST /match-one (um candidato)

Substitua `VAGA_UUID`, `CANDIDATO_UUID` e, se necessário, `tenant_id`:

```bash
curl -s -X POST http://localhost:8000/match-one \
  -H "Content-Type: application/json" \
  -d '{"vaga_id":"VAGA_UUID","candidato_id":"CANDIDATO_UUID","tenant_id":"SEU_TENANT"}'
```

Esperado: JSON com `candidato_id`, `nome`, `email`, `similaridade` (0–100).

### 8.3 POST /match (lote)

```bash
curl -s -X POST http://localhost:8000/match \
  -H "Content-Type: application/json" \
  -d '{"vaga_id":"VAGA_UUID","tenant_id":"SEU_TENANT","limit":10}'
```

Esperado: `matching` com lista de candidatos e `similaridade`.

### 8.4 GET matching-candidates (API .NET, lendo do banco)

Com a API rodando (porta 5056) e header de tenant/autenticação configurados:

```bash
curl -s "http://localhost:5056/api/vagas/VAGA_ID/matching-candidates?useAi=true&take=20"
```

Esperado: lista de candidatos com `score` (dados vindos de `CandidatoVagaMatchingScores`). Se não houver scores persistidos para a vaga, a lista pode vir vazia.

### 8.5 Fluxo completo (resumo)

1. Garantir que a vaga tenha **MatchingFiltrosRaw** preenchido (senão o RHPortal.Ai retorna 400 em `/match-one`).  
2. Candidatar-se à vaga pelo portal **ou** criar/editar candidato com essa vaga no RH.  
3. (Opcional) Verificar na tabela `CandidatoVagaMatchingScores` se foi inserido/atualizado o registro para (CandidatoId, VagaId).  
4. Abrir a tela de Matching da vaga no frontend (ou chamar `GET .../matching-candidates?useAi=true`) e conferir se o candidato aparece com score.

---

## 9. Ordem recomendada para subir os projetos

1. **PostgreSQL** em execução com o banco do tenant.  
2. **RHPortal.Api** (para persistir scores e servir o frontend).  
3. **RHPortal.Ai** (para calcular scores em candidatura/atribuição/recálculo).  
4. **LioTecnica.Web** (portal).  
5. (Opcional) **Liotecnica.Integration.RM** (sync RM ↔ Portal).

Usando os scripts:

- Tudo de uma vez: `./__scripts__/dev/dev-all.sh` (a partir da raiz do repositório, onde está `Voltage.RenderRH`).  
- Só API + Portal: comentar ou não chamar as linhas do AI e da Integração no `dev-all.sh`, ou rodar apenas `dev-api.sh` e `dev-portal.sh`.  
- Só Python: na raiz do repositório, `cd Voltage.RenderRH/RHPortal.Ai && source .venv/Scripts/activate && python -m app.main`.

Com isso, o processo de IA fica documentado, previsível e testável de ponta a ponta.
