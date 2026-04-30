# Voltage RenderRH (Portal RH)

## What This Is

Portal de RH multi-tenant que centraliza experiência para colaboradores, gestores e equipe de RH, com dados por tenant em banco próprio e integração pontual com sistemas corporativos (ex.: TOTVS RM via SQL Server). O produto atual já contempla ciclo de **vagas publicadas**, **candidatos** e ferramentas de **matching**, além de leitura de requisições RM para administração.

## Core Value

O RH e os gestores precisam de **uma entrada única, auditável e alinhada ao RM** para abertura e acompanhamento de vagas, sem substituir o RM como fonte oficial da requisição.

## Requirements

### Validated

- ✓ Portal multi-tenant com Identity e banco por tenant — *baseline codebase*
- ✓ Entidade **Vaga** com **VagaStatus** para vagas/recrutamento público existente — *baseline*
- ✓ Módulo de **candidatos**, preferências de vaga e **matching candidato ↔ vaga** — *baseline*
- ✓ **Leitura** de lista/detalhes de requisições RM (SqlClient / serviços `Rm*` ) — *baseline*
- ✓ Gestão de propostas (carta/oferta digital) ligada a vaga+candidato — *baseline*

### Active

- [ ] Fluxo gestor **abrir nova vaga** focado em **aumento de quadro**, com formulário estruturado completo e validações
- [ ] **Workflow portal**: rascunho → triagem → devoluções → aprovações internas antes de qualquer RM
- [ ] **Criação de requisição no RM após aprovação**, armazenamento do código/id retornado e estados de falha/reprocessamento
- [ ] **Sincronização de status** entre RM (`CODSTATUS` e parametrização) e status semânticos do portal
- [ ] **Histórico auditável** de transições, integrações e aprovações
- [ ] **Participação RH** no pós‑RM (processo seletivo) incluindo apoio a **banco de talentos**, **consulta compatível**, **sugestões/indicações internas** dentro do escopo MVP deste milestone

### Out of Scope

- Substituir o RM como sistema oficial de custos/orçamento/requisição (Portal é camada de entrada e acompanhamento)
- Garantia de parametrização fixa dos códigos RM — mapping deve ser **configurável por ambiente/cliente*
- Fluxos de aumento de quadro **automáticos por outro ERP** sem RM (deferir até haver segunda integração)
- Publicação externa automatizada da vaga em todos os boards de emprego corporativos (fora RM/Portal neste ciclo salvo já existir canal interno definido pela equipe)

## Current Milestone: v1.0 Abertura de vaga — Aumento de quadro + RM

**Goal:** Gestor autorizado solicita abertura de vaga para aumento de quadro pelo portal; a solicitação passa por triagem e aprovação; após aprovação é criada a requisição no TOTVS RM; o portal mantém vínculo e reflete status, com recuperação em falhas e auditoria completa.

**Target features:**

- Formulário e API de solicitação (dados gerais, técnico, negócio, comportamental, financeiro/org) conforme política RN01–RN05
- Máquina de estados e papéis: gestor, triagem, approvers, RH
- Serviço de **escrita**/criação da requisição no RM após RN06; persistência vínculo + tentativas (RN07, RN09)
- Jobs ou consultas para **RN08** com tabela/param de mapeamento `CODSTATUS` ↔ status portal (história observa ambiente real)
- UI Next.js espelhando fluxo e statuses da história; integração navegação/perfis já usados pelo portal
- Extensões RH para etapas CA11–CA14 reutilizando `Candidato` / scoring onde aplicável ou contratos MVP explícitos

## Context

- Stack: ASP.NET Core, EF Core, PostgreSQL por tenant (`AppDbContext`); RM via **Microsoft.Data.SqlClient** (bases existentes de leitura).
- **`Vaga` / `VagaStatus` atuais** modelam ciclo da vaga já “no ar” no recrutamento; o novo fluxo provavelmente exige **novo agregado** (ex.: solicitação de abertura) ou extensão cuidadosa para não misturar “vaga público” com “ticket de aumento quadro até integrar RM”.
- Documento de produto autoritativo neste ciclo é a história enviada (campos obrigatórios, statuses e RNs CA01–CA14).

## Constraints

- **Multi-tenant:** toda migração e dado novo deve seguir modelo tenant e regras de idempotência do projeto (`CLAUDE.md`).
- **RM:** comportamento da API/SQL deve respeitar instalação cliente; mappings de status parametrizados, não fixos apenas na tabela da história.
- **Brownfield:** reutilizar padrões de controllers, permissões (`permissionManifest`/API), Next app routes já adotados.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Manter RM como sistema de record da requisição | Produto oficial continua RM; Portal evita drift | ✓ Planned |
| Mapeamento `CODSTATUS` configurável por ambiente | Parametrização real diverge entre clientes RM | ✓ Planned |
| Ciclo **`SolicitacaoVaga`** (existente) estendido; não duplicar com novo agregado | `Vaga` pública/recrutamento ≠ solicitação gestor→RM — já há entidade própria no código | ✓ Locked (Phase 1 discuss — ver `01-CONTEXT.md`) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):

1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):

1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

*Last updated: 2026-04-30 after milestone v1.0 bootstrap — Abertura de vaga RM*
