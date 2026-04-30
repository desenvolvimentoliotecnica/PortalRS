<!-- source: 06-CONTEXT.md + ROADMAP Fase 6 + REQUIREMENTS UIT-02, SEL-01..04 + reconnaissance código -->
<!-- gsd-phase:phase=06-ui-operacoes-rh-selecao -->

Phase: **UI Operações RH + seleção · UIT‑02, SEL‑01…SEL‑04**  
Focus: Shell **`/rh/contratacoes/*`** separado do pipeline **`/triagem`**; filtros/listas por **`SolicitacaoStatus`** + permissões JWT; fluxos SEL no domínio **`SolicitacaoVaga`** (enum + serviço + histórico); entidade indicções; widening seguro **`ListAsync`/`GetById`** para papel operacional; ligação a **matching** (`/matching?vagaId=`).  
Out of scope: Playwright E2E, BPM grafico (**FUT‑01**), write‑back RM nao especificado (**GAP** apenas na VERIFY).

# Phase Plan: UI Operações RH + seleção

## Research condensed (baseline código — `$gsd-sdk`/`RESEARCH.md` omitidos neste ambiente)

- **Triagem API** já existe: `EnsureUsuarioAutorizadoTriagemAsync` = Admin **ou** user na role de fila RH configurada (**nao** claim `permission`) — [`SolicitacaoVagaService.cs`](../../../../../RHPortal.Api/RHPortal.Api/Application/SolicitacoesVaga/SolicitacaoVagaService.cs).
- **Pós‑RM sucesso criacao**: `ExecutarCriacaoRequisicaoRmAsync` → **`EmIntegracao`** + `RmRequisicaoCodigo` ([`SolicitacaoVagaRmIntegracaoService.cs`](../../../../../RHPortal.Api/RHPortal.Api/Application/SolicitacoesVaga/SolicitacaoVagaRmIntegracaoService.cs)).
- **`ListAsync`**: utilizador nao‑admin só vê próprios + etapas pendentes — **bloqueio real** para fila RH ampla até existir bypass por permissão (ver **06.T4**).
- **`GetByIdAsync`**: hoje não aplica restricao por solicitante visible no trecho analisado — **06.T4** fecha para perfis não privilegiados + abre para `rh.contratacoes.view`.
- **`SolicitacaoVagaRmSyncWorkflowRank` / `RmCodStatusSync`**: predicado “terminal” deve incluir **novos enum terminais** para não regressao indevida (ver **06.T3**).

## Estado alvo SEL — pré‑condições (**SEL‑01**)

| Transição portal | Estado origem aceite (proposta PLAN) | Condições mínimas |
|------------------|--------------------------------------|-------------------|
| → **`EmProcessoSeletivo`** | **`EmIntegracao`** (ou mapeamentos sync posteriores com **rank ≥ `EmIntegracao`** que produto aceitar como “requisição viva no RM”) | **`VagaId` not null**; tentativa RM com sucesso implícito se `EmIntegracao` |
| Pause / resume | **`EmProcessoSeletivo`** ↔ **`Suspensa`** | Actor com `rh.contratacoes.selecao`; motivo opcional em histórico |
| Terminais | A partir **`EmProcessoSeletivo`** / **`Suspensa`** | **`ContratacaoConcluida`**, **`EncerradaSemContratacao`** com observação obrigatória onde produto exigir |

*O executor ajusta a tabela exacta contra `RmRequisicaoStatusMap` real do tenant piloto antes de endurecer asserts.*

### Harmonia **`Concluida`** legado vs **`ContratacaoConcluida`**

- **`Concluida`**: manter semantics actual (aprovações/headcount fim‑de‑fluxo interno já no codigo — **sem migrar dados** nesta fase).
- **`ContratacaoConcluida`**: novo terminal **explicito** RH pós‑seleção (SEL‑04).
- Labels UI distintos via **`solicitacaoVagaStatusUi`**.

## Requirements traceability

| REQ ID | Acceptance (resumo) | Tasks |
|--------|----------------------|-------|
| **UIT‑02** | Jornadas triagem / aprovação / RH separadas por permissão + filtros §8 (+ RM erro) | 06.T4, 06.T7, 06.T8, 06.T10 |
| **SEL‑01** | RH avança **Em Processo Seletivo** (**CA11**) | 06.T2, 06.T3, 06.T5, 06.T8 |
| **SEL‑02** | Compatíveis / banco (CA12) | 06.T8 |
| **SEL‑03** | Indicações internas ligadas à solicitação (**CA13**) | 06.T2, 06.T5, 06.T8 |
| **SEL‑04** | Finais + coerência RM quando aplicável (**RN14, CA14**) | 06.T2, 06.T3, 06.T5, 06.T10 |
| **AUD‑01** | Timeline em todas mudanças | 06.T3, 06.T5 |

## Prerequisites

- Fases ≤5 concluídas para consumo **`SolicitacaoVagaResponse`**, **`solicitacaoVagaStatusUi`**, criacao RM, sync CODSTATUS (base).
- Migracoes PostgreSQL tenant‑safe (`CLAUDE.md` — **`IF NOT EXISTS`** onde aplicavel).

## Waves

| Wave | Tasks | Dependências |
|------|-------|----------------|
| **1 — Domínio** | 06.T1, 06.T2 | Enumeration + schema indicções antes de UI |
| **2 — API + authz dados** | 06.T3, 06.T4, 06.T5 | Depende enum + DbContext |
| **3 — Shell Next + nav** | 06.T6, 06.T7 | Depois contratos API estáveis |
| **4 — Detalhe + matching + VERIFY** | 06.T8, 06.T9, 06.T10 | Depende telas lista |

---

## Executable tasks (`06.T*`)

### 06.T1 — Extend **`SolicitacaoStatus`**

**Files:** [`Domain/Enums/SolicitacaoStatus.cs`](../../../../../RHPortal.Api/RHPortal.Api/Domain/Enums/SolicitacaoStatus.cs)

**Objective:** acrescentar (valores seguintes disponíveis — **planador confirma inteiros livres nos migrations**):

- `EmProcessoSeletivo`
- `Suspensa`
- `EncerradaSemContratacao`
- `ContratacaoConcluida`

**Acceptance:**

- SLA / seeds que usam `GetEnumNames<SolicitacaoStatus>()` continuam válidos (**sem quebrar** [`SlaStatusConfigController`](../../../../../RHPortal.Api/RHPortal.Api/Controllers/SlaStatusConfigController.cs)).
- Contrato JSON serializa pelo **nome** do membro (default ASP.NET enum string).

---

### 06.T2 — Entidade **`SolicitacaoVagaIndicacao`** + migração idempotente

**Files:**

- [`Domain/Entities/SolicitacaoVagaIndicacao.cs`](../../../../../RHPortal.Api/RHPortal.Api/Domain/Entities/SolicitacaoVagaIndicacao.cs) *(novo)*
- [`Infrastructure/Data/AppDbContext.cs`](../../../../../RHPortal.Api/RHPortal.Api/Infrastructure/Data/AppDbContext.cs) — `DbSet` + `OnModelCreating`
- `Migrations/*AddSolicitacaoVagaIndicacao*.cs` via `dotnet ef migrations add …`

**Schema mínimo:** `Id`, `TenantId`, `SolicitacaoVagaId`, `CandidatoId`, `Observacao` (opcional), `IndicadoPorUserId` ou `FuncionarioId` (opcional), `CreatedAtUtc`.

**Acceptance:** tabela criada com **`CREATE TABLE IF NOT EXISTS`** no `Up()` se política do repo for SQL idempotente multi‑tenant; caso contrário migration EF standard + documentar aplicação por tenant existente.

---

### 06.T3 — Serviço: ranks, terminais sync, transições SEL

**Files:**

- [`SolicitacaoVagaRmSyncWorkflowRank.cs`](../../../../../RHPortal.Api/RHPortal.Api/Application/SolicitacoesVaga/SolicitacaoVagaRmSyncWorkflowRank.cs) — ranks para estados novos (**`EmProcessoSeletivo`** após `EmIntegracao`; terminais ≥ reprovados).
- [`SolicitacaoVagaRmCodStatusSyncService.cs`](../../../../../RHPortal.Api/RHPortal.Api/Application/SolicitacoesVaga/SolicitacaoVagaRmCodStatusSyncService.cs) — `Terminal()` inclui **`ContratacaoConcluida`**, **`EncerradaSemContratacao`**, **`Suspensa`** se produto definir pausa como terminal de sync (default: **Suspensa não terminal** para sync — só **Concluida/Reprovada/Cancelada/ContratacaoConcluida/EncerradaSemContratacao**).
- [`SolicitacaoVagaService.cs`](../../../../../RHPortal.Api/RHPortal.Api/Application/SolicitacoesVaga/SolicitacaoVagaService.cs) — métodos dedicados, ex.:
  - `IniciarProcessoSeletivoAsync`
  - `SuspenderSelecaoAsync` / `RetomarSelecaoAsync`
  - `EncerrarSemContratacaoAsync`
  - `MarcarContratacaoConcluidaAsync`
- Quaisquer **`switch`** existentes que assumam lista fechada de status (grep `SolicitacaoStatus.` no serviço e sync).

**Regras:** cada transição com **`StatusHistoricoService`** + validação de pré‑condições (**secção Estado alvo SEL**); actor autorizado (**06.T5**) + `EnsureUsuarioAutorizadoSelecaoAsync` espelhando padrão triagem (Admin bypass).

**Acceptance:**

- Impossível saltar para **`EmProcessoSeletivo`** sem **`VagaId`** e estado origem válido.
- **`ReprovarEmCascata`** / cancelamentos não “revivem” contratos já em **`ContratacaoConcluida`** sem regra produto explicita *(default: ignorar ids já terminais novos)*.

---

### 06.T4 — **`HasPermission` + widening `ListAsync` / gate `GetById`**

**Files:**

- [`ICurrentUserContext.cs`](../../../../../RHPortal.Api/RHPortal.Api/Infrastructure/Tenancy/ICurrentUserContext.cs) / [`CurrentUserContext.cs`](../../../../../RHPortal.Api/RHPortal.Api/Infrastructure/Tenancy/CurrentUserContext.cs) — `bool HasPermission(string key)` lendo claims `PermissionConstants.ClaimType`; `*` = wildcard.
- [`SolicitacaoVagaService.cs`](../../../../../RHPortal.Api/RHPortal.Api/Application/SolicitacoesVaga/SolicitacaoVagaService.cs) — `ListAsync`:
  - se `HasPermission("*") || HasPermission("rh.contratacoes.view") || HasPermission("rh.contratacoes.triagem") || HasPermission("rh.contratacoes.selecao")` (ajustar set mínimo) **e** `apenasMeus != true` → **não aplicar** filtro restritivo “só próprios+pilha” *(retinar intersecção exacta conforme papel)*.
  - **Admin** continua comportamento actual.
- `GetByIdAsync`: garantir que utilizador sem privilégios amplos só lê solicitações que já poderia via regras hoje implícitas; utilizador com `rh.contratacoes.view` lê qualquer tenant‑scoped *(alinhado a `IsAdmin`)*.

**Acceptance:**

- RH com permissões nova consegue `GET /api/solicitacoes-vaga?statuses=PendenteTriagem,EmTriagem` sem lista vazia enganadora.
- Gestor sem essas permissões **não** regreessiona.

---

### 06.T5 — Controller: SEL + Indicações + atributos permissão

**Files:**

- [`SolicitacoesVagaController.cs`](../../../../../RHPortal.Api/RHPortal.Api/Controllers/SolicitacoesVagaController.cs) **ou** novo `RhContratacoesController` fino delegando ao serviço — preferência: **ações SEL agrupadas** com `[RequirePermission("rh.contratacoes.selecao")]`.
- DTOs em [`Contracts/SolicitacoesVaga/`](../../../../../RHPortal.Api/RHPortal.Api/Contracts/SolicitacoesVaga/).
- Endpoints REST mínimos:
  - `POST …/selecao/iniciar` → `EmProcessoSeletivo`
  - `POST …/selecao/suspender` · `POST …/selecao/retomar`
  - `POST …/selecao/encerrar-sem-contratacao` · `POST …/selecao/contratacao-concluida`
  - `GET/POST/DELETE …/indicacoes` (lista + criar + remover próprio/indicação RH)

Marcar métodos **`triagem/*`** existentes com `[RequirePermission("rh.contratacoes.triagem")]` **somente se** continuarem compatíveis com `EnsureUsuarioAutorizadoTriagemAsync` (**dupla barreira** aceitável — alinhar com produto OU substituir fila‑role pela permission no medium term; PLAN assume **additive**: claim **e** role como hoje).

**Acceptance:**

- `403` quando JWT sem permissão; mensagens **`InvalidOperation`** existentes preservadas para regra de negocio.

---

### 06.T6 — **`RolePermissionManifest`**

**Files:** [`RolePermissionManifest.cs`](../../../../../RHPortal.Api/RHPortal.Api/Infrastructure/Security/RolePermissionManifest.cs)

**Objective:** registar `"rh.contratacoes.view"`, `"rh.contratacoes.triagem"`, `"rh.contratacoes.selecao"` em **`TenantPermissions`** *(full RH/Admin/recrutamento)* — **nao** em `GestorCompliancePermissions` por default.

---

### 06.T7 — Navegação BFF / Next manifest

**Files:**

- [`NavegacaoManifest.cs`](../../../../../RHPortal.Api/RHPortal.Api/Infrastructure/Navegacao/NavegacaoManifest.cs) — itens p.ex. **`nav-rh-contratacoes-triagem`**, **`nav-rh-contratacoes-selecao`** com **href** `/rh/contratacoes/triagem` e `/rh/contratacoes/selecao`, bucket `recrutamento-selecao` ou novo grupo “Operações RH” se preferir (**GrupoUiOverride**).
- Se o Next ainda duplicar [`permissionManifest.ts`](../../../../../LioTecnica.Web.Next/src/features/navigation/permissionManifest.ts) offline — **manter paridade** de keys/hrefs.

Rotas garantir **`RequireModule`** coerente com pacote (**`recrutamento`** já usado nas solicitações).

---

### 06.T8 — Next: shell RH + grids + detalhe

**Files (novo feature slice):**

- `LioTecnica.Web.Next/src/app/(app)/rh/contratacoes/layout.tsx` *(opcional)*
- `…/triagem/page.tsx`, `…/selecao/page.tsx`, `…/[id]/page.tsx` *(detalhe)*
- `LioTecnica.Web.Next/src/features/rh/contratacoes/…` — componentes: `ContratacoesTriagemScreen`, `ContratacoesSelecaoScreen`, `SolicitacaoVagaRhDetail` (reutiliza padrões de [`SolicitacoesScreen`](../../../../../LioTecnica.Web.Next/src/features/gestao/solicitacoes/SolicitacoesScreen.tsx) onde prático)

**Objective:**

1. Triagem: chips filtro presets **PendenteTriagem**, **EmTriagem**, **DevolvidaTriagemGestor**; linha abre detalhe; botões chamam **`POST`** existentes.
2. Seleção: filtros SEL + RM erro; lista mostra **`rm*`**; detalhe com abas timeline + indicações.
3. Matching: botão **“Compatíveis (matching)”** → `href` **`/matching?vagaId={uuid}`** (respeitar `basePath` `/app`).
4. `solicitacaoVagaStatusUi`: labels/cores novos enums.

---

### 06.T9 — Vista aprovação “ampla” (opcional MVP)

**Files:** novo ecra ligado **`/rh/contratacoes/aprovacoes`** **ou** documentar na VERIFY apenas **deeplink** ` /gestao/aprovacoes` + critérios UIT‑02 — **implementar** somente se, após **06.T8**, filtros §8 continuarem incompletos para papel RH **sem** esta vista.

*(Default PLAN: nave item “Aprovações” no shell RH aponta para **`/gestao/aprovacoes`** com mesmo permission `gestao.dashboard`/`aprovacoes` — já existente.)*

---

### 06.T10 — **`06-VERIFY.md`**

Checklist reprodutível: triagem aumento HC fim‑a‑fim; iniciar SEL com solicitação em **`EmIntegracao`** + `VagaId`; indicações CRUD; encerramentos; histórico; matching abre só com `VagaId`; regressão não‑RH em lista gestor.

---

## Verification (goal‑backward)

1. ✅ Utilizador com **`rh.contratacoes.triagem`** lista e executa `triagem/*` sem SQL.
2. ✅ Utilizador com **`rh.contratacoes.selecao`** transita SEL + consulta histórico.
3. ✅ Indicações persistem tenant‑scoped auditáveis .
4. ✅ Matching alcançável a partir do detalhe quando `VagaId` existe.
5. ✅ Sync RM não corrompe estados SEL terminais (nao regressão invalida).

---

## Deferred

- Migrar registos **`Concluida`** históricos para **`ContratacaoConcluida`** (explicitamente não desta entrega).

---

## Plan checker self‑review

| Check | ✓ |
|-------|---|
| Traceability até ROADMAP/REQ | ✓ |
| Out of phase explicit | ✓ |
| Files & acceptance por task | ✓ |
| Depende apenas fases pré‑existentes para API/UI base | ✓ |
| Migracoes entidade nova + enum | ✓ |

---

*Phase slug: **`06-ui-operacoes-rh-selecao`** · Próximo: **`/gsd-execute-phase 6`***
