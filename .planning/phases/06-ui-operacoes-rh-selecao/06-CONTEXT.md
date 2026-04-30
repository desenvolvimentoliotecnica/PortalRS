# Phase 6 — UI Operações RH + seleção — Context

**Gathered:** 2026-04-30 (`/gsd-discuss-phase 6` — continuado no Cursor; áreas não debatidas interativamente resolvidas com **defaults** explícitos abaixo)  
**Status:** Pronto para **`/gsd-plan-phase 6`**

<domain>

## Phase boundary (fixa pelo ROADMAP)

**Goal:** Workspaces por papel com **filtros equivalentes aos statuses operacionais** (**UIT‑02**) + integração do fluxo **pós‑RM / seleção** (**SEL‑01…SEL‑04**) com dados e serviços já existentes (matching/banco/detalhes de solicitação), sem SQL manual pelo RH para os estados tratados pela fase.

**Critérios de sucesso (ROADMAP):**

1. RH transita estados SEL **via API/UI** (não apenas manual DB).
2. Busca compatíveis **usa dados existentes** de candidatos/matching quando `VagaId` estiver ligado à solicitação; lacunas ficam como **GAP explícito** na VERIFY.
3. Encerramentos finais aparecem com **histórico** (AUD‑01 / timeline já existentes).

**Carregamento de fases anteriores (não reabrir):**

- Fluxo **`SolicitacaoVaga`**, triagem pré‑RM, integração RM, sync CODSTATUS → **02‑CONTEXT**, **03‑CONTEXT**, **04‑CONTEXT**, **05‑CONTEXT** (gestor só consome UI; RH “console completo” era **explicitamente Fase 6** — ver **05‑CONTEXT** **D‑06**).

**Explicitamente fora (nesta fase):**

- **Playwright E2E** (mesmo deferimento cultural da Fase 5).
- **BPM gráfico** / assinatura multi‑alçada parametrizável (**FUT‑01**).
- Substituir **gravador RM oficial** onde ainda não existir política técnica: manter **spike/mitigação** do ROADMAP (“mecanismo oficial … indefinido”) **antes de** código pesado de write‑back; UI pode preparar estados mesmo com **GAP controlado** documentado na VERIFY.
- Reaproveitar a rota **`/triagem`** para triagem de **requisição de pessoal** — **proibido** (ver **D‑UIT‑01**).

</domain>

<decisions>

## Decisões de implementação (para pesquisa + PLAN)

### D‑UIT‑01 — Colisão de nomes: `/triagem` vs triagem **`SolicitacaoVaga`**

- **`/triagem` + `triagem.view` + `TriagemScreen`** tratam **pipeline de candidatos** (“Pipeline” na sidebar — `permissionManifest`).
- Triagem **`SolicitacaoVaga`** (aumento de quadro, **PendenteTriagem → EmTriagem → …**) é domínio **distinto**.
- **Decisão:** Nova superfície **apenas para triagem/ações de solicitações de contratação**, em rotas **`/rh/…`** (prefixo obrigatório para não confundir com recrutamento “candidatos”). Sugestão de shell: **`/rh/contratacoes`** com sub‑rotas **`/rh/contratacoes/triagem`**, **`/rh/contratacoes/selecao`** (lista + detalhe com abas SEL). Renomeações de cópias/labels só no plano se reduzirem ambiguidade (“Pipeline” já diferencia o menu).

### D‑UIT‑02 — Três jornadas (UIT‑02) por permissão

| Jornada | Conteúdo mínimo | Baseline UI/API |
|--------|------------------|-----------------|
| **Triagem** | Lista filtrável **PendenteTriagem**, **EmTriagem**, **DevolvidaTriagemGestor** (e encerramentos visíveis se útil ao papel); detalhe com ações já expostas: **`triagem/iniciar`**, **`triagem/devolver`**, **`triagem/encaminhar`**, **`triagem/reprovar`**, **`assumir`** conforme regras de serviço | `GET /api/solicitacoes-vaga`; `POST .../triagem/*`; `matchingHelpers` opcional só se reutilização fizer sentido |
| **Aprovação** | **Não substituir** o ecra **`/gestao/aprovacoes`** onde já resolve “pendentes por etapa”; adicionar, se necessário ao critério de filtros “equivalentes a §8”, **vista admin/RH ampliada** (ex.: mesma lista com multi‑`statuses` + colunas RM) **dentro do shell `/rh/contratacoes/aprovacoes`** **ou** deep‑link + query string — o planner escolhe a opção com menos duplicação de componentes desde que permissões diferenciem papel | `GET /api/aprovacoes/...`; etapas `SolicitacaoAprovacaoEtapa` |
| **RH (pós‑RM / SEL)** | Fila RM + erro + retentativa já visível ao gestor; aqui incluir **filtros SEL** (**D‑SEL‑xx**), vínculo **Vaga**/matching, timeline | `GET` detalhe + novos endpoints SEL |

**Novas permissões (Next + seeds):**

- **`rh.contratacoes.triagem`** — apenas fila+ações triagem solicitacao vaga aumento HC.
- **`rh.contratacoes.view`** — leituras amplas (operador RH ops).
- **`rh.contratacoes.selecao`** — transições SEL + indicações + encerramentos (pode agrupar com `.view` no perfil RH “full”; o planner corta por granularidade real necessária).

Manter **`RequireModule("recrutamento")`** no controller de solicitações **ou** alinhar política de módulo na planificação (não bloquear esta decisão de produto aqui).

### D‑UIT‑03 — Estado e filtros §8 (+ RM erro)

Reutilizar **`SolicitacaoStatus`** + campos **`rm*`** já no DTO. O ecra deve expor filtros rápidos alinhados a **`solicitacaoVagaStatusUi`** (expandir onde faltar para novos valores **D‑SEL‑01**). Estados RM de erro já cobertos (**`ErroIntegracaoRm`**, **`AguardandoReprocessamentoRm`**) fazem parte da jornada **RH**.

### D‑SEL‑01 — Passagem a **Em processo seletivo** (**CA11**)

- **Pré‑condição (bloqueante):** Solicitação com **cenário válido pós‑RM** — mesmo critério prático já usado no serviço para integração (ex.: presença de vínculo RM / `VagaId` / status que o **planner** extrai de `SolicitacaoVagaService` após leitura do código; documentar tabela “de → para” no **PLAN**).
- **Transição:** Novo valor de enum **`EmProcessoSeletivo`** (nome JSON estável = nome do membro enum). Implementação em **`SolicitacaoVagaService`** + registos em **`StatusHistoricoService`**.
- **IRM:** onde houver atualização parametrizável de CODSTATUS ligada a esse passo, alinhar com **`RmRequisicaoStatusMap`** / trabalho já feito na Fase 4; caso write‑back RM não aplicável — **GAP** na VERIFY sem bloquear o estado portal.

### D‑SEL‑02 — Compatíveis / banco de talentos (**CA12**)

- **Fonte de `vagaId` para matching:** `SolicitacaoVaga.VagaId` já existente; quando preenchido, reutilizar **fluxo `MatchingScreen` / rankings** já existentes (query `vagaId` na URL, ver `matchingHelpers`).
- MVP: entrada “Ver compatíveis” no detalhe da solicitação **abre** matching com esse id (ou embutido em iframe de experiência — planner decide). Se **`VagaId` nulo**, mostrar **estado vazio explicativo** (não inventar vaga).
- Filtros “perfil/competências da solicitação”: reutilizar **filtros API de matching** já existentes; extensões mínimas só se o contrato atual não permitir.

### D‑SEL‑03 — Sugestões / indicações internas (**CA13**)

- **Nova entidade** (`SolicitacaoVagaIndicacao` ou nome equivalente): FK **`SolicitacaoVaga`**, FK **`Candidato`** (opcional outros metadados: quem indicou, texto, timestamps).  
- → **Migration idempotente** por tenant segundo `CLAUDE.md` (PostgreSQL **`IF NOT EXISTS`** onde aplicável).  
- Não confundir com **`PropostaVaga`** (carta/oferta).

### D‑SEL‑04 — Encerramentos finais (**RN14 / CA14**)

- **`Cancelada`** e **`Reprovada`** já existem — manter uso já definido pela máquina atual.
- **Não usar** apenas o rótulo de UI sobre **`Concluida`** como “Contratação concluída” sem auditoria prévia — no código atual **`Concluida`** marca **terminais administrativos/fluxos aprovação** em ramos específicos; **conflito semântico** com “contrato fechado pós‑seleção”.
- **Decisão:** Introduzir terminal explícito **`ContratacaoConcluida`** (RH marcou seleção/contratação encerrada com sucesso) e **`EncerradaSemContratacao`**, bem como **`Suspensa`** para pausa auditável — todos com **`SolicitacaoStatus`** + histórico.
- Harmonização **`Concluida`** legível vs novo terminal: tratada no PLAN (tabela UX + migration de dados apenas se produto ordenar migração; default **sem migrar registos antigos**).

### D‑AUD — Histórico

Toda transição SEL/Triagem/UI deve usar o pipeline **AUD‑01** existente (**`nameof(SolicitacaoStatus.X)`** ou string estável acordada no serviço).

</decisions>

<code_context>

## Observações do código (baseline)

| Área | Ficheiro / rota | Nota |
|------|-----------------|-----|
| Triagem equivocada no menu | `app/(app)/triagem/page.tsx` → **`TriagemScreen`** | Pipeline **candidatos** — não é UIT‑02 “triagem solicitacao” (**D‑UIT‑01**) |
| Matching / rank | `features/recrutamento/matching/MatchingScreen.tsx` + `matchingHelpers` | SEL‑02: link com `vagaId` (**D‑SEL‑02**) |
| Solicitações + triagem RM | `SolicitacoesVagaController` — `/api/solicitacoes-vaga/.../triagem/*` | UI triagem deve chamar diretamente estes endpoints |
| Aprovadores “minha pilha” | `AprovacoesController` — `/api/aprovacoes` ; UI `gestao/aprovacoes` | UIT‑02 aprovação (**D‑UIT‑02**) |
| Estados atuais | `Domain/Enums/SolicitacaoStatus.cs` | SEL exige expansão (**D‑SEL‑04**, **D‑SEL‑01**) |
| Sidebar | `permissionManifest.ts` | Novas entradas **RH Contratações** com keys **D‑UIT‑02** |

</code_context>

<canonical_refs>

## Referências canónicas

- `.planning/ROADMAP.md` — **Fase 6**
- `.planning/REQUIREMENTS.md` — **UIT‑02**, **SEL‑01…04**
- `.planning/phases/05-ui-gestor/05-CONTEXT.md` — deferral triagem (**D‑06**)
- `RHPortal.Api/Controllers/SolicitacoesVagaController.cs`
- `RHPortal.Api/Application/SolicitacoesVaga/SolicitacaoVagaService.cs`

</canonical_refs>

<deferred>

## Ideias adiadas

- Rename global “Pipeline” / i18n (baixa urgência vs funcionalidade).
- Automações RM write‑heavy além dos mecanismos já existentes (depende spike roadmap).
- E2E Playwright.

</deferred>

---

*Phase slug: `06-ui-operacoes-rh-selecao` · Próximo passo sugerido: **`/gsd-plan-phase 6`***
