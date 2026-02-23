# Testes: Matching por IA (candidatura, atribuição, ranking)

Este documento descreve como testar o fluxo de **candidatura**, **atribuição de candidato à vaga** e **geração de ranking** (persistência e leitura do score por IA).

---

## 1. Testes unitários (CandidatoVagaMatchingScoreService)

Os testes cobrem:

- **SaveAiScoreAsync**: insere novo score; atualiza score existente.
- **GetRankingByVagaFromStoreAsync**: retorna ranking ordenado por score (desc); respeita `minScore` e `take`.
- **ReplaceScoresForVagaAsync**: remove scores antigos da vaga e insere os novos (recálculo em lote).

### Rodar os testes

Na pasta da solução da API:

```bash
cd Voltage.RenderRH/RHPortal.Api
dotnet test RHPortal.Api.Tests/RHPortal.Api.Tests.csproj
```

Ou no Visual Studio / Cursor: **Test Explorer** → Run All, ou clique com o botão direito no projeto **RHPortal.Api.Tests** → Run Tests.

---

## 2. Teste manual: fluxo completo

Pré-requisitos: **API** (5056), **RHPortal.Ai** (8000) e **Portal** (5051) rodando; banco com pelo menos uma **vaga** que tenha **MatchingFiltrosRaw** preenchido (senão o `/match-one` retorna 400).

### 2.1 Candidatura (portal público)

Ao se candidatar, a API chama o RHPortal.Ai (`POST /match-one`) e persiste o score em `CandidatoVagaMatchingScores`.

**Opção A – Pela interface**

1. Acesse o portal de vagas (ex.: `http://localhost:5051`).
2. Escolha uma vaga e preencha o formulário de candidatura (nome, e-mail, etc.).
3. Envie. O score é calculado em background e salvo.

**Opção B – cURL (API pública)**

Substitua `VAGA_ID` por um GUID de vaga válida (com `MatchingFiltrosRaw` preenchido). O tenant da API deve estar configurado (ex.: header `X-Tenant-Id: liotecnica` se a API usar).

```bash
curl -X POST "http://localhost:5056/api/public/candidaturas" \
  -H "X-Tenant-Id: liotecnica" \
  -F "VagaId=VAGA_ID" \
  -F "Nome=Teste Ranking" \
  -F "Email=teste.ranking@example.com" \
  -F "Fone=11999999999" \
  -F "CidadeUf=São Paulo - SP"
```

Depois de enviar, confira no banco se foi criado/atualizado um registro em `CandidatoVagaMatchingScores` para esse candidato e vaga.

### 2.2 Atribuição de candidato à vaga (RH)

Quando o RH cria ou edita um candidato informando **VagaId**, a API chama o RHPortal.Ai e persiste o score.

1. Faça login no portal (RH).
2. Vá em Candidatos → criar novo ou editar existente.
3. Selecione uma **Vaga** e salve.
4. O score é calculado e gravado em `CandidatoVagaMatchingScores`.

Para testar via API (precisa de autenticação e tenant):

- **POST** `/api/candidatos` com body contendo `vagaId` (e demais campos obrigatórios).
- Ou **PUT** `/api/candidatos/{id}` com `vagaId` preenchido.

### 2.3 Consultar ranking (leitura do banco)

Com `useAi=true`, o endpoint **não** chama o RHPortal.Ai; lê apenas os scores já salvos.

```bash
# Substitua VAGA_ID e use o header de tenant/autenticação que a API exige
curl -s "http://localhost:5056/api/vagas/VAGA_ID/matching-candidates?useAi=true&take=20" \
  -H "X-Tenant-Id: liotecnica"
```

Resposta esperada: lista de candidatos com `candidatoId`, `nome`, `email`, `score`, `pass`, `lastMatchAtUtc`, ordenados por **score** (maior primeiro).

---

## 3. Dados mockados para ver o ranking na tela

Se quiser **ver o ranking na interface** sem depender da IA (por exemplo, para validar a tela de Matching), você pode inserir scores direto no banco. Use **IDs reais** de candidatos e da vaga do seu ambiente.

### 3.1 Obter IDs no banco

No PostgreSQL:

```sql
-- Uma vaga (com MatchingFiltrosRaw preenchido)
SELECT "Id", "Titulo", "MatchingFiltrosRaw" IS NOT NULL AND "MatchingFiltrosRaw" != '' AS tem_filtros
FROM "Vagas"
WHERE "TenantId" = 'liotecnica'
LIMIT 5;

-- Candidatos vinculados a uma vaga (ou qualquer candidato do tenant)
SELECT "Id", "Nome", "Email", "VagaId"
FROM "Candidatos"
WHERE "TenantId" = 'liotecnica'
LIMIT 10;
```

Anote um `VagaId` e vários `CandidatoId` (e o `TenantId`, em geral `liotecnica`).

### 3.2 Inserir scores mockados

Substitua os UUIDs e o tenant pelos que você anotou. Os scores abaixo são só exemplos (0–100).

```sql
-- Exemplo: 3 candidatos com scores diferentes para a mesma vaga
-- Troque os GUIDs pelos do seu banco
INSERT INTO "CandidatoVagaMatchingScores" ("CandidatoId", "VagaId", "Score", "CalculatedAtUtc", "TenantId")
VALUES
  ('CANDIDATO_ID_1', 'VAGA_ID', 92, NOW() AT TIME ZONE 'UTC', 'liotecnica'),
  ('CANDIDATO_ID_2', 'VAGA_ID', 78, NOW() AT TIME ZONE 'UTC', 'liotecnica'),
  ('CANDIDATO_ID_3', 'VAGA_ID', 65, NOW() AT TIME ZONE 'UTC', 'liotecnica')
ON CONFLICT ("CandidatoId", "VagaId")
DO UPDATE SET "Score" = EXCLUDED."Score", "CalculatedAtUtc" = EXCLUDED."CalculatedAtUtc";
```

### 3.3 Conferir na tela

1. Abra a vaga no portal (RH) e vá na aba/tela de **Matching**.
2. Use a opção de ranking por **IA** (ou o equivalente que chama `matching-candidates?useAi=true`).
3. A lista deve aparecer ordenada por score (92, 78, 65) com os nomes/emails dos candidatos.

---

## 4. Testar o RHPortal.Ai diretamente

Útil para validar o cálculo do score antes de integrar com a API.

### Health

```bash
curl -s http://localhost:8000/health
# Esperado: {"status":"ok","service":"rhportal-ai"}
```

### POST /match-one (um candidato)

Use uma vaga com `MatchingFiltrosRaw` preenchido e um candidato existente no mesmo banco/tenant.

```bash
curl -s -X POST http://localhost:8000/match-one \
  -H "Content-Type: application/json" \
  -d '{
    "vaga_id": "VAGA_UUID",
    "candidato_id": "CANDIDATO_UUID",
    "tenant_id": "liotecnica"
  }'
```

Resposta esperada: `candidato_id`, `nome`, `email`, `similaridade` (0–100).

### POST /match (lote)

```bash
curl -s -X POST http://localhost:8000/match \
  -H "Content-Type: application/json" \
  -d '{
    "vaga_id": "VAGA_UUID",
    "tenant_id": "liotecnica",
    "limit": 10
  }'
```

Retorno: lista em `matching` com `candidato_id`, `nome`, `email`, `similaridade`.

---

## 5. Resumo rápido

| O que testar | Como |
|--------------|------|
| **Serviço de persistência/ranking** | `dotnet test RHPortal.Api.Tests` |
| **Candidatura gera score** | Enviar candidatura (portal ou cURL) e verificar `CandidatoVagaMatchingScores` ou o ranking com `useAi=true` |
| **Atribuição gera score** | Criar/editar candidato com VagaId (portal ou API) e verificar o ranking |
| **Ranking na tela** | Inserir scores mockados (SQL acima) e abrir Matching da vaga com uso de IA |
| **IA isolada** | `curl` em `/health`, `/match-one` e `/match` no RHPortal.Ai (porta 8000) |

Com isso você cobre testes automatizados do serviço de ranking e testes manuais do fluxo de candidatura, atribuição e exibição do ranking, além de dados mockados para validar a tela sem depender da IA.
