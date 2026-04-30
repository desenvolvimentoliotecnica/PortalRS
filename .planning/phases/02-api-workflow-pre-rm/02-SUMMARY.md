# Fase 2 — Resumo de execução

**Data:** 2026-04-30  

## Entregue na API

- Fluxo **`TipoSolicitacaoVaga.AumentoQuadro`**: `Submit` → **`PendenteTriagem`** sem `SolicitacaoAprovacaoEtapa`; notificação aos utilizadores do role de fila RH (`ResolveRhRoleIdAsync(RequisicaoPessoal)`).
- Triagem: `IniciarTriagemAsync` (PendenteTriagem → EmTriagem), `DevolverTriagemAoGestorAsync`, `EncaminharTriagemParaAprovacoesAsync` (reutiliza `MontarEtapasRequisicaoPessoalEAvancoProcessoAsync`), `TriagemReprovarAsync`.
- Guardas em `ApproveAsync` / `RejectAsync` / `RequestChangesAsync` quando o fluxo ainda está só em triagem ou devolução ao gestor.
- `ApprovalWorkflowHelper.ValidateCanEdit`: inclui **`DevolvidaTriagemGestor`**; `UpdateAsync` permite edição neste status (sem retrair para rascunho).
- Contratos HTTP: `POST .../triagem/iniciar|devolver|encaminhar|reprovar`.
- Helper estático **`SolicitacaoVagaFluxoAumentoQuadro`** + testes de unidade.

## Testes

- `RHPortal.Api.Tests\SolicitacoesVaga\` — `SolicitacaoVagaServiceTests` reativados no `.csproj` (construtor alinhado); filtro `--filter FullyQualifiedName~RhPortal.Api.Tests.SolicitacoesVaga` para rodar apenas este módulo.

## Pendências / próximas fases

- Fase 3: cliente RM após `Aprovada` / `PendenteIntegracaoRm`; UI chamadas triagem (`UIT-02`).

