# AGENT.md — Orientações para IAs neste projeto

> Este arquivo complementa o [CLAUDE.md](./CLAUDE.md) existente, que trata de regras específicas de EF Core / Migrations.

## Propósito

Qualquer IA (Claude, Cursor, Copilot, etc.) que atue neste projeto deve manter os arquivos de tracking atualizados **a cada intervenção**.

## Arquivos de tracking (obrigatório atualizar)

| Arquivo | Quando atualizar | O que registrar |
|---------|------------------|-----------------|
| [tasks.md](./tasks.md) | **Toda sessão** | Snapshot operacional curto: em andamento, próximas e concluídas |
| [diario-de-bordo.md](./diario-de-bordo.md) | **Toda interação** | Cronologia: o que o usuário pediu + o que foi feito |
| [backlog.md](./backlog.md) | Nova tarefa ou mudança de status | Itens pendentes, em andamento e bloqueados |
| [changelog.md](./changelog.md) | Toda mudança de código/config | Alterações técnicas com data, seguindo "Keep a Changelog" |
| [documentacao.md](./documentacao.md) | Quando aprender algo novo sobre o sistema | Arquitetura, stack, endpoints, decisões |
| [habilidades.md](./habilidades.md) | Quando descobrir convenção/skill reutilizável | Conhecimentos que qualquer IA precisa saber |

## Fluxo recomendado por turno

1. Ler o **diario-de-bordo.md** para contexto recente
2. Consultar **tasks.md** (curto prazo) e **backlog.md** (médio/longo prazo)
3. Fazer o trabalho pedido
4. Atualizar **tasks.md** (status operacional da sessão)
5. Atualizar **diario-de-bordo.md** (entrada nova com data)
6. Se houve mudança de código/config → **changelog.md**
7. Se surgiu nova tarefa → **backlog.md**
8. Se aprendeu algo novo sobre o sistema → **documentacao.md**

## Checklist de handoff entre IAs (Cursor ↔ Claude Code)

Antes de encerrar uma sessão e trocar de IDE/IA:

1. Garantir que `tasks.md`, `backlog.md`, `diario-de-bordo.md` e `changelog.md` foram atualizados na sessão atual
2. Registrar em `diario-de-bordo.md`:
   - pedido do usuário;
   - diagnóstico técnico;
   - alterações aplicadas;
   - validação executada (build/test/curl)
3. Se houver mudança de comportamento do sistema, atualizar `documentacao.md` e/ou `habilidades.md`
4. Deixar explícitos em `tasks.md`:
   - o que ficou concluído;
   - o que segue pendente para próxima sessão
5. Se houver evidência de teste, registrar em `test-evidence/*.md` e referenciar no `changelog.md`

## Convenções

- **Datas**: formato ISO `YYYY-MM-DD` (absolutas, nunca relativas)
- **Idioma**: português
- **Tom**: objetivo e técnico — sem emojis, sem "foi feito com sucesso"
- **Changelog**: usar `Added`, `Changed`, `Fixed`, `Removed`, `Security`
- **Backlog**: cada item com status `[ ]` pendente, `[~]` em andamento, `[x]` concluído, `[!]` bloqueado

## Regras herdadas do CLAUDE.md

- **Toda alteração em entidade do domínio exige migration EF Core**. Veja [CLAUDE.md](./CLAUDE.md) para o fluxo completo.
- Migrations devem ser **idempotentes** (usar `IF NOT EXISTS`) por causa do multi-tenant.
