<!-- source: 05-CONTEXT.md + ROADMAP Fase 5 + REQUIREMENTS UIT-01, CMP-03, SYN-02 observabilidade -->
<!-- gsd-phase:phase=05-ui-gestor -->

Phase: **UI Gestor (Next.js) · UIT‑01**  
Focus: Fluxo ponta‑a‑ponta **gestor** — painel como entrada única menu, lista `/gestao/solicitacoes`, formulário modal (desktop) + **página completa** (`< md`), paridade **`SolicitacaoStatus`** + RM read‑only nos DTOs, validações client alinhadas API, checklist manual **CA01‑CA06** pré‑RM.  
Out of scope: **UIT‑02** (triagem/aprovação/RH workspaces completos · **Fase 6**), Playwright E2E (`05-CONTEXT` deferred).

# Phase Plan: UI Gestor

## Requirements traceability

| REQ ID | Acceptance (resumo) | Tasks |
|--------|---------------------|-------|
| **UIT‑01** | Jornada gestor: nova vaga / motivo aumento quadro, multi‑seções, obrigatórios antes de submit (**CA01, CA03**) | 05.T3, 05.T4, 05.T6 |
| **CMP‑03** | Secções §7.* + erros discriminados espelho cliente/servidor (**CA02**) | 05.T4, 05.T6 |
| **CMP‑04** | Rascunho persiste servidor; sobrevive refresh (**D‑03**) | 05.T3, 05.T6 |
| **FLX‑01…04** *(observável gestor)* | Estados triagem/devolução visíveis **sem** RH console | 05.T2, 05.T3, 05.T5 |
| **SYN‑02/03** *(UI)* | Painéis/detalhes mostram campos RM + última mensagem sync quando API enviar | 05.T2, 05.T3 |
| **ROADMAP #3** | Checklist manual CA01‑CA06 documentado | 05.T8 |

## Prerequisites

- API **SolicitacaoVaga** com estados pré‑RM e DTO **grid/detalhe** incluindo campos **`rm*`** (**Fases 2–4**).  
- `SolicitacaoFormModal.tsx` já cobre grande parte das abas.domínio.  
- Não há novo item **`permissionManifest`** para lista — apenas entradas já existentes do painel.

## Waves

| Wave | Tasks | Dependências |
|------|-------|----------------|
| **1** | 05.T1 | Nenhuma — módulo partilhado antes de refactor massivo |
| **2** | 05.T2, 05.T3 | Depende T1 para imports estáveis |
| **3** | 05.T4, 05.T7 | Rotas página + split form em componente reusável |
| **4** | 05.T5, 05.T6 | Depende T3/T4 comportamento navegação + validação |
| **5** | 05.T8 | Documentação pós‑implementação |

---

## Executable tasks (`05.T*`)

### 05.T1 — Módulo partilhado **`SolicitacaoStatus`** (UI badges + parsing)

**Files (sugestão):**  
`LioTecnica.Web.Next/src/features/gestao/shared/solicitacaoVagaStatusUi.tsx` *(ou `.ts` se só dados — preferir `.tsx` apenas se JSX inline)*  

**Objective:** uma **única fonte** para label/cor/ícone por **`SolicitacaoStatus`** (string enum name OU número onde API ainda não serializa só string), incluindo **todos** os membros relevantes (**`PendenteTriagem`** … **`AguardandoReprocessamentoRm`** — ver `RHPortal.Api/.../SolicitacaoStatus.cs`).

**Implementação:**
- Exportar `statusBadge(status: string | number): { label, className?, icon LucideIcon }`.
- Opcional helper `normalizeSolicitacaoStatus(raw unknown): string` para entrada API mista.

**Acceptance:**
- **`SolicitacoesScreen`**, **`PainelSolicitacoesScreen`** *(tab Contratação)* e **`AprovacoesScreen`** onde mostram estado de **`SolicitacaoVaga`** passam a importar esta fonte _(refactor aplicado nos tasks seguintes não precisa ficar só em T1 se preferir fazê‑lo já aqui)_ — pelo menos criar módulo + um consumidor atualizado nesta wave para garantir compilado.

---

### 05.T2 — Painel **`PainelSolicitacoesScreen`**: CTA + paridade Contratação

**Files:**  
`LioTecnica.Web.Next/src/features/gestao/painel-solicitacoes/PainelSolicitacoesScreen.tsx`  

**Objective:**  
1. **CTA:** botão/link claro (**pt‑BR**) tipo “Lista completa — contratações / requisições” usando **`Link`/router** com href **`/gestao/solicitacoes`** (com **`basePath` `/app`** o URL absoluto será `/app/gestao/solicitacoes`).  
2. Remover/normalizar remap legado **`parseVagaStatus`** / **`VAGA_STATUS_NAME_MAP`** que **invertia**/colidia com cancelamento RH — usar **ordinal real** **`SolicitacaoStatus`** alinhado API + **statusBadge** desde **05.T1** na listagem Contratação.  
3. Garantir abertura de detalhe/acompanhamento continua funcionando para linhas **`/api/solicitacoes-vaga`**.

**Acceptance:**
- Lista Contratação no painel não exibe etiqueta equivocada para **Cancelada** vs **Aguarda RH** / estados novos da máquina.
- Utilizadores chegam ao ecrã de lista apenas pelo menu existente (**Painel**) + CTA (**sem novo item lateral**).

---

### 05.T3 — Lista **`SolicitacoesScreen`** + routing base

**Files:**  
`LioTecnica.Web.Next/src/app/(app)/gestao/solicitacoes/page.tsx`  
`LioTecnica.Web.Next/src/features/gestao/solicitacoes/SolicitacoesScreen.tsx`

**Objective:**  
1. **Eliminar** `redirect("/dashboard")`; render **`SolicitacoesScreen`** com **`AuthGuard`** (equivalente a outras páginas `/gestao`).  
2. Integrar **`statusBadge`** (T1); estender **`STATUS_MAP`** atual ou **substituir** uso por imports do módulo.  
3. Tipos **`SolicitacaoGridRow` / `SolicitacaoDetail`**: acrescentar opcionais **`rmCodStatus`?, `rmUltimaStatusDescricaoRm`?, `rmStatusSyncUltimaMensagem`?, `rmUltimaSincronizacaoUtc`?, `rmRequisicaoCodigo`?** alinhados contrato ASP.NET (**camelCase** JSON). Mostrar RM num bloco só **leitura** no drawer/modal de detalhe (e opcionalmente colunas resumidas na grelha se UX não ficar sobrecarga).  
4. **Refetch obrigatório** ao abrir edição quando `editId` definido (evitar dados stale por **tabs** mesmo modal).

**Acceptance:**
- Refresh da página **`/gestao/solicitacoes`** não redireciona; lista carrega dados.  
- Estados triagem visíveis com label coerentes.  

---

### 05.T4 — Extrair formulário **`SolicitacaoForm`** (client component) reusável modal + página

**Files:**  
`LioTecnica.Web.Next/src/features/gestao/solicitacoes/SolicitacaoFormModal.tsx` _(refactor)_  
*Novo:* `…/solicitacoes/SolicitacaoForm.tsx` _(ou nome equivalente)_ — mesmo conteúdo abas **`Tabs`/`HorarioEditor`**, props: `{ mode:'create'|'edit', solicitationId|null, initialCopyId?, onSuccess, onCancel }`

**Objective:** **`SolicitacaoFormModal`** passa ser **thin wrapper** `{open, …}` rodeando **`SolicitacaoForm`**; páginas T7 importam apenas **`SolicitacaoForm`** + layout próprio (header mobile).  
Preservar **toda** sequência atual de payloads **POST/PUT** e mensagens erro.

---

### 05.T5 — Mobile **página completa** (**D‑08**)

**Files:**  
*Novo páginas:*  
`src/app/(app)/gestao/solicitacoes/nova/page.tsx`  
`src/app/(app)/gestao/solicitacoes/[id]/editar/page.tsx` *(ou estrutura alternativa só `[id]` com `mode=edit` desde que URL distinta nova — planner prefere nova + edit explícitos)*  

`SolicitacoesScreen.tsx` — detectar **`matchMedia('(max-width: 767px)')`** ou **`useBreakpoint('md')`** se ja existir util; **`Nova`/`Editar`** acionam **`router.push`** em mobile em vez **`Dialog`**; desktop mantém modal.

**Objective:** formulário físico sempre **fullscreen scroll** (`< md`); **`Dialog` fecha** antes de navegar onde aplicável; **toast** igual.

---

### 05.T6 — Validações client + **CMP‑02/CMP‑03** mirror

**Files:** **`SolicitacaoForm.tsx`** (+ helpers próximos)  

**Objective:**  
- Antes **`submit`/envio**, validações mínimas alinhadas regras servidor **mais faladas na doc**: `Titulo`, `Motivo`/tipo aumento quadro, `Justificativa` obrigatória quando fluxo aumento (**RN03** observacional `05-CONTEXT`), campos obrigatórios cabeças de abas **por submit** quando API não devolve erro específico.  
- Parsing **`problem+json`** / modelo validação MVC: destacar erro na **aba** correspondente onde possível; fallback **toast**.

**Aceite:**
- Tentativa submit com obrigatórios falhos **bloqueada** cliente com texto **pt‑BR** sem round‑trip servidor **quando espelho seguro**.
- Fluxo permite ainda servidor rejeição final (dupla barreira).

---

### 05.T7 — **`AprovacoesScreen`** paridade **`SolicitacaoVaga`** status

**Files:**  
`features/gestao/aprovacoes/AprovacoesScreen.tsx`

**Objective:** usar **statusBadge** / enum map em qualquer vista detalho da mesma **`SolicitacaoVaga`** para não regressão visual quando **Painel**/lista já corrigiram.

---

### 05.T8 — **`05-VERIFY.md`** checklist CA01‑CA06 (pré‑RM)

**Files:** `.planning/phases/05-ui-gestor/05-VERIFY.md`

**Objective:** marcadores reproducíveis: **happy path aumento quadro**, **campo obrigatório erro**, **rascunho + refresh**, **devolução triagem** _(se ambiente permite seed/mock estados)_ , **mensagem RM read‑only quando payload existir**, pré‑ RM até **aprovação** sem exigência teste RM vivo.

*(Se CA documento extern não estiver no repo numerar cenários pragmaticamente segundo `REQUIREMENTS.md` bullets.)*

---

## Verification (Nyquist-aligned / goal‑backward)

1. ✅ Gestor consegue: **Painel → CTA → lista** → **Nova** (**mobile página / desktop modal**) até **salvar Rascunho** e rever após reload.  
2. ✅ Estado **triagem**/RM aparece etiquetado em **Painel Contratação + Lista + Approvações** sem mapas legados inconsistentes (Cancelada≠RH).  
3. ✅ **`Dialog` formulário não usado standalone** quando viewport `< md`.

---

## Deferred (não criar PLAN tasks)

- Segundo sidebar item “Solicitações” (**05-CONTEXT** **excluído**)  
- **Playwright**, autosave campo‑a‑campo  

---

## Plan checker self‑review (inline)

| Check | ✓ |
|-------|---|
| Traceability até ROADMAP/REQ | ✓ |
| Out of phase explicit | ✓ |
| Files & acceptance por task | ✓ |
| Depende apenas Fases ≤4 API | ✓ |
| Manifest sidebar não duplicado | ✓ |

---

*Phase slug: **`05-ui-gestor`** · Próximo: `$gsd-execute-phase 5`*
