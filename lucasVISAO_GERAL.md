# lucas — Visão Geral de Negócio: Voltage.RenderRH

> **Autor:** Lucas Machado · **Branch:** `feature/ia-rag-fase-4-5_v2` · **Data inicial:** 2026-04-24
> Documento mantido por mim para entender o produto inteiro antes de continuar a Fase 4.5 da IA/RAG.

---

## 1. Em uma frase

**Voltage.RenderRH** (também chamado de **Qualiit RenderRH** comercialmente) é uma **plataforma SaaS multi-tenant de RH** que cobre o **ciclo completo de pessoas** — recrutamento, matching com IA, admissão, integração com TOTVS RM/Datasul, gestão do colaborador, avaliação de desempenho, feedback contínuo e desligamento.

É um **ERP de RH "moderno"** que se conecta ao TOTVS legado da empresa-cliente (Datasul/RM) sem substituí-lo: o RenderRH faz a "ponta digital" (portal de vagas, candidato, gestor, recrutador) e empurra os movimentos resultantes para o ERP.

---

## 2. Quem usa o sistema (personas)

| Persona | O que faz no produto |
|---|---|
| **Owner / Super Admin** | Dono do produto — administra **vários tenants** (várias empresas-cliente). Cria tenants, ativa módulos por tenant, gerencia chaves de IA e configurações AWS globais. |
| **Admin do Tenant** | Configura a empresa: branding, usuários, roles/permissões, integrações (Entra ID, SMTP, WhatsApp), workflows de aprovação, descrição padrão de cargo. |
| **RH / Recrutador** | Cria vagas, faz triagem, kanban de candidaturas, agenda entrevistas, envia propostas, conduz pré-admissão, integra com TOTVS. |
| **Gestor (Líder de área)** | Solicita vagas/headcount, aprova candidatos, avalia colaboradores (1:1, nine-box), aprova férias e desligamentos. |
| **Colaborador (funcionário)** | Vê holerite, solicita férias/benefícios, recebe feedback, participa de celebrations, registra humor (mood). |
| **Candidato externo** | Acessa **portal público de vagas**, se candidata, recebe propostas via magic link, completa pré-admissão. |
| **Worker de integração** | Processo .NET background que sincroniza dados RM (TOTVS) → Portal a cada 5 minutos. |

---

## 3. Os grandes domínios funcionais

```
┌─────────────────────────────────────────────────────────────────┐
│                       VOLTAGE.RENDERRH                           │
├──────────────────┬──────────────────┬──────────────────┬────────┤
│  RECRUTAMENTO    │  ADMISSÃO        │  GESTÃO DE       │  ADMIN  │
│  & MATCHING IA   │  & ONBOARDING    │  PESSOAS         │  & SSO  │
├──────────────────┼──────────────────┼──────────────────┼────────┤
│ • Vagas          │ • Pré-admissão   │ • Funcionários   │ • Owner │
│ • Solicitações   │ • Doc do candi-  │ • Time / hierar- │ • Tenant│
│   de vaga        │   dato (magic    │   quia           │ • Users │
│ • Triagem        │   link)          │ • Cargos         │ • Roles │
│ • Candidatos     │ • Validação      │ • Centros de     │ • Perm. │
│ • Kanban funil   │   TOTVS          │   custo          │ • Brand │
│ • Matching IA    │ • Integração     │ • Dependentes    │ • Audit │
│   (RAG)          │   Datasul        │ • Dados bancár.  │ • Logs  │
│ • Propostas      │ • Documentos     │                  │         │
│ • Portal público │   obrigatórios   │                  │         │
├──────────────────┴──────────────────┴──────────────────┴────────┤
│                                                                  │
│  FEEDBACK & DESEMPENHO       │  SOLICITAÇÕES & WORKFLOWS RH      │
│  • Ciclos de avaliação 360°  │  • Férias                         │
│  • Nine-box                  │  • Benefícios                     │
│  • PDI                       │  • Promoção                       │
│  • 1:1                       │  • Desligamento                   │
│  • Celebrations              │  • Mudança de endereço            │
│  • Mood tracking             │  • Pagamento extra                │
│  • Render coins (gamif.)     │  • Aprovações via magic link      │
│  • Surveys                   │                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. O que diferencia o produto

1. **Matching de candidatos via IA com RAG**
   - Pipeline híbrido: pré-filtro vetorial (pgvector) → LLM avalia em batch (4 dimensões: competência, experiência, formação, localidade) → score 0-100.
   - Duas regras coexistindo: **v1 (80% filtros / 20% requisitos)** já em produção e **v2 (65/35 + gates duros)** em rollout (Fase 4.5).
   - Vai além de keywords — usa embeddings OpenAI (1536 dims) ou Gemini Embedding 002 (768 dims, em teste).

2. **Multi-tenant com banco isolado**
   - Cada empresa-cliente tem seu próprio banco (`dev_render_{tenantId}`).
   - Migrations propagam automaticamente em todos os tenants no deploy.
   - Header `X-Tenant-Id` direciona toda a request.

3. **Integração TOTVS bidirecional**
   - **RM → Portal:** worker sincroniza pessoas, funcionários, cargos, áreas, vagas a cada 5 min (12 services especializados).
   - **Portal → Datasul:** movimentações (promoção, transferência, desligamento, férias, pré-admissão) são empurradas para o ERP via API REST/procedure do Datasul.

4. **Frontend único Next.js (Fase 13)**
   - Antigo `LioTecnica.Web` (MVC Razor) foi descomissionado em abril/2026.
   - Tudo agora é Next.js 16 + React 19 (static export sob `/app`) falando direto com a `RHPortal.Api`.
   - Login Entra ID 100% na API.

5. **Aprovação por magic link**
   - Gestor recebe e-mail com link tokenizado e aprova vaga/desligamento/férias **sem precisar logar no portal** — útil para C-level e gestores ocasionais.

6. **Comunicação multicanal**
   - SMTP (transacional, com fila + retry).
   - WhatsApp via Twilio ou Meta Cloud API (com rate limit de 5 msg/h por pessoa e respeito a horário silencioso).
   - Blip (chatbot, em ComunicacaoController).

7. **Gamificação leve**
   - "Render Coins" — moeda interna ganha por atividades (responder survey, dar feedback, completar PDI) e gasta em benefícios.
   - Mood tracking diário (humor da equipe).
   - Celebrations (post de reconhecimento com menções e reações).

---

## 5. Mapa visual da arquitetura

```
                  ┌────────────────────────────────────┐
                  │        Browser (Candidato,         │
                  │         RH, Gestor, Admin)         │
                  └─────────────────┬──────────────────┘
                                    │ HTTPS + JWT + X-Tenant-Id
                                    ▼
              ┌─────────────────────────────────────────────┐
              │       LioTecnica.Web.Next  (Next.js 16)     │
              │       Static export servida em /app          │
              │       :3000  (dev) / CDN (prod)              │
              └─────────────────┬──────────────────────────┘
                                │ fetch direto (sem proxy MVC)
                                ▼
       ┌────────────────────────────────────────────────────────┐
       │          RHPortal.Api  (.NET 8/9 + EF Core)             │
       │          :5056                                          │
       │  ┌──────────────────────────────────────────────────┐   │
       │  │ Controllers (~98)  · Services (~65)              │   │
       │  │ Multi-tenant: TenantMiddleware → AppDbContext     │   │
       │  │ Auth: JWT + Entra ID + ApiKey + MagicLink         │   │
       │  │ Background Workers (~10): email, matching, etc.   │   │
       │  └──────────────────────────────────────────────────┘   │
       └────┬───────────────┬──────────────┬──────────────┬─────┘
            │               │              │              │
            ▼               ▼              ▼              ▼
    ┌──────────────┐ ┌────────────┐ ┌──────────┐ ┌──────────────┐
    │  PostgreSQL  │ │  RHPortal  │ │  AWS S3  │ │  External    │
    │  Master +    │ │  .Ai       │ │  bucket  │ │  • SMTP      │
    │  N tenants   │ │  (Python)  │ │  (CVs e  │ │  • Twilio    │
    │  + pgvector  │ │  :8000     │ │  docs)   │ │  • Meta WA   │
    │              │ │  FastAPI   │ │          │ │  • Entra ID  │
    │              │ │  + LangCh. │ │          │ │  • OpenAI    │
    │              │ │  + Gemini  │ │          │ │  • Blip      │
    └──────┬───────┘ └─────┬──────┘ └──────────┘ │  • Nominatim │
           │               │                     └──────┬───────┘
           │               │ lê o mesmo banco           │
           │               │ do tenant (pgvector)       │
           │               │                            │
           │               └────────────────────────────┘
           │
           │  ┌─────────────────────────────────────────┐
           └──┤  Liotecnica.Integration.RM (.NET)        │
              │  Worker BackgroundService — ciclo 5 min  │
              │  Lê SQL Server TOTVS RM →                │
              │  POST/PATCH na RHPortal.Api              │
              └─────────────────────┬────────────────────┘
                                    │
                                    ▼
                        ┌──────────────────────┐
                        │  TOTVS RM (legado)   │
                        │  SQL Server          │
                        │  Cliente: Liotecnica │
                        └──────────────────────┘
```

---

## 6. Sub-projetos no monorepo (mapa físico)

| Pasta | Tipo | Propósito |
|---|---|---|
| `LioTecnica.Web.Next/` | Next.js 16 | Frontend único (App Router + static export) |
| `RHPortal.Api/` | .NET 8/9 + EF Core | API REST principal (98 controllers, 146 entidades) |
| `RHPortal.Ai/` | Python + FastAPI | Serviço de matching com IA / RAG (~4900 LoC) |
| `Liotecnica.Integration.RM/` | .NET Worker | Worker que sincroniza RM (TOTVS) → Portal |
| `Liotecnica.Integration.RM.Schema/` | .NET Lib | Define `RmSchemaOptions` e nomes de tabelas RM |
| `Liotecnica.Integration.RM.Schema.Tables/` | JSON dumps | Extrações JSON do schema RM para análise offline |
| `LioTecnica.sln` | Solução .NET | Apenas Integração RM + Schema (Web MVC removido) |
| `__scripts__/` | Bash/Python | Scripts de dev (dev-all, fix-migrations, kill-ports), QA, mock TOTVS |
| `scripts/` | Bash | Setup pgvector (Windows e macOS) |
| `knowledge-base/` | Markdown | Visão arquitetural, sidebar UI, handoffs |
| `__analise__/` | JSON | Dados extraídos do RM para troubleshooting offline |
| `backups/` | dump/sql | Dumps PostgreSQL de bancos de dev |
| `docker-compose.yml` | Docker | Sobe API, Web-Next e AI em produção (ECR) |
| `docker-compose.qa.yml` | Docker | Versão QA |
| `azure-pipelines.yml` | Azure DevOps | CI/CD: build do Next.js + publish artefato |
| `.githooks/` | Git | Hooks pre-commit/pre-push |

Os **HTMLs estáticos antigos** (`vagas.html`, `candidatos.html`, `dashboardv1.html`, `Matching.html`, `triagem.html`, `usuarios_perfis.html`, `relatorios.html`, `EntradaEmailPasta.html`) que serviram de **mockup/protótipo** antes da migração para Next.js foram movidos para `__analise__/mockups-mvc/` em 2026-04-26 (LUC-022) — não eram produtivos, só ficavam ali para referência visual.

---

## 7. Dois bancos PostgreSQL (mental model)

| Banco | DbContext | Conteúdo |
|---|---|---|
| **Master** (`dev_render`) | `MasterDbContext` (8 tabelas) | Lista de tenants, owners, chaves de IA globais (encrypted), modelos de IA, registros de uso de IA, AWS settings do owner, módulos/pacotes/telas habilitadas por tenant. |
| **Tenant** (`dev_render_{tenantId}`) | `AppDbContext` (160+ tabelas) | TUDO do dia-a-dia da empresa-cliente: vagas, candidatos, funcionários, avaliações, feedback, embeddings, audit, etc. **Um banco por cliente.** |

A `RHPortal.Ai` (Python) **não toca o Master** — sempre conecta direto no banco do tenant via `dev_render_{tenantId}`.

---

## 8. Estado atual (Fase 13 + Fase 4.5)

| Iniciativa | Status |
|---|---|
| Migração frontend MVC → Next.js | ✅ Concluída (Fase 13, abril/2026 — antigo `LioTecnica.Web` removido) |
| API .NET multi-tenant | ✅ Em produção |
| Integração RM → Portal (worker) | ✅ Em produção (ciclo 5 min) |
| Integração Portal → Datasul (movimentações) | ⚠️ API pronta; worker não roda — disparo manual |
| Login Entra ID | ✅ Em produção, configurável por tenant |
| Matching v1 (80/20) com pgvector + OpenAI | ✅ Em produção |
| **Matching v2 (65/35 + gates) — Fase 4.5** | 🔄 **Em rollout via feature flag por tenant** |
| Embeddings Gemini 002 (provider alternativo) | 🔄 Em teste |
| Persistência de ranking incluindo Talentos | 📋 Pendente (hoje só Candidatos vão para `CandidatoVagaMatchingScores`) |
| Rerank LLM dos top-K | 📋 Avaliação |
| Worker de processamento da Inbox de e-mails | ⚠️ Infra pronta, worker inativo |
| WhatsApp Twilio/Meta | ⚠️ Implementado, provider "Logging" ativo (não envia) |

---

## 9. Glossário rápido

| Termo | Significado |
|---|---|
| **Tenant** | Empresa-cliente. Cada uma tem banco próprio. |
| **Owner** | Super-admin da Voltage que administra os tenants. |
| **Vaga** | Posição em aberto. Tem requisitos, etapas (kanban) e filtros de matching IA. |
| **Candidatura** | Aplicação de um candidato a uma vaga (entidade de junção com etapa atual). |
| **Pré-admissão** | Estado entre "candidato aprovado" e "funcionário criado" — coleta documentos, valida com TOTVS. |
| **MatchingFiltrosRaw** | Texto-livre na vaga com filtros de IA (idioma, vivência específica, etc.). |
| **DescricaoCargo** | Catálogo de descrições de cargo reutilizável (DNALIO 36+ itens). |
| **CandidatoVagaMatchingScore** | Score persistido (não é calculado a cada request — é cacheado). |
| **Talento** | Pessoa no banco de talentos, sem candidatura ativa. Entra no matching junto com candidatos. |
| **Magic link** | URL com token único para aprovação ou ação pública sem login. |
| **DNALIO** | Padrão proprietário da Liotécnica para descrição de cargos (36+ itens estruturados). |
| **Render Coin** | Moeda interna de gamificação (não vale dinheiro real). |

---

## 10. Onde olhar primeiro quando bater dúvida

| Pergunta | Arquivo / pasta |
|---|---|
| Como subir o projeto? | `README.md` |
| Como funcionam migrations? | `CLAUDE.md` |
| Visão arquitetural completa | `VISAO_GERAL_PROJETO.md` |
| Status da IA hoje | `STATUS_MATCHING_VETORIZADO.md` |
| Plano da Fase 4.5 (65/35) | `PLANO_EVOLUCAO_MATCHING_65_35.md` |
| Como usar matching IA na UI | `COMO_USAR_MATCHING_IA.md` |
| Setup IA / RAG (Ollama, pgvector) | `GUIA_IA_RAG.md` |
| Fluxo IA matching ponta-a-ponta | `FLUXO_IA_MATCHING.md` |
| Casos de teste de admissão | `TESTE_FLUXO_ADMISSAO.md`, `CASO_TESTE_*.md` |
| Integração Datasul (movimentações) | `INTEGRACAO-MOVIMENTACOES-DATASUL.md` |
| Inventário do MVC removido | `PORTAL_MVC_INVENTARIO_E_MIGRACAO.md` |
| Recrutamento ponta-a-ponta | `RECRUTAMENTO_FLUXO.md` |
| Backlog histórico do time | `backlog.md` (gigante, 72 KB) |
| Changelog histórico do time | `changelog.md` (187 KB) |
| Diário de bordo do time | `diario-de-bordo.md` (240 KB) |

> Os meus documentos `lucas*` são **derivados** desses originais — eu sintetizo e mantenho na minha visão.

---

**Próximo passo (meu):** ler `lucasMODULOS_FUNCIONALIDADES.md` para entender tela por tela.
