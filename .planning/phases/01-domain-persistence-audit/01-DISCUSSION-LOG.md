# Phase 1: Domínio, persistência e auditoria — Discussion Log

> **Audit trail only.** Planning/research deve usar apenas `01-CONTEXT.md`.

**Date:** 2026-04-30  
**Phase:** 1 — Domínio, persistência e auditoria  
**Areas discussed:** Agregado; Status; Persistência formulário §7.x; SYN schema; Auditoria  
**Note:** Discussão realizada por **scout do codebase + defaults recomendados** (workflow sem `gsd-sdk` / sem seleção interativa de gray areas nesta sessão).

---

## Agregado: novo modelo vs SolicitacaoVaga existente

| Option | Description | Selected |
|--------|-------------|----------|
| Novo agregado `SolicitacaoAberturaVaga` paralelo | Evita mexer legado | |
| Estender **`SolicitacaoVaga`** | Reusa integração, service, FK `VagaId`, auditoria existente | ✓ |

**User's choice:** Aplicado default recomendado após revisão código (entidade já satisfez ROADMAP com extensões).  
**Notes:** Correção importante vs rascunho inicial em PROJECT.md (“novo agregado”).

---

## Estados §8 vs `SolicitacaoStatus`

| Option | Description | Selected |
|--------|-------------|----------|
| Substituir enum inteiro | Quebra migrações e dados legados | |
| Extensão aditiva + mapeamento UX | Mantém dados; acrescenta triagem / RM granular | ✓ |

**User's choice:** Default técnico.  
**Notes:** Granularidade exata (reuso `AjustesNecessarios` vs novo valor) ficou sob ** discretion** no CONTEXT.

---

## Campos volumosos (requisitos técnicos/listas)

| Option | Description | Selected |
|--------|-------------|----------|
| Uma coluna por campo da história | Explosão de schema | |
| Coluna **`jsonb` versionada** + colunas já existentes | Migra rápido; API valida tipo na Fase 2 | ✓ |

---

## Mapeamento RM `CODSTATUS`

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcode em C# apenas | História §9 exige parametrização | |
| Tabela tenant configurável (`RmRequisicaoStatusMap`) | ✓ |

---

## Auditoria RN10 / AUD-01

| Option | Description | Selected |
|--------|-------------|----------|
| Nova tabela genérica apenas para solicitações | Possível sob demanda | |
| Reuso **`StatusHistoricoService`** + campos tentativa RM existentes | ✓ |

---

## the agent's Discretion

- Nomes finais (`RequisitosDetalhadosJson` vs outros).  
- Lista exata novos enums `SolicitacaoStatus` após grooming com Produto/RH.

## Deferred Ideas

Mecânismo gravar RM; sync job; BPM gráfico.
