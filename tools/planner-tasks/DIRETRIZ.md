# DIRETRIZ — Export Planner (Portal RH)

Ferramenta de registro de tarefas em JSON e exportação para Microsoft Planner do gestor.

## Objetivo

Manter rastreabilidade de entregas do **Portal RH (RenderRH)** com:

- Fonte de verdade em `tasks.json`
- Página HTML para copiar tabela (TSV) no Planner
- Cálculo de horas com jornada comercial (08:00–18:00, máx. 8h/dia)
- Agrupamento por dia na visualização
- Backfill histórico reprodutível via git
- **Regra obrigatória:** toda solicitação executável registra **início** no JSON; toda promoção DEV→HML registra **término** no JSON — **na mesma sessão, sem exceção**

## ⚠️ Registro obrigatório — zero exceções

O Export Planner **não sincroniza sozinho** com git, CI ou Microsoft Planner. A fonte de verdade é `tasks.json`, mantida pelo assistente **em tempo real**.

| Evento | O que fazer | Quando |
|--------|-------------|--------|
| **Início** | Criar tarefa `Em andamento` com `inicio`, `horarioInicio`, `pedidoOriginal` | Ao receber **qualquer** pedido executável no chat |
| **Durante DEV** | Atualizar `percentualConcluido`, `referencias.commits`, `entregavel` | A cada commit relevante |
| **Término** | Fechar tarefa: `conclusao`, `horarioConclusao`, `bucket: Concluído`, `prHml`, `totalHoras` | **Antes** de confirmar merge do PR DEV→HML |
| **Pós-merge** | Ajustar `horarioConclusao` com horário real do merge se diferir | Imediatamente após merge confirmado |

### O que NÃO pode acontecer (incidente real: PR #284)

- Mergear PR HML **sem** entrada correspondente no JSON
- Confiar que `backfill-git.mjs` preencherá depois — backfill é **histórico**, não fluxo ao vivo
- Usar branch local desatualizada — merges HML vêm de `origin/portalRH-HML` (remoto)

**Proibido** dizer ao usuário: “promovido com sucesso”, “PR confirmado” ou “mergeado em HML” se `tasks.json` não estiver atualizado e commitado em DEV.

## Contexto do projeto

| Item | Valor |
|------|-------|
| Repositório | `RH-devops-Lucas` / `munizlmachado-jpg/RH` |
| Produto | Portal RH (RenderRH) |
| Responsável padrão | Lucas Muniz Machado |
| Branch DEV | `portalRH-DEV` |
| Branch HML | `portalRH-HML` |
| Branch PRD | `portalRH-PRD` |
| Ambiente homologação | HMG/HML — `10.0.0.80` |
| Fuso horário | America/Sao_Paulo (Brasília) |
| Registro ao vivo desde | **2026-05-23** |
| Prefixos de tarefa | `[Portal RH]`, `[Infra]`, `[Portal]` |

## Arquivos

| Arquivo | Função |
|---------|--------|
| `DIRETRIZ.md` | Este documento — regras completas |
| `tasks.json` | Fonte de verdade das tarefas |
| `index.html` | UI full-width para visualizar e copiar |
| `calc-horas.mjs` | Lógica compartilhada de cálculo de horas |
| `backfill-git.mjs` | Script Node para backfill e validação |

## Estrutura `tasks.json`

```json
{
  "meta": {
    "projeto": "Portal RH (RenderRH)",
    "responsavelPadrao": "Lucas Muniz Machado",
    "atualizadoEm": "AAAA-MM-DD",
    "instrucao": "totalHoras = tempo real entre horarios no mesmo dia; multi-dia = parcial + 8h/dia.",
    "horasUteisPorDia": 8,
    "minutosMinimos": 30,
    "jornadaComercial": "08:00-18:00",
    "totalTarefas": 0
  },
  "tarefas": []
}
```

### Campos de cada tarefa

| Campo | Regra |
|-------|-------|
| `id` | `TASK-AAAA-NNN`, sequencial por ano |
| `nome` | Prefixo + resultado de negócio (nunca nome de arquivo) |
| `descricaoAmigavel` | 1–3 frases para o gestor |
| `inicio` | Data do pedido no chat |
| `horarioInicio` | Horário do pedido (chat) |
| `conclusao` | Data em que entrou em HML |
| `horarioConclusao` | Fim do merge/deploy CI; `null` se aberta |
| `totalHoras` | Calculado (ver seção abaixo) |
| `bucket` | A fazer \| Em andamento \| Concluído \| Bloqueado |
| `percentualConcluido` | 0 ao abrir; 50–90 em DEV; 100 só após HML |
| `prioridade` | Urgente \| Alta \| Média \| Baixa |
| `atribuidaA` | Responsável padrão |
| `pedidoOriginal` | Resumo do pedido no chat |
| `entregavel` | O que foi entregue em linguagem de negócio |
| `ambiente` | `HML` (ou outro quando aplicável) |
| `referencias.commits` | Hashes dos commits |
| `referencias.branch` | Branch de promoção |
| `referencias.prHml` | PR ou pipeline de merge HML |
| `observacoes` | Notas adicionais |

## Regras de cálculo `totalHoras`

Constantes: jornada **08:00–18:00**, máx. **8h/dia**, mínimo **0,5h** no mesmo dia quando intervalo < 30 min.

### Mesmo dia

- **Com horários:** diferença real dentro da jornada (máx. 8h); se < 0,5h → 0,5h
- **Sem horários:** 8h
- **Horário fora da jornada:** 0h naquele dia (sem fallback de 8h)

### Vários dias

1. **1º dia:** `horarioInicio` → 18:00 (ou 8h se sem horário)
2. **Último dia:** 08:00 → `horarioConclusao` (ou 8h se sem horário)
3. **Intermediários:** 8h cada
4. Sábado e domingo entram nos dias corridos

### Exibição de duração

`30min`, `1h 26min`, `5h 53min`, `0min` se zero.

O `index.html` **recalcula na exibição** — não confiar cegamente no JSON. O assistente mantém `totalHoras` alinhado.

## Ciclo de vida

| Momento | Regra | Campos obrigatórios |
|---------|-------|---------------------|
| **Início** | Pedido executável no chat → registrar **imediatamente** | `inicio`, `horarioInicio`, `bucket: Em andamento`, `horarioConclusao: null` |
| **Em andamento** | Trabalho em DEV, ainda não em HML | `percentualConcluido` 50–90, `referencias.commits` parciais |
| **Término** | PR DEV→HML mergeado/confirmado | `conclusao`, `horarioConclusao`, `bucket: Concluído`, `percentualConcluido: 100`, `prHml`, `totalHoras` |

### REGRA OBRIGATÓRIA — INÍCIO E TÉRMINO

1. **Toda solicitação** gera registro de **início** (data/hora do pedido no chat).
2. **Toda promoção HML** gera registro de **término** (data/hora do merge em `portalRH-HML`).
3. Ambos na **mesma sessão** do assistente — sem exceção.
4. Regra também aplicada via `.cursor/rules/planner-obrigatorio.mdc` (always apply).

### REGRA OBRIGATÓRIA HML

**Nenhuma promoção DEV→HML pode ser considerada concluída sem atualizar `tasks.json` na mesma sessão.**

#### Ordem ao promover

1. Registrar **início** da tarefa (se ainda não existir)
2. Commit em DEV
3. **Fechar tarefa no JSON** (`conclusao`, `horarioConclusao`, `totalHoras`, `commits`, `prHml`)
4. **Commit do Planner** em DEV (junto ou imediatamente antes do PR)
5. Push DEV → abrir/mergear PR DEV→HML → acompanhar CI/CD
6. Se `horarioConclusao` real do merge diferir → ajustar JSON e recommitar
7. **Só então** confirmar promocao ao usuario

**Proibido** dizer “promovido com sucesso” só com git/CI.

## Checklist antes de encerrar promoção HML

- [ ] **Início** registrado (`inicio` + `horarioInicio`) para cada pedido da conversa
- [ ] **Término** registrado (`conclusao` + `horarioConclusao`) com horário real do merge HML
- [ ] Toda entrega da conversa tem entrada no JSON
- [ ] Horários e `totalHoras` coerentes
- [ ] `referencias.commits` + `prHml` (PR ou pipeline)
- [ ] `meta.atualizadoEm` e `meta.totalTarefas` atualizados
- [ ] JSON commitado em DEV **antes** de confirmar merge/promoção ao usuário

## Checklist do assistente (sessão de trabalho)

1. **Ao receber pedido** → criar tarefa **Em andamento** com `inicio` + `horarioInicio` **agora** (America/Sao_Paulo)
2. Durante DEV → atualizar progresso (50–90%), commits em `referencias`
3. **Antes de abrir/mergear PR HML** → fechar tarefa no JSON (`bucket: Concluído`, `percentualConcluido: 100`, `conclusao`/`horarioConclusao`, `totalHoras`, `prHml`)
4. Commitar `tasks.json` em DEV
5. Mergear PR DEV→HML
6. Ajustar `horarioConclusao` se horário real do merge diferir
7. Confirmar promocao ao usuario
8. Usuário copia do HTML para o Microsoft Planner do gestor

## Como abrir o HTML

```powershell
cd tools/planner-tasks
python serve.py 8877
```

Abrir: http://localhost:8877/index.html

> Use `serve.py` em vez de `python -m http.server`: o servidor padrão do Python entrega `.mjs` como `text/plain` e o navegador bloqueia o módulo ES.

- Carrega `./tasks.json` automaticamente via fetch
- **Sem** botões “Recarregar” ou “Carregar JSON do disco”
- Filtros: Esta Semana (seg–dom), Mês Atual, Todos (padrão)
- Botão **Copiar tabela (TSV)** respeita filtro ativo

## UI — colunas da tabela

1. Nome da tarefa (clique copia)
2. Início (dd/mm/aaaa)
3. Concluir (dd/mm/aaaa)
4. Duração (horas do dia naquele bloco; multi-dia mostra `(dia N/M)`)
5. Bucket (chip)
6. Prioridade (chip)
7. Descrição / notas (descrição + entregável + pedido)

**Removidas:** “Atribuída a” e “% concluída”.

### Agrupamento por dia

- Cada tarefa aparece em cada dia entre `inicio` e `conclusao`
- Cabeçalho: `Segunda-feira, 29/06/2026`
- Ordenação decrescente (dia mais novo primeiro; dentro do dia, horário mais novo primeiro)
- Subtotal de horas ao fim de cada dia
- Linha em branco entre blocos

## Backfill histórico

### Fase 1 — Descoberta

```bash
git log --reverse  # desde raiz até 2026-05-22
git log portalRH-HML  # merges/PRs
```

Agrupar por **entrega de negócio** (não 1 commit = 1 tarefa).

Horários: `git log -1 --format=%ci <hash>` → data + HH:mm (Brasília).

### Fase 2 — Preenchimento

- `inicio` / `horarioInicio` = primeiro commit do grupo
- `conclusao` / `horarioConclusao` = merge HML ou último commit DEV
- `prHml` = PR, merge ou pipeline
- `totalHoras` = mesma função do HTML
- `observacoes` = `"Backfill a partir de commits git"` quando aplicável

### Fase 3 — Script

```bash
cd tools/planner-tasks
node backfill-git.mjs
node backfill-git.mjs --validate-only
```

O script:

1. Lê grupos históricos em `BACKFILL_GROUPS`
2. Descobre merges HML desde 2026-05-23 em **`origin/portalRH-HML`** (remoto — nunca branch local desatualizada)
3. Obtém horários via git
4. Calcula `totalHoras`
5. Valida soma JSON = soma recalculada e subtotais diários

### Fase 4 — Validação

Abrir `index.html` e conferir subtotais por dia.

Casos edge verificados pelo script:

- Término após 18:00 → 0h naquele dia
- Multi-dia com início 17:04 → 56min no 1º dia
- Mesmo dia < 30min → mínimo 0,5h

## Checklist antes de colar no Planner

- [ ] Filtro correto (semana/mês/todos)
- [ ] Subtotais por dia coerentes
- [ ] Nomes com prefixo `[Portal RH]` / `[Infra]` / `[Portal]`
- [ ] Descrições em linguagem de negócio
- [ ] Tarefas em aberto não marcadas como Concluído

## Fluxo contínuo (após backfill)

1. Usuário pede → **registrar início imediatamente** (tarefa **Em andamento**)
2. DEV → atualizar progresso, commits e `entregavel`
3. Antes de PR HML → **fechar tarefa** no JSON (término + `totalHoras` + `prHml`)
4. Commitar Planner em DEV → mergear PR DEV→HML
5. Confirmar promocao → usuário copia do HTML para o Planner

## Observações

- Se algo no repositório não tiver commit (só doc local), registrar em `observacoes` e **não inventar hash**
- **Backfill não substitui registro ao vivo** — use `backfill-git.mjs` só para histórico ou reconciliação
- Não promover para HML sem atualizar o JSON na mesma sessão
- Manter `calc-horas.mjs` sincronizado entre HTML e backfill
- Regra persistente do Cursor: `.cursor/rules/planner-obrigatorio.mdc`
