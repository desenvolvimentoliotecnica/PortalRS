# Handoff — Claude Code (2026-04-17)

Documento de retomada rápida para continuidade no Claude Code.

## Estado atual consolidado

- API tests estabilizados: `425/425` passando.
- Bateria smoke (`__scripts__/test-battery.sh`): `59 total`, `50 pass`, `0 fail`, `9 skip`.
- Erro de logs no Owner resolvido com endpoints proxy em `OwnerController`:
  - `/api/owner/tenants/{tenantId}/config/logs/*`
  - `/api/owner/tenants/{tenantId}/config/operational-logs/*`
- Ajustes de UX no modal de logs aplicados (modo de leitura horizontal ampliada).
- Knowledge Base da sidebar criada e expandida:
  - `knowledge-base/sidebar-blocos-e-abas.md`

## Decisões recentes importantes

- Manter frontend Owner de logs como está e garantir compatibilidade pelo backend (proxy).
- Separação de responsabilidades preservada:
  - Owner: governança/entitlements/suporte.
  - Admin do tenant: operação diária.
- Módulos continuam filtrando principalmente menu/UI; gate HTTP por módulo permanece como fase 2.

## Pendências prioritárias

1. **Módulos fase 2 — Gate backend**
   - implementar bloqueio de rota por módulo desabilitado (`[RequireModule]` ou middleware).
2. **Módulos fase 2 — Bootstrap defaults**
   - aplicar `EnsureDefaultsAsync` para tenants já existentes no startup.
3. **Admin operational logs**
   - alinhar endpoint faltante de `/api/admin/operational-logs`.
4. **Des-hardcode de porta frontend**
   - migrar `3005` para config central (`Frontend:Port`) e revisar referências.
5. **Coerência módulo x sidebar**
   - revisar gaps de prefixos em `ModuleCatalog` (listados no KB da sidebar).

## Onde continuar a análise funcional

- Mapa funcional e auditoria módulo x sidebar:
  - `knowledge-base/sidebar-blocos-e-abas.md`
- Contexto técnico geral:
  - `documentacao.md`
- Histórico cronológico:
  - `diario-de-bordo.md`
- Itens de trabalho:
  - `tasks.md`
  - `backlog.md`

## Regras operacionais obrigatórias

- Atualizar a cada intervenção:
  - `tasks.md`
  - `backlog.md`
  - `diario-de-bordo.md`
  - `changelog.md`
- Quando aprender algo novo de produto/arquitetura:
  - atualizar `documentacao.md` e/ou `knowledge-base/*`.
