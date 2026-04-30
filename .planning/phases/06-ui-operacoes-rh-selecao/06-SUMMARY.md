# Fase 6 — Resumo da execução (UI Operações RH + seleção · UIT‑02, SEL‑*)

**Data:** 2026-04-30

## Objetivo alcançado (roadmap)

Workspaces **`/rh/contratacoes/*`** (triagem e seleção), bypass seguro de listagem/detalhe por **`HasPermission`** / claims JWT (**`rh.contratacoes.view|triagem|selecao`**), fluxos **SEL** no domínio (**novos `SolicitacaoStatus`**, transições com histórico), entidade **`SolicitacaoVagaIndicacao`** + migração EF, alinhamento **sync RM** (ranks/terminais), API e **Next** (detalhe com export estático), **manifests** API + **`permissionManifest.ts`**, e **`ModuleCatalog`** com prefixo **`rh.`**.

## Entregues (resumo)

1. **Domínio/API** — SEL: iniciar/suspender/retomar/encerrar/concluir; indicações CRUD; `ICurrentUserContext.HasPermission`; permissões em **`RolePermissionManifest`**.
2. **Next** — `RhContratacoesListScreen` / `RhContratacaoDetailScreen`; rotas **`triagem`**, **`selecao`**, **`[id]`** + `generateStaticParams`; badges **17–20** em **`solicitacaoVagaStatusUi`**.
3. **Navegação** — Itens restaurados/adicionados (Solicitações/Aprovações destaque, Painel RH, SLA Vagas, logs admin); matching → **`/assistente-ia`** nos testes/manifesto.

## Build / testes

- **`dotnet test`** RHPortal.Api.Tests — verde.
- **`npm run build`** — verde.

## Verificação

- Checklist: [06-VERIFY.md](./06-VERIFY.md).
- UAT conversacional: [06-UAT.md](./06-UAT.md) — **7/7 pass**, 2026-04-30.

## Ligações

- [06-CONTEXT.md](./06-CONTEXT.md) · [06-PLAN.md](./06-PLAN.md) · [ROADMAP Fase 6](../../ROADMAP.md)
