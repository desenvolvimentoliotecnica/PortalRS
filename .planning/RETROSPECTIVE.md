# Retrospective — RenderRH Portal

Living notes across milestones. Append new milestone sections above **Cross-Milestone Trends**.

## Milestone: v1.0 — Abertura de vaga + RM

**Shipped:** 2026-04-30  
**Phases:** 6  

### What was built

SolicitacaoVaga end-to-end (domain, workflow, RM create/sync, gestor UI, RH seleção UI), permissões `rh.*`, SEL + indicações, manifests de navegação alinhados, testes e build verdes, UAT Fase 6 7/7.

### What worked

- Planeamento por fases com CONTEXT/PLAN/SUMMARY + VERIFY/UAT rastreável.
- Brownfield: reutilização de Identity, multi-tenant EF, padrões Next existentes.

### What was inefficient

- Checkboxes em `REQUIREMENTS.md` vivo não acompanharam o dia-a-dia — corrigido apenas no arquivo v1.0.
- Alguns testes de navegação exigiram realinhar manifest com rotas reais (`/assistente-ia`, itens restaurados).

### Key lessons

- Prefixos `ModuleCatalog` devem cobrir novas permission keys (`rh.`) para `ModuleScreensResolver` e gates de sidebar.
- Rotas dinâmicas com `output: export` precisam de `generateStaticParams` no servidor mesmo quando a página é essencialmente cliente.

---

## Cross-Milestone Trends

| Milestone | Duration (calendar) | Phases | Notes |
|-----------|---------------------|--------|-------|
| v1.0 | 2026-04-30 | 6 | First formal GSD milestone shipped |

---

*Created: 2026-04-30 — milestone v1.0 close.*
