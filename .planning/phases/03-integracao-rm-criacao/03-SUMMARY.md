# Fase 3 — Resumo da execução (integração RM — criação de requisição)

**Data:** 2026-04-30

## Entregues

1. **`RmRequisicaoCreateOptions`** (`Mode`: `stub` | `disabled`, `MaxTentativas`) e registo em `appsettings.json` (`RmRequisicaoCreate`).
2. **`IRmRequisicaoCreateClient`** com **`RmRequisicaoCreateStubClient`** (código determinístico `STUB-{guid:N}` / idempotência quando já há código STUB persistido) e **`RmRequisicaoCreateDisabledClient`**.
3. **`RmRequisicaoPayloadBuilder`** — validações mínimas pré-envio + JSON de auditoria truncável (IRM-04).
4. **`SolicitacaoVagaRmIntegracaoService`** (`ISolicitacaoVagaRmIntegracaoService`) — idempotência quando `IntegracaoResultado == Sucesso` e `RmRequisicaoCodigo` preenchido; incremento de tentativas; registos em **`SolicitacaoVagaIntegracaoTentativa`**; estados **`EmIntegracao`**, **`AguardandoReprocessamentoRm`** ou **`ErroIntegracaoRm`** conforme resultado e limite de tentativas.
5. **Entidade** `SolicitacaoVagaIntegracaoTentativa` + **migration** `AddSolicitacaoVagaIntegracaoTentativas` + **`AppDbContext`** (DbSet e fluent).
6. **`SolicitacaoVagaService.EfetivarAsync`** — delega ao orquestrador; permite reprocessamento a partir de **`Aprovada`**, **`PendenteIntegracaoRm`**, **`AguardandoReprocessamentoRm`**, **`ErroIntegracaoRm`**.
7. **`IntegracaoTotvsService`** — lista de Req. Pessoal no painel inclui também **`PendenteIntegracaoRm`**, erro e fila RM; **`RetryAsync`** para tipo 9 limpa campos de integração e volta a **`ExecutarCriacaoRequisicaoRmAsync`**.
8. **`Program.cs`** — `Configure<RmRequisicaoCreateOptions>`, cliente por modo, serviço de orquestração registado como scoped.

## Testes

- `dotnet test … --filter FullyQualifiedName~SolicitacaoVagaServiceTests` — 24 aprovados (mock do orquestrador no factory de testes).

## Próximos passos possíveis (fora desta entrega)

- Implementar cliente **`Mode`** adicional ligado ao SQL Server do RM ou ponte oficial (substituindo stub em produção).
- Opcionalmente alinhar DTO/webhook **`IntegracaoTotvsResultadoRequest`** aos campos RM quando o ERP devolver código/status.
