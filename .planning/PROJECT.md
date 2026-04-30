# Voltage RenderRH (Portal RH)

## What This Is

Portal de RH multi-tenant que centraliza experiência para colaboradores, gestores e equipe de RH, com dados por tenant em banco próprio e integração com **TOTVS RM**. Além do ciclo legado de **vagas publicadas**, **candidatos** e **matching**, o produto entrega o fluxo **SolicitacaoVaga**: gestor pede **aumento de quadro**, triagem e aprovações no portal, **criação da requisição no RM** após aprovação, **sincronismo de status**, auditoria em timeline, e **workspaces RH** para processo seletivo pós-RM (SEL, indicações, permissões `rh.*`).

## Core Value

O RH e os gestores precisam de **uma entrada única, auditável e alinhada ao RM** para abertura e acompanhamento de vagas, sem substituir o RM como fonte oficial da requisição.

## Requirements

### Validated

- ✓ Portal multi-tenant com Identity e banco por tenant — *baseline codebase*
- ✓ Entidade **Vaga** com **VagaStatus** para vagas/recrutamento público existente — *baseline*
- ✓ Módulo de **candidatos**, preferências de vaga e **matching candidato ↔ vaga** — *baseline*
- ✓ **Leitura** de lista/detalhes de requisições RM — *baseline*
- ✓ Gestão de propostas (carta/oferta digital) ligada a vaga+candidato — *baseline*
- ✓ **v1.0 — SolicitacaoVaga**: domínio, workflow pré-RM, criação RM, sync CODSTATUS, histórico auditável — *Phases 1–4*
- ✓ **v1.0 — UIT-01**: jornada gestor Next (formulário, rascunho, validações alinhadas API) — *Phase 5*
- ✓ **v1.0 — UIT-02 / SEL**: workspaces `/rh/contratacoes/*`, permissões JWT, estados SEL, indicações — *Phase 6*

### Active

- [ ] Próximo milestone (**v1.1+**): definir com `$gsd-new-milestone` (ex.: hardening RM piloto, SEL-02 profundo, E2E Playwright, BPM FUT-01, etc.)

### Out of Scope

- Substituir o RM como sistema oficial de custos/orçamento/requisição (Portal é camada de entrada e acompanhamento)
- Garantia de parametrização fixa dos códigos RM — mapping deve ser **configurável por ambiente/cliente**
- Fluxos de aumento de quadro **automáticos por outro ERP** sem RM (deferir até haver segunda integração)
- Publicação externa automatizada da vaga em todos os boards de emprego corporativos (fora RM/Portal neste ciclo salvo já existir canal interno definido pela equipe)

## Current state (after v1.0)

**Shipped:** Milestone **v1.0** (2026-04-30). Ver [.planning/MILESTONES.md](./MILESTONES.md) e arquivos em `.planning/milestones/v1.0-*`.

**Stack:** ASP.NET Core, EF Core, PostgreSQL por tenant; RM via **Microsoft.Data.SqlClient**; Next.js app com `output: export` onde aplicável.

**Next milestone goals:** A definir — começar por `$gsd-new-milestone`.

## Context

- Documento de produto autoritativo do **v1.0** está refletido nos archivos `v1.0-REQUIREMENTS.md` e fases `01`–`06`.
- **`SolicitacaoVaga`** é o agregado do fluxo gestor→RM (decisão locked — ver Key Decisions).

## Constraints

- **Multi-tenant:** migrações e dados novos seguem modelo tenant e idempotência (`CLAUDE.md`).
- **RM:** mappings parametrizados por cliente/ambiente.
- **Brownfield:** reutilizar padrões de controllers, permissões e rotas Next existentes.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Manter RM como sistema de record da requisição | Produto oficial continua RM; Portal evita drift | ✓ Shipped v1.0 |
| Mapeamento `CODSTATUS` configurável por ambiente | Parametrização real diverge entre clientes RM | ✓ Shipped v1.0 |
| Ciclo **`SolicitacaoVaga`** estendido (não duplicar agregado com **Vaga** pública) | Separação semântica recrutamento vs pedido de abertura | ✓ Shipped v1.0 |
| Permissões operação RH via claims **`rh.*`** + **`HasPermission`** | Jornadas triagem/aprovação/RH separadas sem só Admin/RH role | ✓ Shipped v1.0 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each milestone** (`$gsd-complete-milestone`): full review of sections; move shipped scope to **Validated**; refresh **Active** for the next milestone.

---

*Last updated: **2026-04-30** after milestone **v1.0** archive.*
