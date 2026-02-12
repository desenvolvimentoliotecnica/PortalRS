# Visão geral do projeto (Qualiit RenderRH / Voltage.RenderRH)

Documento para entender a arquitetura inteira, o fluxo de dados, onde está o matching (keyword vs IA) e como a parte nova de IA se encaixa — incluindo furos de lógica e o que falta para finalizar.

---

## 1. Estrutura de pastas e soluções

```
Voltage.RenderRH/
├── LioTecnica.sln                    # Solução principal (Web + Integration)
├── LioTecnica.Web/                   # Frontend MVC (portal RH)
├── Liotecnica.Integration.RM/        # Integração com outro sistema (RM)
├── Liotecnica.Integration.RM.Schema/
├── Liotecnica.Integration.RM.Schema.Tables/
├── RHPortal.Api/                     # API .NET (outra solução)
│   └── RHPortal.Api/
│       ├── Application/              # Serviços (Vagas, Candidatos, Matching, Ai)
│       ├── Controllers/              # Endpoints REST
│       ├── Domain/                   # Entidades (Vaga, Candidato, etc.)
│       ├── Infrastructure/           # DB, tenancy, auth
│       └── ...
├── RHPortal.Ai/                      # Serviço Python (LangChain + busca vetorial)
│   ├── app/
│   │   ├── config.py
│   │   ├── db.py                     # Leitura PostgreSQL
│   │   ├── matching.py              # RAG + Chroma + similaridade
│   │   └── main.py                  # FastAPI
│   ├── requirements.txt
│   └── .env
└── ...
```

- **LioTecnica.sln** inclui: **LioTecnica.Web**, **Liotecnica.Integration.RM**, **Liotecnica.Integration.RM.Schema**.  
- **RHPortal.Api** tem sua própria solução (**RHPortal.Api.sln**) e **não** está referenciada na LioTecnica.sln.  
- **RHPortal.Ai** é projeto Python **fora** de qualquer .sln; roda como processo separado.

---

## 2. Quem é quem

| Projeto | Função | Tecnologia |
|--------|--------|------------|
| **LioTecnica.Web** | Portal RH (telas de Vagas, Candidatos, Matching, Triagem, etc.). Faz proxy das chamadas para a API. | ASP.NET Core MVC, Razor, JS (wwwroot/js/views/) |
| **RHPortal.Api** | API REST: CRUD de vagas, candidatos, matching por keywords, auth, multi-tenant. Fonte da verdade em PostgreSQL. | .NET 8, EF Core, PostgreSQL |
| **RHPortal.Ai** | Matching por IA: lê vaga + candidatos no banco, usa LangChain + embeddings + Chroma, devolve ranking por similaridade 0–100. | Python, FastAPI, LangChain, ChromaDB, OpenAI |
| **Liotecnica.Integration.RM** | Integração com sistema “RM” (configuração, logs, etc.). Usa appsettings (Portal.BaseUrl, AiService.Host/Port). | .NET |

---

## 3. Fluxo de uma requisição (ex.: tela de Matching)

```text
Browser (matching.js)
    → GET /api/vagas                    → LioTecnica.Web (VagasController.GetAll)
    → GET /api/vagas/{id}               → LioTecnica.Web (VagasController.GetById)
    → GET /api/vagas/{id}/matching-candidates  → LioTecnica.Web (VagasController.GetMatchingCandidates)
    → POST /api/matching/recalculate    → LioTecnica.Web (MatchingController)
```

O **VagasController** e **MatchingController** da **Web** não acessam o banco diretamente: eles usam **HttpClient** (VagasApiClient, MatchingApiClient) para chamar a **RHPortal.Api**:

- Base URL da API: **Endpoints:RhApi** (ex.: `https://localhost:7073/` em appsettings.json da Web).
- Cada request é enviado com header **X-Tenant-Id** (valor vindo do **PortalTenantContext**: claim `"tenant"` do usuário logado).
- Autenticação: **ApiAuthenticationHandler** (cookie/session da Web → token ou credenciais repassadas à API).

Ou seja: **Browser → LioTecnica.Web (proxy) → RHPortal.Api → PostgreSQL**.

O **matching.js** usa URLs relativas (`/api/vagas`, etc.), então todas as chamadas passam pela Web, que atua como **proxy** e injeta tenant e auth.

---

## 4. Multi-tenant (API)

- Na **API**, o tenant vem do header **X-Tenant-Id** (ou query `tenantId`), tratado pelo **TenantMiddleware**.
- **ITenantConnectionResolver** define a connection string do tenant:
  - Se houver **TenantTemplate** (ex.: `Database=dev_render_{0}`), cada tenant pode ter banco próprio: `dev_render_liotecnica`, `dev_render_dev`, etc.
  - Caso contrário, usa **ConnectionStrings:Default** (um banco só; o tenant é filtrado por coluna **TenantId** nas tabelas).
- Entidades (Vaga, Candidato, etc.) têm **TenantId**; o **AppDbContext** usa query filters para restringir por tenant.

Na **Web**, o tenant vem do usuário logado (claim `tenant`), definido no login.

---

## 5. Dados principais (API / PostgreSQL)

- **Vagas**: Id, TenantId, Titulo, Codigo, Status, MatchMinimoPercentual, **MatchingFiltrosRaw**, **MatchingFiltrosOriginaisRaw**, Requisitos (lista), etc.
- **VagaRequisitos**: VagaId, Nome, SinonimosRaw, Obrigatorio, Peso, etc.
- **Candidatos**: Id, TenantId, Nome, Email, CvText, ResumoProfissional, Cidade, Uf, VagaId, LastMatchScore, LastMatchPass, etc.
- **CandidatoCompetencias**: CandidatoId, Nome, Tipo, Nivel.

Os “filtros de matching” da vaga (que você preenche na aba “Filtros matching (IA)” no modal da vaga) são persistidos em **MatchingFiltrosRaw** (e cópia em **MatchingFiltrosOriginaisRaw** para “Reverter para filtros da criação”).

---

## 6. Matching hoje (por keywords) — RHPortal.Api

- **MatchingService.GetCandidatesWithScoresAsync(vagaId, minScore, take)**:
  1. Carrega a **Vaga** com **Requisitos**.
  2. Carrega todos os **Candidatos** do tenant (e competências; se tiver TalentoId, resumo/experiência do Talento).
  3. Para cada candidato, monta um “perfil” de texto: **CvText + ResumoProfissional + competências**.
  4. Calcula **score** com **CalculateScore(perfil, requisitos, MatchMinimoPercentual)**:
     - Normaliza texto; para cada requisito verifica se o termo (ou sinônimos) aparece no perfil.
     - Score = (peso dos encontrados / peso total) * 100; penalidade por requisitos obrigatórios faltando.
  5. Retorna lista ordenada por score decrescente.

Importante: **MatchingFiltrosRaw não é usado** nesse cálculo. Ele só é armazenado e exibido (e será usado pela IA). Ou seja: o matching “oficial” hoje é **só por keywords (requisitos)**.

- **PATCH /api/vagas/{id}/matching-filtros**: atualiza só **MatchingFiltrosRaw** (e a Web chama isso ao salvar “Editar filtros de matching” na tela de Matching).

---

## 7. RHPortal.Ai (matching por IA) — como está

- **Serviço Python** (FastAPI) em **RHPortal.Ai/**:
  - **config.py**: lê **.env** (DATABASE_URL, OPENAI_API_KEY, etc.) e opcionalmente **Liotecnica.Integration.RM/appsettings.Development.json** (AiService.Host/Port).
  - **db.py**: conecta no **PostgreSQL** (mesmo banco do tenant), lê:
    - **Vaga**: título, **MatchingFiltrosRaw**, requisitos (Nome, SinonimosRaw).
    - **Candidatos** do tenant: CvText, ResumoProfissional, competências, cidade, UF.
  - **matching.py**: monta texto da vaga (título + MatchingFiltrosRaw + requisitos) e texto por candidato; usa **LangChain** (OpenAI Embeddings) + **ChromaDB** em memória; faz **busca por similaridade**; devolve ranking com **similaridade 0–100**.
  - **main.py**: **POST /match** com `{ "vaga_id": "uuid", "tenant_id": "opcional", "limit": 100 }` → chama db + matching e retorna **MatchResponse** (lista de candidato_id, nome, email, similaridade).

Ou seja: a **IA** usa exatamente **MatchingFiltrosRaw** + requisitos da vaga e compara com o perfil do candidato via **busca vetorial**.

- Host/porta do servidor Python vêm de **AiService** no appsettings da Integration.RM ou de **HOST**/ **PORT** no .env.

---

## 8. Furos de lógica e o que falta para “finalizar” a IA

1. **RHPortal.Ai não é chamado por ninguém**
   - A tela de Matching (matching.js) chama apenas a **API .NET**: `GET /api/vagas/{id}/matching-candidates` (keyword).
   - Não existe chamada do frontend nem da API .NET para o **RHPortal.Ai** (POST /match).
   - **Falta**: integrar. Opções:
     - **A)** Na Web: quando o usuário escolher “Matching por IA” (ou sempre que houver MatchingFiltrosRaw), o **front** chama o serviço Python (ex.: `http://localhost:8000/match`) com vaga_id e tenant_id e exibe o ranking por **similaridade**.
     - **B)** Na API .NET: um novo endpoint (ex.: GET /api/vagas/{id}/matching-candidates-ai) que, internamente, chama o Python (HttpClient para RHPortal.Ai) e devolve o mesmo formato (ou um formato unificado). A Web continuaria chamando só a API.

2. **Banco: qual connection string para o Python?**
   - A API pode usar **um banco por tenant** (TenantTemplate) ou **um banco único** com TenantId.
   - O **RHPortal.Ai** usa uma única **DATABASE_URL** no .env. Se for multi-DB por tenant, você precisa passar o tenant e montar a connection string (ex.: usar o mesmo template que a API) ou expor uma URL por tenant. Hoje o Python usa uma URL fixa; para multi-DB é preciso definir regra (ex.: tenant no body + resolver connection no Python ou a API chamar o Python já com “dados do tenant” em outro formato).

3. **Duas fontes de ranking**
   - Hoje: **matching-candidates** = só keyword (MatchingService).
   - Com a IA: você pode ter **dois** rankings (keyword e IA) ou **um só** (ex.: escolher “por IA” quando a vaga tiver MatchingFiltrosRaw).
   - **Falta**: definir se a tela mostra um ranking único (IA quando houver filtros) ou dois (keyword + IA) e implementar a chamada ao RHPortal.Ai conforme essa regra.

4. **Proxy PATCH matching-filtros na Web**
   - O **matching.js** chama `PATCH /api/vagas/{id}/matching-filtros` (Editar/Reverter filtros). A **LioTecnica.Web** não expõe essa rota: o **VagasController** não tem ação para PATCH e o **VagasApiClient** não tem método para repassar à API. Resultado: **404** ao salvar ou reverter filtros na tela de Matching.
   - **Falta**: no VagasController da Web, ação `[HttpPatch("/api/vagas/{id:guid}/matching-filtros")]` que recebe o body e chama o VagasApiClient; no VagasApiClient, método que envia PATCH para `api/vagas/{id}/matching-filtros` e retorna a resposta.

5. **Segurança e CORS**
   - Se o **browser** chamar direto o RHPortal.Ai (localhost:8000), precisa de CORS liberado e (idealmente) alguma forma de autorização (ex.: só usuário logado no portal; a Web poderia gerar um token curto ou a API fazer a chamada ao Python em nome do usuário).
   - Se só a **API .NET** chamar o Python (backend-to-backend), CORS some; a API usa uma URL configurável (ex.: Endpoints:RhAi) e repassa o resultado ao front.

6. **Tabelas/colunas em PascalCase**
   - **db.py** usa nomes com aspas (`"Candidatos"`, `"CvText"`, etc.). Se o seu PostgreSQL tiver tabelas/colunas em minúsculas (convenção Npgsql), as queries no **db.py** precisam ser ajustadas para o que está no banco.

---

## 9. Resumo do fluxo esperado quando a IA estiver integrada

- Usuário abre **Matching** → escolhe uma **vaga**.
- **Opção A (front chama Python):**
  - Front chama `GET /api/vagas/{id}/matching-candidates` (keyword) **e** `POST http://localhost:8000/match` com `{ "vaga_id": id, "tenant_id": "..." }`.
  - Exibe o ranking da IA (ou um único ranking “por IA” quando a vaga tiver filtros).
- **Opção B (API chama Python):**
  - Front chama só a API: ex. `GET /api/vagas/{id}/matching-candidates?useAi=true`.
  - A API chama o RHPortal.Ai (HttpClient), obtém o ranking por similaridade e devolve (ou mescla com o keyword).
  - Front continua igual; só a API ganha um “backend call” ao Python.

Para **testes** você pode:
- Subir o **RHPortal.Ai** (`python -m app.main` ou uvicorn), configurar **.env** (DATABASE_URL do mesmo banco que a API usa, OPENAI_API_KEY).
- Chamar **POST /match** com um **vaga_id** e **tenant_id** reais (Postman, curl ou um script).
- Conferir se o retorno (lista com **similaridade** 0–100) faz sentido; depois decidir se a integração será pelo front ou pela API e implementar a chamada + exibição na tela de Matching.

---

## 10. Onde está cada pedaço (referência rápida)

| O quê | Onde |
|-------|------|
| Tela de Matching (lista de vagas, ranking, detalhe do candidato, “Editar filtros”, “Reverter”) | LioTecnica.Web/Views/Matching/Index.cshtml + wwwroot/js/views/matching.js |
| Proxy /api/vagas e /api/vagas/.../matching-candidates | LioTecnica.Web/Controllers/VagasController.cs |
| Cálculo de score por keywords | RHPortal.Api/Application/Matching/MatchingService.cs |
| Persistência MatchingFiltrosRaw e PATCH matching-filtros | RHPortal.Api (VagaService, VagasController) |
| Filtros de matching na criação/edição da vaga (selects + observações) | LioTecnica.Web/Views/Vagas/_ModalVaga.cshtml + wwwroot/js/views/vagas.js (buildMatchingFiltrosRawFromSelects, parseMatchingFiltrosRaw) |
| Chave OpenAI nas configs (API .NET) | RHPortal.Api appsettings: Ai:OpenAI:ApiKey (ou User Secrets); UnifiedAiService usa essa chave quando não há chave no banco Master. |
| Matching por IA (Python) | RHPortal.Ai/app/ (config, db, matching, main); host/porta em Liotecnica.Integration.RM/appsettings.Development.json → AiService. |
| Integração Web ↔ API | LioTecnica.Web: Endpoints:RhApi; ApiAuthenticationHandler; VagasApiClient, CandidatosApiClient, MatchingApiClient. |

Com isso você tem uma visão geral do projeto inteiro, onde está o matching por keyword, onde está o por IA (RHPortal.Ai), e o que falta (integrar a chamada ao Python e definir uma única fonte de ranking ou duas) para finalizar a parte de IA e seguir com os testes.
