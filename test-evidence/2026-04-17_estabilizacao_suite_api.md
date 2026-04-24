# Evidência de Testes — Estabilização da Suite API

**Data:** 2026-04-17  
**Objetivo:** corrigir 7 falhas remanescentes da suite `RHPortal.Api.Tests` e validar regressão completa.

---

## Resumo

| Métrica | Antes | Depois |
|---|---:|---:|
| Total de testes | 425 | 425 |
| Aprovados | 418 | **425** |
| Falhados | 7 | **0** |
| Blocos afetados | Funcionarios, PreAdmissao, SolicitacoesVaga | Todos verdes |

---

## Ajustes aplicados

1. **`FuncionarioService`**
   - Reintroduzida validação de e-mail duplicado no `CreateAsync`.
   - Reintroduzida validação de e-mail conflitante no `UpdateAsync`.

2. **`PreAdmissaoWorkflowTests`**
   - Cenário `Submit` em status `Preenchido` alinhado para comportamento idempotente (revalida e mantém status).
   - Cenário `Approve` passou a preencher campos obrigatórios de validação TOTVS antes da aprovação.

3. **`SolicitacaoVagaServiceTests`**
   - Cenários de `Submit` e `Approve` alinhados ao workflow atual baseado em `SolicitacoesAprovacaoEtapa`.
   - Inclusão de seed explícito de etapa pendente para validar `Approve`.
   - Ajuste do caso sem aprovador para validar criação de etapa pendente sem responsável resolvido.

---

## Execução

### 1) Regressão focada (7 falhas originais)

```bash
dotnet test RHPortal.Api/RHPortal.Api.Tests/RHPortal.Api.Tests.csproj \
  --filter "FullyQualifiedName~FuncionarioServiceTests|FullyQualifiedName~PreAdmissaoWorkflowTests|FullyQualifiedName~SolicitacaoVagaServiceTests" \
  -v minimal
```

**Resultado:** `Aprovado! – Com falha: 0, Aprovado: 50, Total: 50`

### 2) Suite completa API

```bash
dotnet test RHPortal.Api/RHPortal.Api.Tests/RHPortal.Api.Tests.csproj --no-restore -v minimal
```

**Resultado:** `Aprovado! – Com falha: 0, Aprovado: 425, Total: 425`

---

## Conclusão

- As 7 falhas remanescentes foram resolvidas.
- Suite da API estabilizada com 100% de aprovação (425/425).
- Não foi identificada regressão nas áreas de módulos, logging, vagas e demais domínios cobertos pela suite.
