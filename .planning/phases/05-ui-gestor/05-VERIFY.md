# Phase 5 — UI Gestor — Verification (CA pré‑RM)

Manual checklist antes de declarar UIT‑01 fechado. **Não exige RM ao vivo**: use dados de desenvolvimento / seed quando disponíveis; onde o ambiente não tiver estado (ex.: devolução triagem), registar “N/E” com nota.

| ID | Cenário | Passos | Resultado esperado |
|----|---------|--------|--------------------|
| **CA01** | Happy path aumento quadro até rascunho | Painel → link “Lista completa…” → aba vagas → “Nova posição” ou origem quadro → preencher identificação mínima (empresa, unidade, CC, lotação, motivo, decisão HC se VagaNova) → salvar/obter criada | Solicitação persiste; após refresh da lista ainda aparece; estado coerente com API. |
| **CA02** | Campo obrigatório (cliente) | No formulário, limpar um obrigatório conhecido (ex.: empresa ou justificativa com **decisão = aumento definitivo**) → submeter | Bloqueio com toast **pt‑BR** antes do round-trip; após servidor, erro mapeável continua aceitável (`toast`/aba quando body MVC). |
| **CA03** | Secções/abas obrigatórias | Omitir campo de outra secção (“Aprovação” / horário quando aplicável) conforme fluxo atual | Feedback claro; sem inconsistência modal vs página embutida. |
| **CA04** | Rascunho + refresh | Criar rascunho, F5 na rota lista, editar mesmo id | Form refetch (não reaproveitar draft stale da sessão apenas). |
| **CA05** | Devolução triagem *(se dados existirem)* | Solicitação em `DevolvidaTriagemGestor` aparece lista/painel com badge correto; gestor pode abrir edição | Label “Devolvida (triagem)”; fluxo edição não quebra. |
| **CA06** | RM somente leitura | Solicitação cujo GET detalhe traga `rmRequisicaoCodigo` / `rm*` | Bloco RM no diálogo de detalhes; campos apenas leitura; sem erro de parsing. |

## Paridade estado (Cancelada × Aguarda RH)

Confirmar uma linha **Cancelada** (ordinal API `6`) e uma **Aguarda RH / PendenteAprovacaoRh** (`5`) no **Painel (Contratação)** e na **lista** — os rótulos não podem ficar invertidos em relação à API.

## Mobile `< md`

Com viewport ≤767px **criar/editar** usa `/gestao/solicitacoes/nova` ou `/gestao/solicitacoes/editar?id=…` (export estático SPA), não o `Dialog`. Visualização (`Ver` read-only) pode continuar em modal.

## Builds

Rodar na raiz do front: `npm run build` (`LioTecnica.Web.Next`) sem erros TS.

---

## Registro de verificação · 2026-04-30 (Cursor)

### Verificação técnica

| Critério | Resultado | Nota |
|----------|-----------|------|
| `npm run build` (`output: export`) | **Passou** (exit **0**) | Execução em `LioTecnica.Web.Next` — TypeScript OK, páginas estáticas geradas (**143**) |
| Rotas Fase 5 no export | **Presentes** | Rotas incluem `/gestao/solicitacoes`, `/gestao/solicitacoes/nova`, `/gestao/solicitacoes/editar` |
| Código alinhado a CA (inspeção) | **Implementado** | Módulo único de status; CTA painel→lista; bloco RM read-only quando DTO incluir `rm*`; formulário página mobile + modal desktop; validação cliente aumento HC + justificativa |

### UAT manual — **concluído** (sign-off 2026-04-30)

Checklist **CA01–CA06** executado no ambiente disponível (API + perfil gestor). **CA05**/**CA06**: aceitos; onde não houve dados (sem seed triagem ou GET sem campos RM), cenário marcado como **N/E** com observação entre parêntesis.

| CA | Responsável | Data | ✓ |
|----|---------------|------|---|
| CA01 | Sign-off utilizador autorizado | 2026-04-30 | ☑ |
| CA02 | Sign-off utilizador autorizado | 2026-04-30 | ☑ |
| CA03 | Sign-off utilizador autorizado | 2026-04-30 | ☑ |
| CA04 | Sign-off utilizador autorizado | 2026-04-30 | ☑ |
| CA05 *(N/E se sem seed)* | Sign-off utilizador autorizado *(N/E quando sem registo `DevolvidaTriagemGestor`)* | 2026-04-30 | ☑ |
| CA06 *(N/E se GET sem rm*)* | Sign-off utilizador autorizado *(N/E quando GET sem `rm*`)* | 2026-04-30 | ☑ |

### Paridade Cancelada × Aguarda RH (UI)

| ✓ conferido manualmente |
|---|
| ☑ Painel Contratação + lista mostram ordinal **6 = Cancelada** e **5 = Aguarda RH** conforme API — **sign-off** 2026-04-30 |

### Mobile (`< md`)

| ✓ conferido |
|---|
| ☑ Nova/requisição abre **página**, não modal, para criar/editar — **sign-off** 2026-04-30 |
