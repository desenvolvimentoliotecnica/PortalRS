# Fase 5 — Resumo da execução (UI Gestor · UIT‑01)

**Data:** 2026-04-30

## Objetivo alcançado (roadmap)

Fluxo **gestor** ponta a ponta na stack Next: lista e formulário alinhados à API **`SolicitacaoVaga`**, estados **triagem / RM** visíveis com uma única fonte de verdade para badges, validações cliente espelhando regras críticas do servidor, **rascunho** via API com **refetch** ao abrir edição, UI **mobile** em página cheia onde exigido, e documentação manual **CA01–CA06** em **05‑VERIFY.md**.

## Entregues (front)

1. **`solicitacaoVagaStatusUi.tsx`** — normalização de status (string/número), labels/ícones/cores para todos os membros relevantes de **`SolicitacaoStatus`** até **AguardandoReprocessamentoRm**; helpers para painel (KPI / atraso / placeholder de etapa).
2. **`PainelSolicitacoesScreen`** — CTA para **`/gestao/solicitacoes`**; tab Contratação sem remap legado 5↔6; badges via módulo partilhado.
3. **`SolicitacoesScreen`** + rota **`/gestao/solicitacoes`** (sem redirect); **Suspense** por `useSearchParams`; filtros/kanban considerando triagem/RM; bloco **RM somente leitura** no detalhe quando DTO trouxer **`rm*`**; **`reloadNonce`** no modal para refetch ao reabrir edição.
4. **`SolicitacaoForm.tsx`** (core) + **`SolicitacaoFormModal.tsx`** (wrapper `Dialog`); validação extra (**justificativa** com aumento definitivo de HC); tratamento de erro **PUT** com toast e sugestão de aba via corpo MVC/ProblemDetails quando possível.
5. **Mobile** (`matchMedia` ≤767px): **`/gestao/solicitacoes/nova`**, **`/gestao/solicitacoes/editar?id=…`** (+ `resubmit=1`); **`sessionStorage`** para pré-preenchimento a partir do quadro de vagas; **`copyFrom`** na query para cópia.
6. **`AprovacoesScreen`** — detalhe de contratação com **`SolicitacaoVagaStatusBadgeEl`** (evita `Number(status)` incorreto).
7. **Hook** `useMobileSolicitacaoFormPreferred`.

## Build

- **`npm run build`** em **`LioTecnica.Web.Next`** com **`output: "export"`** — rotas estáticas **`/gestao/solicitacoes`**, **`/nova`**, **`/editar`** sem segmento dinâmico `[id]` (requisito do export).

## Verificação

- Checklist manual: [05-VERIFY.md](./05-VERIFY.md).
- UAT completo **CA01–CA06** permanece responsabilidade de quem tem ambiente com dados/seed (registo em **05‑VERIFY**).

## Ligações

- [05-CONTEXT.md](./05-CONTEXT.md) · [05-PLAN.md](./05-PLAN.md) · [ROADMAP Fase 5](../../ROADMAP.md)
