# Fase 4 — Resumo da execução (sincronismo status RM ⇄ Portal · SYN‑01…SYN‑03)

**Data (fecho artefato):** 2026-04-30

## Objetivo alcançado (roadmap)

Parametrizar **`CODSTATUS`** RM ↔ **`SolicitacaoStatus`** no portal; persistir metadados de última sincronização e mensagens de erro de sync; expor dados nos **DTOs**; permitir disparo sob demanda e ciclo opcional em background (**HostedService**), com **`RmSyncRun`** para observabilidade (alinhado a **04‑CONTEXT** / **04‑PLAN**).

## Entregues (síntese técnica)

1. **Modelo EF + migration tenant** (`IF NOT EXISTS`): colunas em **`SolicitacaoVaga`** para última mensagem de sync de status (**`RmStatusSyncUltimaMensagem`**) e snapshot textual RM (**`RmUltimaStatusDescricaoRm`**, conforme decisão CONTEXT).
2. **Leitura RM por vínculo** (`RmRequisicaoCodigo`): queries/serviço dedicados (**`RmRequisicoesQueries`**, **`IRmRequisicoesReadService`**, implementação); regra **`STUB-*`** sem round-trip SQL (gap controlado).
3. **`ISolicitacaoVagaRmCodStatusSyncService`** (ou nome final adotado): resolução via **`RmRequisicaoStatusMap`**, guardas em estados terminais, atualização de campos crus + timestamps, integração com **`IRmSyncRunService`** para lotes (**`RmSyncRun`** / entidade de catálogo estável para painel Owner).
4. **API**: endpoint(’s) para sync manual em lote; **CRUD admin** do mapa status RM ↔ portal; **`IntegracaoTotvs` / appsettings / `Program.cs`** registados conforme plano (opções nomeadas, DI).
5. **`IHostedService`** opcional (intervalo + **Enabled** em config) para sync periódico.
6. **DTOs / contratos API**: campos **`rm*`** e mensagens de sync refletidos em responses de grid/detalhe (**SYN‑02 / SYN‑03**).
7. **Testes unitários** focados em resolver/parser e fluxos críticos (filtro `SolicitacaoVagaServiceTests` ou equivalente documentado no commit da fase).

## Verificação

- Evidência operacional: painel Owner / endpoint de sync e mapas utilizáveis por tenant; RM real ou stub conforme ambiente.
- Regressão **Fase 3** (criação RM / `RmRequisicaoCreateClient`) mantida fora do escopo de alteração desta fase.

## Lacunas / follow-ups (não bloqueiam fecho F4)

- Webhook push RM (**Deferred** em **04‑CONTEXT**).
- Afinar comparador “anti-regresso” de status se a máquina de estados exigir granularidade adicional em produção.

## Ligações

- [04-CONTEXT.md](./04-CONTEXT.md) · [04-PLAN.md](./04-PLAN.md) · [ROADMAP Fase 4](../../ROADMAP.md)
