# Solicitação de vaga ↔ Turno — fases e rastreio

Última atualização: 2026-04-30.

## Visão geral

| Fase | Escopo | Estado |
| --- | --- | --- |
| **1** | Backend: `TurnoId` em `SolicitacaoVaga`, migração idempotente, validação no serviço, snapshot em `EscalaTrabalho`, `Vaga.TurnoId` na criação do rascunho, `Submit` exige turno **ou** escala legada | Concluída |
| **2** | Frontend: aba Horário com seleção de turno + painel som leitura; payload `turnoId`; lookup por lotação; legado só texto | Concluída |
| **3** | Melhorar `/app/turnos` com grade tipo `HorarioEditor` no cadastro | Concluída |

---

## Fase 1 — Checklist

- [x] Entidade `SolicitacaoVaga.TurnoId` + navegação `Turno`
- [x] `AppDbContext` FK / delete behavior
- [x] Migration idempotente `AddTurnoIdToSolicitacaoVaga`
- [x] Contratos `turnoId` em create/update + campos de turno na resposta
- [x] `SolicitacaoVagaService`: resolver/validar turno (ativo, compatível com lotação)
- [x] Create/Update: com `TurnoId` preenche snapshot em `EscalaTrabalho`; sem turno usa escala legada
- [x] `CopyAsync`: copia `TurnoId` e `MotivoRequisicaoId`
- [x] `SubmitAsync`: exige `TurnoId` ou `EscalaTrabalho` não vazio
- [x] `GetById` + `MapToResponse`: inclui dados do turno
- [x] `CriarVagaRascunhoAsync`: define `Vaga.TurnoId`
- [x] `TurnoLookupItem`: `StartTime` / `EndTime` (API lookup)

## Fase 2 — Checklist

- [x] `SolicitacaoForm`: remover `HorarioEditor` da aba Horário
- [x] Draft + API: `turnoId`, `escalaTrabalho` só quando sem turno
- [x] Carregar turnos via `/api/turnos/lookup?unidadeLotacaoId=…`
- [x] Painel som leitura com `GET /api/turnos/{id}`
- [x] Legado: aviso + texto livre (edição) ou som leitura em `viewOnly`
- [x] Validação cliente: turno **ou** escala legada antes de salvar

## Fase 3 — Checklist

- [x] Coluna `GradeHorarioJson` (`text`) em `Turnos` + migration idempotente
- [x] Contratos/API: create/update/response com `gradeHorarioJson`
- [x] `TurnoCadastroScreen`: diálogo ampliado, `HorarioEditor`, botão «Da grade (2ª)» para preencher início/fim
- [x] `SolicitacaoForm` (aba Horário): exibe grade somente leitura quando o turno tem JSON cadastrado

---

## Referências rápidas

- API: `SolicitacaoVagaContracts.cs`, `SolicitacaoVagaService.cs`, `TurnoController` (lookup)
- Front: `LioTecnica.Web.Next/src/features/gestao/solicitacoes/SolicitacaoForm.tsx`
