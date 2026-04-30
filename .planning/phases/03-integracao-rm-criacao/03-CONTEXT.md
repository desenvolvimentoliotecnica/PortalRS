# Phase 3: Integração RM (criação) — Context

**Gathered:** 2026-04-30  
**Status:** Planned (bootstrap técnico a partir ROADMAP + codebase)

## Phase boundary

Implementar **criação da requisição de pessoal no RM** a partir da solicitação do portal já **aprovada** (IRM-01…04), persistência de vínculos (código/atendimento/status inicial), tratamento de falha/retry idempotente e **histórico de tentativas**. **Fora do escopo:** sincronização contínua de CODSTATUS (**Fase 4**), UI dedicada (**Fase 5/6**) além dos endpoints já existentes de integração quando aplicável.

## Canonical references

- [.planning/ROADMAP.md](../../ROADMAP.md) — Fase 3  
- [.planning/REQUIREMENTS.md](../../REQUIREMENTS.md) — IRM-01 … IRM-04  
- [.planning/phases/02-api-workflow-pre-rm/02-SUMMARY.md](../02-api-workflow-pre-rm/02-SUMMARY.md) — aumento quadro até aprovações  
- `RHPortal.Api/RHPortal.Api/Application/SolicitacoesVaga/SolicitacaoVagaService.cs` — `EfetivarAsync` (TODO RM)  
- `RHPortal.Api/RHPortal.Api/Application/IntegracaoTotvs/IntegracaoTotvsService.cs` — `TipoIntegracao.SolicitacaoVaga` (9): painel, detalhe, `RegistrarResultadoAsync`, reconciliação, `VoltarPendente`  
- `RHPortal.Api/RHPortal.Api/Infrastructure/Rm/` — `RmConnectionOptions`, `RmRequisicoesReadService` (somente **leitura** SQL Server hoje)  
- `RHPortal.Api/RHPortal.Api/Domain/Entities/SolicitacaoVaga.cs` — `RmRequisicaoCodigo`, `RmCodStatus`, `RmUltimaSincronizacaoUtc`, `Integracao*` / `TentativasIntegracao`  
- `RHPortal.Api/RHPortal.Api/Domain/Enums/SolicitacaoStatus.cs` — `PendenteIntegracaoRm`, `ErroIntegracaoRm`, `AguardandoReprocessamentoRm`

## Existing code observations

| Área | Estado |
|------|--------|
| Leitura RM | `IRmRequisicoesReadService` + queries SQL parametrizadas |
| `EfetivarAsync` | Só altera para `EmIntegracao`; comentário aponta `ITotvsClient` futuro |
| Integração tipo 9 | Já aparece em listagens/reconciliação/handlers genéricos; **não** há escrita criativa RM ligada ao `Efetivar` |
| Contadores tentativa | Colunas na própria `SolicitacaoVaga` — **IRM-04** pede lista completa tentativas (provável nova entidade + migration idempotente) |

## Implementation decisions (propostas execução — validar ao implementar)

- **D-RM-01:** Chave idempotência = `SolicitacaoVaga.Id` + `TenantId`; se `RmRequisicaoCodigo` já preenchido e sucesso confirmado → **no-op** ou retorno determinístico.  
- **D-RM-02:** Transport **preferir** mesmo stack que desligamentos (`Totvs`/Progress) **se** existir infraestrutura reutilizável; **senão** opção SQL (stored procedure autorizada na mesma `Rm` ou DB dedicado) documentada em código e em `appsettings`.  
- **D-RM-03:** Estado pós-sucesso inicial: avaliar **`PendenteIntegracaoRm`** vs manter **`EmIntegracao`** até webhook — alinhar com `RegistrarResultadoAsync` existente tipo 9.  
- **D-RM-04:** Fluxo **`AumentoQuadro`** após todas aprovações: apenas então disparar RM (nunca antes da máquina Fase 2).  
- **D-RM-05:** Tentativas: tabela **`SolicitacaoVagaIntegracaoTentativas`** (jsonb opcional payload resumo) OU equivalente já existente se descobrir padrão de outra entidade.

## Deferred

- SLA por tentativa RM  
- Autenticação mútua webhook externo não-RM  

---

*Phase slug: `03-integracao-rm-criacao`*
