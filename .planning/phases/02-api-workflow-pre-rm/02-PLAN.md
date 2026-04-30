<!-- source: plan-phase-bootstrap + ROADMAP Fase 2 + SolicitacaoVagaService codebase scan -->
<!-- gsd-phase:phase=02-api-workflow-pre-rm -->

Phase: **API workflow pré-RM (triagem ↔ gestor)**  
Focus: servidor — máquinas de estado, validação de envio, endpoints / serviços, testes automatizados.  
Scope: apenas **`TipoSolicitacaoVaga.AumentoQuadro`** (demais fluxos **não regressar**).

# Phase Plan: API workflow pré-RM (triagem)

## Overview

Construir fluxo servidor **CMP-03 triagem inicial** ligado aos estados já introduzidos na Fase 1 (`PendenteTriagem`, `EmTriagem`, `DevolvidaTriagemGestor`). Alinhar comportamento com **história §8**: triagem primeiro; **aprovações começam somente depois da triagem** (sem etapas de aprovação criadas até **Encaminhar**); devoluções voltam gestor edição; novo envio reabre triagem.

## Requirements Traceability Matrix

Map **each** REQ `id` touched this phase onto concrete deliverables/tests.

```
| REQ ID     | Acceptance summary | Plan section | Artifact / Test |
| ---------- | ------------------ | ------------ | --------------- |
| CMP-03     | Triagem regista devoluções + SLA tracking server-side groundwork | Tasks T3–T9 | Histórico + campos SLA + API |
| FLX-01     | Gestor só envia p/ triagem; sem RM | Tasks T4, T14 | Estados + asserts |
| FLX-02–04  | Ciclo gestor↔RH | Tasks T5–T8 | Service + Tests |
| FLX-06     | Reprovações internas até triagem aceitar | Tasks T9, integration | Estado Reprovada |
```

## Prerequisites

- ✅ Fase 1 merge do domínio (`AumentoQuadro`, enums, `RmRequisicaoStatusMap`).
- ⚠ SLA campos já existentes em **`SolicitacaoVaga`** — popular ao cruzar transições (não exigido UI esta fase).
- ⚠ Seeds / roles tenant — dependem `TenantConfiguracao` / dados existentes QA.

### Environment / secrets

Sem novos secrets. SQL local apenas testes opcionais (InMemory já usado projeto).

---

## Executable Task Prompts For Codex Executor

Instructions to the coding agent (**execute verbatim order unless blocked**):

---

### TASK 02.T1 — Matriz declarativa de fluxo aumento‑quadro

**Objective:** Extrair branching espalhado para helper estático **`SolicitacaoVagaFluxoAumentoQuadro`** sob `Application/SolicitacoesVaga/`.

**Acceptance criteria:**
- **`IsFluxo(entity)`**: `tipo == AumentoQuadro`.
- Métodos puros declarando transições legais (ex.: **`PodeSubmitDeStatus`**, **`RequerLimpezaEtaposPosTriagem`**).
- Coberto por **mini unit-tests** (>0 casos sanity).

---

### TASK 02.T2 — Edição gestor **`DevolvidaTriagemGestor`**

**Files:**  
`RHPortal.Api/RHPortal.Api/Application/Common/ApprovalWorkflowHelper.cs`

**Acceptance:**
- **`ValidateCanEdit`** inclui `SolicitacaoStatus.DevolvidaTriagemGestor` lado a lado com **`AjustesNecessarios`**.

---

### TASK 02.T3 — Validação mínima envio aumento‑quadro (CMP-06 server mirror)

**Files:** mesmo dir service.

**Objective:** método **`EnsureCamposMinimosEnvioAsync(SolicitacaoVaga, ct)`** (nome final consistente codebase) garantindo obrigatórios para triagem segundo domínio:
- Gestor Solicitante (user/funcionario)  
- Departamento solicitante (**`DepartamentoGestorNome` ou `DepartamentoId` válido**)  
- Nível hierárquico (enum presente quando domínio exige — ver entidade atual)  
- Motivo aumento texto (`MotivoAmparo`/campo atual PRD campo 6) não vazio após trim  
- Justificativa orçamento (campo atual JSON `RequisitosDetalhadosJson` subtree **ou** coluna específica se extraído Fase 1)  
**→** usar campos já persistidos conforme migrações Fase 1; **não** inventar texto PRD novo sem campo.

Emitir **`InvalidOperationException`** mensagens **estáveis** (UI pode mapear) ou adoptar modelo validação projeto se existente.

---

### TASK 02.T4 — **`SubmitAsync` divergência fluxo aumento‑quadro**

**Files:** `SolicitacaoVagaService.SubmitAsync`

**Behavior quando `IsFluxoAumentoQuadro`:**
1. Chamar **`EnsureCamposMinimosEnvio`** antes estado.  
2. Transição apenas de **`Rascunho`** / **`DevolvidaTriagemGestor`** (**não permitir repetido submit já em triagem** — `InvalidOperation`).  
3. Destino ⇒ **`SolicitacaoStatus.PendenteTriagem`** (não **`PendenteAprovacao`**).  
4. **NÃO** criar **`SolicitacaoAprovacaoEtapa`** linhas nem chamar primeira notificação aprovadores.  
5. Notificar fila **`ResolveRhRoleIdAsync(RequisicaoPessoal)`** igual padrões existentes (**novo método privado **`NotificarNovaTriagemAsync`** opcional**) message body curto com link/id.  

**Preserve** comportamento atual completo quando **não** fluxo aumento‑quadro.

---

### TASK 02.T5 — **`IniciarTriagemAsync`** (opcional entrada **EmTriagem**)

Novos método públic service + Controller route.

Transitions:
- **`PendenteTriagem → EmTriagem`**
Authority: (**IsAdmin OU role RH**) **E** funcionário válido actor.

Concurrency: pessimistic check status esperado antes update.

Registrar histórico via **`IStatusHistoricoService`**.

---

### TASK 02.T6 — **`DevolverTriagemAoGestorAsync`**

Transitions:
- **(`PendenteTriagem` ∪ `EmTriagem`) → `DevolvidaTriagemGestor`**

Input DTO (**contract** novo pequeno) com **`Observacao` obrigatória** (>0 length trim).

Registrar histórico + persistir última observação triagem onde pattern existente (`MotivoAlteracao`/campo próprio decisão backlog — **prioridade:** reuse `MotivoAmparo`/novo texto curto apenas se modelo limpo existe; senão novo campo só se unavoidable — **resolver via checagem entidade atual** antes alterar modelo **→** minimizar migrações; usar `MotivoAmparo`/observaçao triagem apenas se já semânticos corretos, senão novo nullable string **`ObservacaoTriagem`** requer migração idempotente **decida executor após ler entidade**.)

*Neste plano a decisão pragmática preferida*: **persistir apenas em histórico** + devolver erro se modelo sem campo texto — **prefer** camada histórico + retorno lista observações última entrada **evita migração** se aceitável story.

Registrar auditoria SLA: `DataEnvioGestorUtc` já set submit; atualizar marcador devolução (ex.: novo DateTime opcional apenas se já campos SLA — usar existentes antes criar novo).

---

### TASK 02.T7 — **`EncaminharTriagemParaAprovacoesAsync`**

Transition:
- **`EmTriagem → PendenteAprovacao`**

Authority: igual triagem serviços.

Effects:
1. **Garantir limpeza** quaisquer resíduos etapas (improvável) — `RemoveEtapasPendentes` pattern existente só se aparecerem.  
2. Reuso bloco atual de **`Submit`** que monta **`SolicitacaoAprovacaoEtapa`** (extrair método privado compart **`PrepararEtapasAprovacaoParaRequisicaoAsync(entity, ct)`** para **não duplicar lógica**).  
3. Notificar primeira etapa usando helper já existente.  

---

### TASK 02.T8 — Ciclo segundo envio gestor (**FLX‑04`)

Quando **`DevolvidaTriagemGestor`**, novo **`Submit`** (já tratado **T4**) deve:
- Zerar SLA devolução se aplicável (**calculated server-side timestamps**).  
- Volta **`PendenteTriagem`** (novo ciclo FLX‑02).  

Garantir idempotência: submit duplo → conflict.

---

### TASK 02.T9 — Reprovações internas (pré‑envio RM)

Enquanto em **`PendenteTriagem`** ou **`EmTriagem`**:
Permitir método **`TriagemReprovarAsync`** ⇒ **`Reprovada`** com motivo obrigatório (**história §8** “reprovada internamente”) — sem etapas aprovação criadas.

Não regressar cascata atual usada outro fluxo salvo reused safe.

---

### TASK 02.T10 — **`ApproveAsync` / `RejectAsync`** invariants

Ensure fluxo aumento‑quadro **não permite** approvals se status ∈ {`PendenteTriagem`,`EmTriagem`,`DevolvidaTriagemGestor`} ⇒ **InvalidOperation** defensiva (evita corrida segurança). Quando **`PendenteAprovacao`**, reusar pipeline atual até **`Aprovada`**.

---

### TASK 02.T11 — Contracts + Controller (`SolicitacoesVagaController`)

Endpoints (prefixo atual):

| Verb | Route | Behavior |
| ---- | ----- | -------- |
| POST | `{id}/triagem/iniciar` | T5 |
| POST | `{id}/triagem/devolver` body observacao | T6 |
| POST | `{id}/triagem/encaminhar` | T7 |
| POST | `{id}/triagem/reprovar` body motivo | T9 |

**Authorization:** repetir política outros endpoints triagem‑like (delegar granularidade inicial true no controller igual `CanApprove` stub atual **mas** segurança fina dentro service via context).  

Swagger XML docs atualizadas.

---

### TASK 02.T12 — Unit / integration tests expansão (`SolicitacaoVagaServiceTests`)

Cenários mínimos obrigatórios:
1. Submit aumento vai `PendenteTriagem`, sem linhas etapa (`Count==0`).
2. Devolver volta `DevolvidaTriagemGestor`, gestor pode editar.
3. Encaminhar cria linhas esperadas igual baseline snapshot controlado harness.
4. Approve antes encaminhar → erro.
5. Full happy path aumento até `PendenteAprovacao`.

Use InMemory já existente; seed roles triagem mocks necessários conforme infra testes projeto.

---

### TASK 02.T13 — Localization / mensagens infra (opcional menor)

Somente quando exceptions expostas user-facing carecem recurso já existentes.

---

### TASK 02.T14 — Documentação atualizada

- **`SolicitacaoVagaContracts`** com bloco FLX aumento‑quadro.
- **`01-SUMMARY.md` cross-link opcional**.

---

### TASK 02.T15 — Verificação & Build

Rodar **`dotnet build -c Release RHPortal.Api.sln`** (ajust path sln projeto). Resolver warnings novos apenas desta mudança.

---

## Complexity & Constraints

Hotspot file `SolicitacaoVagaService.cs` — dividir apenas se extrações reduzindo >60 linhas adicionadas contínuas. Evitar regressão outros fluxos: **dual path explícito** no `Submit`.

## Threat Model (`/gsd-plan-phase`)

| Threat | Attack / Failure | Severity | Detection | Mitigation |
| ------- | ------------------ | -------- | --------- | ---------- |
| Bypass triagem criando etapas | Client forja submit clássico | High | Estado inconsistente audits | asserts status + apenas server path aumento‑quadro |
| Race double encaminhar | Two parallel encaminhar | Med | Histórico duplicados | transactional status check |
| Unauthorized triagem actor | spoof role | High | Logs | role resolution + Funcionario existe |
| Orphan SLA timers | campo null | Low | asserts tests | atualizar SLA transitions |

---

## Verification Loop

Nyquist checkpoints (adapted):

```
CHECKPOINT — FLX aumento servidor orquestra triagem primeiro
├── [ ] Estado submit correto PendenteTriagem sem etapas
├── [ ] Edição permissões DevolvidaTriagemGestor
├── [ ] Encaminhar cria fluxo igual snapshot histórico
├── [ ] Reprovação triagem válida só pré-aprovadores
├── [ ] Não regressões VagaNova / Substituicao (smoke asserts)
├── [ ] Build Release limpo — **zero new warnings blocker**
├── [ ] **Tests added / updated pass**
├── [ ] **REQ CMP-03 + FLX-01..FLX-06 satisfied per matrix**
├── [ ] **Threat mitigations exercised (auth wrong role test) optional**
├── [ ] **Observabilidade:** logs Structured minimal em transições triagem
```

Iterar falhas testes antes commit final.

## Success Criteria

- História §8 **servidor** refletida para aumento quadro.
- Requisitos matriz completa.
- CI local verde `dotnet test` targeted project + API build.

## Meta

| Field | Value |
|-------|-------|
| **Phase** | API workflow pré-RM |
| **Mode** | plan-only |
| **Research** | Skipped (`config research_enabled:false`) |

---

*Gerado pela orquestração interna Cursor plan-phase emulation — próximo comando sugerido: `$gsd-execute-phase 2`*
