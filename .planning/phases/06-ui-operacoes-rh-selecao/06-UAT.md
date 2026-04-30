---
status: complete
phase: 06-ui-operacoes-rh-selecao
source: 06-VERIFY.md, 06-PLAN.md (06-SUMMARY.md absent — derived from shipped scope)
started: 2026-04-30T12:00:00Z
updated: 2026-04-30T15:25:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Clean build — API tests green, Next production build green; optional cold API boot OK
result: pass

### 2. Navegação RH contratações
expected: Sidebar (ou manifest BFF) mostra entradas coerentes com permissões — incl. triagem/seleção RH (`rh.contratacoes.*`) e itens restaurados (Solicitações, Aprovações, Painel RH, SLA Vagas) quando o utilizador tem as claims certas
result: pass

### 3. Triagem RH — lista
expected: Em `/rh/contratacoes/triagem`, utilizador com `rh.contratacoes.triagem` (ou `*`) vê lista alargada de solicitações conforme regra de serviço; sem permissão adequada não acede ao mesmo conjunto
result: pass

### 4. Seleção — estados SEL
expected: Em seleção (UI + API), a partir de pré-condições válidas (`EmIntegracao`, RM OK, `VagaId`): iniciar processo seletivo; suspender/retomar; encerrar sem contratação / marcar contratação concluída com observação onde aplicável; histórico/timeline reflete mudanças
result: pass

### 5. Indicações na solicitação
expected: Na ficha de solicitação em contexto de seleção: listar, adicionar e remover indicações internas; mutações exigem `rh.contratacoes.selecao` (ou equivalente admin)
result: pass

### 6. Detalhe `/rh/contratacoes/[id]`
expected: Abrir detalhe por ID abre ecrã protegido por AuthGuard; dados carregam para utilizador autorizado; export estático não impede navegação cliente ao ID real
result: pass

### 7. Matching / Assistente IA
expected: A partir do detalhe ou navegação, link ou fluxo leva ao assistente/matching conforme produto (`/assistente-ia` no manifest); página abre para utilizador com `matching.view` quando aplicável
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

(none)
