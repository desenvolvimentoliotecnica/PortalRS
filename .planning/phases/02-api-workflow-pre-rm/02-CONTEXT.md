# Phase 2: API workflow (pré-RM) — Context

**Gathered:** 2026-04-30  
**Status:** Ready for planning (bootstrap sem discuss-phase dedicado — derivado ROADMAP + código `SolicitacaoVagaService`)

<domain>

## Phase Boundary

Máquina de estados **servidor** para solicitações **`TipoSolicitacaoVaga.AumentoQuadro`**: triagem → eventual devolução ao gestor → fila de aprovações existente (`SolicitacaoAprovacaoEtapa` / `ApproveAsync`), até estado **`Aprovada`** pré-integração RM. **Não implementar** criação de requisição no RM (Fase 3). **Não incluir** Next.js (Fase 5).

Fluxos **`VagaNova`** e **`Substituicao`** mantêm comportamento atual salvo refactors estritamente necessários à partilha de helpers.

</domain>

<decisions>

## Implementation Decisions

- **D-01:** Feature flag de fluxo = **`entity.TipoSolicitacao == AumentoQuadro`** — sem novo campo boolean em `SolicitacaoVaga`.
- **D-02:** Após **`Submit`** bem-sucedido no fluxo aumento quadro → status **`PendenteTriagem`**; **não** criar linhas **`SolicitacaoAprovacaoEtapa`** até a triagem concluir (FLX-01 / separação triagem vs aprovação).
- **D-03:** **`EmTriagem`** é atingível por transição explícita (ação RH/triagem) a partir de **`PendenteTriagem`** — não entrada automática no submit (alinhado à história §8 separando filas UX).
- **D-04:** **`DevolvidaTriagemGestor`** usa observação obrigatória (texto não vazio trim) ao devolver — reutiliza padrão de `RequestChanges`/`ObservacaoAprovador` onde caber.
- **D-05:** Gestor corrige pedido estando **`DevolvidaTriagemGestor`** (edição igual `AjustesNecessarios`); novo submit volta a **`PendenteTriagem`** e limpa marcadores temporários consistentes com re-submit atual.
- **D-06:** Triagem autorizada ⇒ **`ICurrentUserContext.IsAdmin`** **OU** utilizador que possua papel resolvível por **`ResolveRhRoleIdAsync(TipoFluxoAprovacao.RequisicaoPessoal, ct)`** (Revisão RH / fila) — primeira versão; futuro granular policy em backlog.
- **D-07:** **`EfetivarAsync`** (disparo pré-RM atual) mantém‑se apenas em **`Aprovada`** — Fase 3 altera comportamento quando existir cliente RM; esta fase não bloqueia `Efetivar` salvo decidido pelo executor para segurança (opcional mensagem quando `RmRequisicaoCodigo` já preenchido).

</decisions>

<canonical_refs>

## Canonical References

- `.planning/ROADMAP.md` — secção Fase 2  
- `.planning/REQUIREMENTS.md` — CMP-03, FLX-01…FLX-06  
- `.planning/phases/01-domain-persistence-audit/01-CONTEXT.md` — enums/colunas já existentes  
- `RHPortal.Api/RHPortal.Api/Application/SolicitacoesVaga/SolicitacaoVagaService.cs`  
- `RHPortal.Api/RHPortal.Api/Application/Common/ApprovalWorkflowHelper.cs`  
- `RHPortal.Api/RHPortal.Api/Controllers/SolicitacoesVagaController.cs`  
- `RHPortal.Api/RHPortal.Api/Domain/Enums/SolicitacaoStatus.cs`  

</canonical_refs>

<code_context>

## Existing Code Insights

- **`SubmitAsync`** hoje sempre força **`PendenteAprovacao`** + gera **`SolicitacaoAprovacaoEtapa`** + notifica primeiro aprovador.  
- **`ValidateCanEdit`** só **`Rascunho`/`AjustesNecessarios`** — precisa **`DevolvidaTriagemGestor`**.  
- **`EfetivarAsync`** já exige **`Aprovada`**.  

</code_context>

<deferred>

## Deferred Ideas

- Novo **`TipoFluxoAprovacao.TriagemAumentoQuadro`** isolado nas tabelas de config (maior clareza operacional que reutilização de Revisão RH).  
- Webhooks / SLA por status triagem  

</deferred>

---

*Phase: 02-api-workflow-pre-rm*
