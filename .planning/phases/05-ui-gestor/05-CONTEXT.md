# Phase 5 — UI Gestor — Context

**Gathered:** 2026-04-30 (`$gsd-discuss-phase 5` — sessão Cursor; `gsd-sdk`/workflow local não invocado)  
**Status:** Pronto para **plan-phase** (decisões abaixo guiam pesquisa/planejamento; confirmado produto: menu via painel; mobile em página.)

<domain>

## Phase boundary (fixa pelo ROADMAP)

**Goal:** Fluxo ponta‑a‑ponta UX **gestor** completo (**UIT‑01**) — formulário/abas **7.*** (`REQUIREMENTS` / história CA), validações espelhando servidor, **rascunho** que sobrevive refresh, checklist manual **CA01‑CA06** (pré‑RM) documentado na verificação.

**Explicitamente fora:** triagem/RH workspaces completos (**Fase 6** — UIT‑02 / SEL), E2E automatizado Playwright (não citado nos critérios desta fase), Owner/admin RM (já coberto em fases anteriores).

**Carregamento de fases anteriores (não reabrir):**

- Agregado e máquina de estados **`SolicitacaoVaga`** + fluxo **Aumento de quadro** pré‑RM → **02-CONTEXT** (D‑01…D‑07).
- Criação RM + vínculo + falhas → **03-CONTEXT** (UI gestor só consome DTOs e ações expostas).
- Sync CODSTATUS + mapas + colunas RM na API → **04-CONTEXT** / implementação (UI deve exibir campos RM quando presentes e respeitar labels de erro amigáveis já previstos na API).

</domain>

<decisions>

## Decisões de implementação (para pesquisa + PLAN)

### D‑01 — Superfícies Next canônicas

- **Lista + CRUD gestor** da requisição de pessoal: evoluir o ecrã existente **`SolicitacoesScreen`** (`LioTecnica.Web.Next/src/features/gestao/solicitacoes/SolicitacoesScreen.tsx`) e o **`SolicitacaoFormModal`** (desktop) como **fonte principal** dos campos/abas do formulário — ver **D‑08** para mobile.
- **Painel unificado** (`PainelSolicitacoesScreen`, `/gestao/painel-solicitacoes`) é a **entrada única no menu lateral** (“Painel de Solicitações”). Não criar segundo item de menu só para requisição de pessoal.
- O painel inclui **CTA / atalho** para a vista completa de requisições de pessoal quando o gestor precisar da grelha e fluxos longos (ex. botão “Abrir lista de contratações / requisições”, link para **`/gestao/solicitacoes`** ou navegação in‑app equivalente).
- Linha **Contratação** no painel: paridade com a API **`/api/solicitacoes-vaga`**; alinhar badges, estados triagem e ações com **`SolicitacoesScreen`** — uma única verdade.

### D‑02 — Rota `/gestao/solicitacoes`

- **Hoje:** `src/app/(app)/gestao/solicitacoes/page.tsx` faz **`redirect("/dashboard")`**.
- **Decisão:** Remover redirect; renderizar **`SolicitacoesScreen`** com guard `gestao.dashboard` (mesmo stack que outras rotas `/gestao/*`). Esta rota existe para **lista completa + deep links**, alcançável **a partir do painel** — **sem** entrada extra no **`permissionManifest` / `NavegacaoManifest`**.

### D‑03 — Rascunho e refresh (critério ROADMAP #2)

- **Fonte de verdade:** estado **Rascunho** persistido **no servidor** via API existente (criar/atualizar solicitação); após F5 o cliente **recarrega** o rascunho pelo `GET` detalhe/lista.
- **Comportamento UX:** ao abrir fluxo de edição com `editId`, sempre **refetch** antes de mostrar campos (evita dados stale — aplicável tanto a página mobile como a modal desktop).
- **Backup local (localStorage):** **fora do escopo mínimo** desta fase; entraria como melhoria se CA exigir trabalho offline — registrar em *Deferred* se surgir no verify.

### D‑04 — Validações “paralelas ao servidor” (critério ROADMAP #1)

- **Validação espelhada:** mesmas regras obrigatórias e ordem lógica por **secção/aba** que a API aplica (campos, motivo, headcount para `VagaNova`/`AumentoQuadro` conforme contratos). O cliente pode antecipar erros com mensagens em **pt‑BR** alinhadas ao texto de `ProblemDetails` / validação ASP.NET quando possível.
- **Não duplicar lógica de negócio opaca no cliente:** onde a regra for complexa, **submeter** e mapear erro → campo/aba (padrão já usado com `toast` + HTTP body).

### D‑05 — Estados de workflow na UI (triagem + RM read‑only)

- Alinhar **badges e labels** com **`SolicitacaoStatus`** (nomes enum e valores) para todos os estados já usados na API, incluindo: **`PendenteTriagem`**, **`EmTriagem`**, **`DevolvidaTriagemGestor`**, **`PendenteIntegracaoRm`**, **`ErroIntegracaoRm`**, **`AguardandoReprocessamentoRm`** — hoje `STATUS_MAP` em `SolicitacoesScreen` **não cobre** estes; é **entregável explícito** da Fase 5.
- Exibir no detalhe (e opcionalmente na grelha) campos **RM** quando a API os enviar (`rmRequisicaoCodigo`, `rmCodStatus`, `rmUltimaStatusDescricaoRm`, `rmStatusSyncUltimaMensagem`, `rmUltimaSincronizacaoUtc` — nomes camelCase JSON), sem permitir edição pelo gestor salvo ações já expostas pela API (ex. reprocessamento se existir endpoint).

### D‑06 — Ações do gestor por estado (pré‑RM + pós fluxo conhecido)

- **Gestor** pode: criar rascunho, editar em **Rascunho** / **AjustesNecessarios** / **DevolvidaTriagemGestor**, submeter para triagem, cancelar onde a API permitir, e acompanhar etapas via **`AcompanhamentoModal`** / `etapasFluxo`.
- **Não implementar** nesta fase um “console de triagem” completo para o papel RH — apenas garantir que o **gestor vê** estados e mensagens corretas quando a triagem devolve ou avança (paridade com Fase 2).

### D‑07 — Checklist CA01‑CA06 (critério ROADMAP #3)

- Produzir durante **verify-work** / fecho de fase um artefacto **markdown** (ex. secção em `05-VERIFY.md` ou `05-SUMMARY.md`) com passos manuais reprodutíveis — **não** exige Playwright nesta fase.

### D‑08 — Mobile: formulário em página completa

- Em **viewport estreita** (breakpoint operacional típico: abaixo de `md`; o plano pode fixar valor exato), **não usar `Dialog`/modal** para criar/editar solicitação; usar **página dedicada** (ex.: `app/(app)/gestao/solicitacoes/nova`, `…/[id]/editar` — nomes são sugestão; o planner confirma estrutura) reutilizando o mesmo conteúdo de formulário já existente como componente partilhado.
- Desktop: pode manter **modal** atual ou mover para página — **livre ao planner**, desde que mobile cumpra página completa.

</decisions>

<code_context>

## Observações do código (baseline)

| Área | Ficheiro / rota | Nota |
|------|-----------------|------|
| Form + grelha | `features/gestao/solicitacoes/SolicitacaoFormModal.tsx`, `SolicitacoesScreen.tsx` | Base forte; falta paridade de estados triagem/RM e rota |
| Rota quebrada | `app/(app)/gestao/solicitacoes/page.tsx` | Redirect para dashboard — corrigir (D‑02) |
| Painel agregado | `features/gestao/painel-solicitacoes/PainelSolicitacoesScreen.tsx` | Tab Contratação + CTA para lista; parsing status legado → alinhar enum |
| Aprovações | `features/gestao/aprovacoes/AprovacoesScreen.tsx` | Consome mesmo detalhe — verificar badges ao alinhar `SolicitacaoStatus` |
| Permissions | `features/navigation/permissionManifest.ts` | Sem novo item lateral; apenas evoluir UI no painel + rotas em `/gestao/solicitacoes/*` |

</code_context>

<canonical_refs>

## Referências canónicas

- `.planning/ROADMAP.md` — **Fase 5 — UI Gestor**
- `.planning/REQUIREMENTS.md` — acceptance **CA01‑CA06**, **RN** aplicáveis à UI pré‑RM
- `.planning/phases/02-api-workflow-pre-rm/02-CONTEXT.md` — fluxo estados gestor/triagem
- `.planning/phases/04-sincronismo-status-rm/04-CONTEXT.md` — exposição DTO sync (complementar UI)
- `RHPortal.Api/.../Contracts/SolicitacoesVaga/SolicitacaoVagaContracts.cs` — contrato resposta/grid
- `RHPortal.Api/.../Controllers/SolicitacoesVagaController.cs` — ações disponíveis

</canonical_refs>

<deferred>

## Ideias adiadas (fora da fronteira da fase)

- **Autosave incremental** tipo debounce a cada campo (custoso; só se CA exigir).
- **localStorage** de emergência para rascunho (D‑03).
- **Playwright E2E** gestor (nova fase ou hardening).

</deferred>

---

## Confirmações produto (**locked** 2026-04-30)

1. **Menu:** única entrada **Painel de Solicitações**; vista completa requisição pessoal via **painel** (atalho/CTA), não segundo item na sidebar.
2. **Mobile:** formulário criar/editar em **página completa**, não modal (ver **D‑08**).

---

*Phase slug: `05-ui-gestor` · Próximo passo sugerido: `$gsd-plan-phase 5`*
