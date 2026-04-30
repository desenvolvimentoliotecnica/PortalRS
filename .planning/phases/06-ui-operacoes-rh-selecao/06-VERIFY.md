# Phase 06 — Verification (post-implementation)

**Focus:** RH contratações shell (`/rh/contratacoes/*`), permissões JWT `rh.*`, SEL + indicações, navegação e paridade manifests.

## Automated

- `dotnet build RHPortal.Api/RHPortal.Api/RHPortal.Api.csproj`
- `dotnet build RHPortal.Api/RHPortal.Api.Tests/RHPortal.Api.Tests.csproj`
- `dotnet test RHPortal.Api/RHPortal.Api.Tests/RHPortal.Api.Tests.csproj`
- `npm run build` in `LioTecnica.Web.Next`

## Manual / UAT (high level)

| Area | Check |
|------|--------|
| **Nav** | Itens Solicitações / Aprovações / Painel RH / SLA Vagas aparecem com permissões corretas; RH triagem/seleção com `rh.contratacoes.*` |
| **Triagem RH** | Lista respeita `rh.contratacoes.triagem` (ou `*`) |
| **Seleção** | SEL: iniciar a partir `EmIntegracao` com RM OK; suspender/retomar; encerrar s/ contratação / concluída com histórico |
| **Indicações** | CRUD indicações na solicitação; permissões de mutação `rh.contratacoes.selecao` |
| **Detalhe** | `/rh/contratacoes/[id]` abre estático (`generateStaticParams` placeholder) + AuthGuard cliente |
| **Matching** | Link para matching/assistente conforme decisão produto (`/assistente-ia` no manifest) |

## Notes

- **`ModuleCatalog`:** prefixo `rh.` mapeado para módulo `recrutamento` para todas as permissões RH operação.
- **`NavegacaoSidebarService`:** módulos standalone desligados pelo tenant são **omitidos** do sidebar (sem item bloqueado) — coberto pelo teste `Build_ModuloStandaloneDesativado_*`.
