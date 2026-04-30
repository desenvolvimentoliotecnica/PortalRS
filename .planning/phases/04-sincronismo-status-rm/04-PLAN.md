<!-- source: 04-CONTEXT.md + ROADMAP Fase 4 + REQUIREMENTS SYN-* -->
<!-- gsd-phase:phase=04-sincronismo-status-rm -->

Phase: **Sincronismo status RM ⇄ Portal (SYN-01…SYN-03)**  
Focus: API — leitura `CODSTATUS` por vínculo IRM-02, mapa parametrizável, persistência última sync/erro, DTOs, disparo manual + HostedService opcional, CRUD admin do mapa.  
Out of scope: UI §7 (**Fase 5**); webhooks RM push (**Deferred** CONTEXT); regressão **`RmRequisicaoCreateClient`** (**Fase 3**).

# Phase Plan: Sincronismo status RM

## Requirements traceability

```
| REQ ID | Acceptance (resumo) | Plan tasks |
|--------|---------------------|------------|
| SYN-01 | Mapa CODSTATUS ↔ portal parametrizável por tenant (sem migration por novo valor) | 04.T5, 04.T7 |
| SYN-02 | Mudança RM reflete painéis/detalhes (API) + texto amigável | 04.T3, 04.T6, 04.T8 |
| SYN-03 | Última sync, status cru, mensagem erro sync quando houver | 04.T1, 04.T3, 04.T6 |
```

## Prerequisites

- Fase 3: `RmRequisicaoCodigo`, `RmCodStatus`, fluxo crição + retries.  
- Tabela **`RmRequisicaoStatusMaps`** + `IRmRequisicoesReadService` com `CODSTATUS` na listagem.  
- **`IRmSyncRunService`** + entidade **`RmSyncRun`** operacionais (como vagas/worker).

## Waves (executor pode paralelizar apenas onde sem dependência de arquivo)

| Wave | Tasks | Notas |
|------|-------|--------|
| **1** | 04.T1 | Migration + modelo |
| **2** | 04.T2 | Leitura RM por vínculo |
| **3** | 04.T3, 04.T4 | Orquestração sync + RmSyncRun |
| **4** | 04.T7, 04.T5 (HTTP), 04.T6 | APIs + HostedService |
| **5** | 04.T8, 04.T9 | DTOs + testes |

---

## Executable tasks (`04.T*`)

### 04.T1 — Colunas **`RmStatusSyncUltimaMensagem`** (+ **`RmUltimaStatusDescricaoRm`**) + fluent

**Files:**  
`Domain/Entities/SolicitacaoVaga.cs`, `Infrastructure/Data/AppDbContext.cs`, migration tenant única.

**Objective:** **SYN-03** erro de sync distinguível da criação IRM (**D-SYN-03**); **SYN-02** texto amigável última leitura RM persistido (**CONTEXT** MVP+).

**Acceptance:**
- `RmStatusSyncUltimaMensagem`: `string?`, servidor trunca **2000** chars. Migration: `ALTER ... ADD COLUMN IF NOT EXISTS "RmStatusSyncUltimaMensagem" character varying(2000) NULL;`  
- `RmUltimaStatusDescricaoRm`: `string?` **240** chars (snapshot `STATUS_DESCRICAO` última consulta bem-sucedida RM). Migration: idem **`IF NOT EXISTS`**.  
- Fluent `HasMaxLength` coerentes. Down conforme convenção projeto.

---

### 04.T2 — Lookup RM por vínculo portal (**D-SYN-01**)

**Files:**  
`Infrastructure/Rm/RmRequisicoesQueries.cs`, `IRmRequisicoesReadService`, `RmRequisicoesReadService`.

**Objective:** Um método assimétrico (nome final sua escolha), ex.:  
`Task<RmRequisicaoCodstatusRow?> GetCodStatusByPortalVinculoAsync(string rmRequisicaoCodigo, CancellationToken ct)`

**SQL:** parametrizado; filtros devem cobrir formato **real** cliente (par CHAVE quando documentado na Fase 3 produção).  
Documentar na doc da classe como `STUB-*` deve ser tratado pelo **consumidor** (T04.T3):

**Stub rule:** se `RmRequisicaoCodigo` começa com `STUB-` (case-insensitive), **não** abrir SQL — devolver **`null`** com semântica “sem fonte RM” para o sincronizador registrar mensagem opcional OU skip silencioso conforme política já descrita CONTEXT (*gap controlado*).

---

### 04.T3 — **`RmRequisicaoStatusMapResolver` + domínio de aplicação sync**

**Files sugeridos (ajuste ao layout real):**  
`Application/SolicitacoesVaga/` ou `Infrastructure/Rm/` — serviço dedicado **`ISolicitacaoVagaRmCodStatusSyncService`**:

**Responsabilidades:**
1. Carregar mapas tenant: `CodStatusRm` asc por `Priority` (nulls **last**) — primeira vitória (**D-SYN-04**).  
2. `Enum.TryParse<SolicitacaoStatus>(PortalStatusKey, ignoreCase: false)` — falha ⇒ **400-ish em API de mapa apenas** (T04.T7); durante sync ⇒ skip mudança status + log **`Warning`** (**D-SYN-07**).  
3. **Guardas estado terminal** `Reprovada`, `Cancelada`, `Concluida` — não alterar `SolicitacaoStatus` só por sync (**D-SYN-04**); ainda assim atualizar **`RmCodStatus`** + timestamps + **`STATUS_DESCRICAO`** em memória para DTO se leituras RM existirem (**D-SYN-03 cru**).  
4. **Anti-regresso:** se novo status mapeado for “inferior” a atual na ordem definida MVP (implementar comparador configurável minimal: enum ordem atual **Ou** igualdade + skip se tentativa regredir) — **skip** + persistir texto em **`RmStatusSyncUltimaMensagem`** (**D-SYN-04**). Comparador inicial pode ignorar granularidade desde que **logs** registrem regressão blocked. (*Executor: implementação mínima documentada linha código.*)  
5. `CODSTATUS` sem mapa:** não mover `SolicitacaoStatus`**, atualizar `RmCodStatus`, `RmUltimaSincronizacaoUtc`, limpar/sync mensagem apenas se erro RM.  

6. Ao **mudança real** `SolicitacaoStatus`: chamar **`StatusHistoricoService.RegistrarAsync`** (`TipoEntidadeStatus.SolicitacaoVaga`, ator sistema — ver padrões existentes com user null ou email “Sistema”).

**Transação:** `SaveChangesAsync` chamador agrupa batch (T04.T4).

---

### 04.T4 — **`IRmSyncRunService`** por lote (**D-SYN-02**)

Para cada disparo (**endpoint** ou **HostedService**):  
- `StartAsync` com **`Entidade = "SolicitacaoVagaCodStatus"`** (valor estável CONTEXT).  
- Processar até **N** solicitações elegíveis (config `MaxPerRun`, default pragmático 50).  
**Elegível:** tem `RmRequisicaoCodigo` não vazio **e** (estado permite sync — opcional só `!= terminal` antes RM call — alinhar T04.T3).  
- `FinishAsync`: contadores **`ProcessedOk` / `Skipped` / `Errored`** (usar estruturas existentes `FinishRmSyncRunRequest`; mapear campos disponíveis).

---

### 04.T5 — **Opções + endpoint POST disparo**

**Files:**  
`Infrastructure/Rm/RmSolicitacaoStatusSyncOptions.cs` (SectionName exemplo `RmSolicitacaoStatusSync`):

```json
{
  "Enabled": false,
  "IntervalMinutes": 15,
  "MaxPerRun": 50
}
```

**Endpoint:** exemplo `POST /api/admin/requisicoes-rm/sync-solicitacoes-status` (**rota final** deve seguir convenção controllers projeto).  

**Authorize:** mesmo perfil técnico usado operações RH integração (**não público anon**). Registrar em **permissionManifest** se exigido padrões atuais.  

**Payload opcional:** `{ "Ids": [...] }` — se vazio, processa lote até `MaxPerRun` das elegíveis.  

**Implementação:** chama orchestrator dos T04.T3–04.T4.

---

### 04.T6 — **`IHostedService`** background

**Files:** mesmo options T04.T5; classe `RmSolicitacaoStatusSyncHostedService` ou nome consistente registrar em `Program.cs`.

**Behavior:** apenas quando **`Enabled`** true; espera `IntervalMinutes` (**Timer**/**PeriodicTimer**); executa mesmo pipeline que POST com **lista vazia** (batch default).  

**Graceful shutdown:** cooperative cancel (**D-SYN-02** defaults).

---

### 04.T7 — **CRUD `RmRequisicaoStatusMaps`** (**SYN-01** admin)

**Contratos:** Requests/Responses mínimos (Create/Update/Delete/List/Get).  

**Validation:**  
- `PortalStatusKey` **deve** existir literalmente como nome de **`SolicitacaoStatus`** (validação servidor).  
- `CodStatusRm` + tenant únicos (violación → conflicto HTTP).

**Authorize:** configurador RH/admin apenas.

**Opcional MVP:** método **seed desenvolvimento** comentário em DbSeeder `if Environment...` (**nunca** obrigatório produção).

---

### 04.T8 — **DTOs + Integração Totvs tipo 9 (*D-SYN-06)**

**Objective:** Responses de detalhe e listagem já usadas pelo gestor exponham campos de sync.

**Acceptance:**
- `SolicitacaoVagaResponse` (e variações de grid usadas na API de solicitação): **`RmCodStatus`**, **`RmUltimaSincronizacaoUtc`**, **`RmStatusSyncUltimaMensagem`**, **`RmUltimaStatusDescricaoRm`** (mapeamento 1:1 entidade ou nome contrato público já adotado no projeto — ex.: `RmStatusLegendaRm` apenas se projeto padroniza alias camelCase cliente).  
- Quando CODSTATUS existe mas **sem** linha na tabela mapa:síntese amigável vem **`RmUltimaStatusDescricaoRm`** preenchida no sync (**T04.T3**) a partir da leitura RM; se vazia após erro, cliente mostra apenas código.  
- **`IntegracaoTotvsListItem`** / detalhe **tipo SolicitacaoVaga (9)**: acrescentar os mesmos campos **somente se** tipo DTO atual permitir extensão mínima; senão novo campo opcional combinado OU bullet em SUMMARY backlog micro (**04-VERIFY** última linha).

---

### 04.T9 — **Testes**

1. **`RmRequisicaoStatusMapResolver` / prioridade**: unit puro arquivo teste projeto existente (`RHPortal.Api.Tests`).  
2. **Guard estado terminal**: serviço mock DB InMemory já padrão `SolicitacaoVagaServiceTests`.  
3. **`PortalStatusKey` invalid** map create → **422/400**.

---

## Verification checklist (`04-VERIFY`)

Marcar após `$gsd-verify-work` ou review manual executor:

```
[ ] Migration idempotentes aplicadas sem erro em pelo menos tenant dev
[ ] POST sync + mapa válido atualiza SolicitacaoVaga.`RmCodStatus` + última mensagem erro path + legenda/descrição
[ ] CODSTATUS sem mapa não altera SolicitacaoStatus mas expõe DTO texto RM ou legenda última persistida
[ ] Terminal statuses nunca regressam apenas por sync
[ ] HostedService `Enabled=false` não causa queries RM em startup regress tests
[ ] CRUD sem migration ao inserir linha novo CodStatusRm
[ ] SYN painel tipo 9 exibe últimos campos sync se contrato atual permitir menor diff OR documentado backlog micro
```

## Plan metadata

```yaml
phase: 04-sincronismo-status-rm
requirements: [SYN-01, SYN-02, SYN-03]
gap_closure: false
```

---

*Next:* `$gsd-execute-phase 4`
