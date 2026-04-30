# Phase 4: Sincronismo status RM ⇄ Portal — Context

**Gathered:** 2026-04-30 · **Discuss-phase:** modo *defaults recomendados* (todas áreas cinzentas fechadas aqui)

## Phase boundary

Implementar **SYN-01 … SYN-03**: consultar **`CODSTATUS`** (e metadados úteis) no RM para solicitações já vinculadas (`IRM-02`), aplicar **`RmRequisicaoStatusMap`**, atualizar **`SolicitacaoVaga`**, expor timestamps/textos nos **DTOs** e permitir **parametrização sem nova migration** (dados na tabela existente).

**Fora do escopo desta fase:** UI Gestor §7 completa (**Fase 5**); workspaces RH estendidos (**Fase 6**); fluxo SEL pós-RM; alterar contrato de **criação** RM (**Fase 3** já entregue); substituir worker RM de **Vagas**/PFUNC (infra paralela — reutilizar padrões apenas).

## Canonical references

- [.planning/ROADMAP.md](../../ROADMAP.md) — Fase 4  
- [.planning/REQUIREMENTS.md](../../REQUIREMENTS.md) — SYN-01, SYN-02, SYN-03  
- [.planning/phases/03-integracao-rm-criacao/03-SUMMARY.md](../03-integracao-rm-criacao/03-SUMMARY.md) — vínculos `RmRequisicaoCodigo`, `RmCodStatus`, stub/retry  
- `RhPortal.Api/.../Domain/Entities/RmRequisicaoStatusMap.cs` — **SYN-01** storage já modelado (`CodStatusRm`, `PortalStatusKey`, `Priority`)  
- `RhPortal.Api/.../Domain/Entities/SolicitacaoVaga.cs` — `RmCodStatus`, `RmUltimaSincronizacaoUtc`, `RmRequisicaoCodigo`  
- `RhPortal.Api/.../Infrastructure/Rm/RmRequisicoesReadService.cs` + `RmRequisicoesQueries` — leitura lista/detalhe com **`CODSTATUS`**, **`STATUS_DESCRICAO`**  
- `RhPortal.Api/.../Application/IntegracaoTotvs/IRmSyncRunService.cs` + `RmSyncRun` — auditoria de ciclo sync (referência comportamental vagas/worker)

## Existing code observations

| Área | Estado |
|------|--------|
| SYN-01 tabela | `RmRequisicaoStatusMaps` + índice único `(TenantId, CodStatusRm)` |
| Leitura RM requisição | `IRmRequisicoesReadService.ListAsync`; linhas já trazem `Codstatus`, `StatusDescricao` |
| Armazenamento última sync parcial | `SolicitacaoVaga.RmUltimaSincronizacaoUtc` já existe; mensagem erro **dedicada** sync ainda não (ver D-SYN-03) |
| Padrão “job” no produto | Worker/ciclos externos + `RmSyncRun`/`RmSyncCheckpoint`; API expõe endpoints de ingestão e Owner panel |

## Decisions locked (defaults recomendados — discuss-phase)

### D-SYN-01 — Lookup da requisição no RM

- **Chave principal** de correspondência Portal → RM continua sendo o que **`IRM-02`** persistiu em **`RmRequisicaoCodigo`** (formato combinado pelo cliente de criação Fase 3: stub `STUB-{guid:N}`, produção quando existir será documentado junto ao cliente SQL/WS).
- Implementação técnica: expor método de leitura **por chave vinculada** (nova query parametrizada em `RmRequisicoesQueries` / serviço) que devolve **`CODSTATUS`** e **`STATUS_DESCRICAO`** mínimos; **não** depender apenas da listagem paginada para aplicar sync em massa.
- Se a chave não existir mais no RM: atualizar **`RmStatusSyncUltimaMensagem`** (D-SYN-03), **`RmUltimaSincronizacaoUtc`**, **não** alterar `SolicitacaoStatus` sem regra explícita futura (*gap controlado*).

### D-SYN-02 — Disparo (polling / combinado)

- **MVP em duas alças:**
  1. **Endpoint disparável** (ex.: POST restrito admin/RH/`Owner`/background key) **`Sync SolicitacaoVaga ↔ RM CODSTATUS`** que processa lote configurável (**top N** por tenant ou lista de IDs).
  2. **`IHostedService`** no API (nome sugerido documentado em `RmSolicitacaoStatusSyncOptions`) com **`IntervalMinutes`** configurável (`appsettings`); **`Enabled`** default **`false`** em templates locais para evitar churn acidental até CI definir política por tenant real.
- **Não obrigar** novo processo Worker separado na Fase 4; opcional reusar infra `TriggerRunNowAsync` apenas se já houver Makefile/CLI interno querendo mesmo padrão — **suficiente** HostedService + endpoint manual nos critérios de roadmap.
- Registrar execuções de **lote**: reusar **`IRmSyncRunService.StartAsync/FinishAsync`** com **entidade** string estável **`SolicitacaoVagaCodStatus`** (ou equivalente único em catálogo) para **painel Owner** e consistência operacional (**SYN-03 observabilidade).

### D-SYN-03 — Persistência última sincronização e erro (*§12.3*)

- Manter e atualizar sempre **`RmUltimaSincronizacaoUtc`** em **toda tentativa de sync bem formada** (sucesso RM ou erro de negócio previsível).
- Adicionar coluna nova **`RmStatusSyncUltimaMensagem`** (`character varying(2000)`, nullable) **apenas para sync de status**, separada de `IntegracaoMensagem` (criação TOTVS/IRM) — **migration idempotente** `ADD COLUMN IF NOT EXISTS` conforme política multi-tenant.
- **`RmCodStatus`**: sempre espelhar **último lido do RM**, mesmo quando não houver mapeamento Portal (SYN-02 exige “status cru”).
- Opcional MVP+: incluir campo derivado/exposto apenas em DTO **`RmStatusDescricaoUltima`** (snapshot da última leitura) sem obrigar novo persistido na entidade na primeira PR se o planner preferir ler só RAM no response — decisão menor deixada ao **implementador** desde que SYN-02 API mostre texto amigável.

### D-SYN-04 — Semântica do mapa (SYN-01) e `PortalStatusKey`

- Resolução: carregar mapas do **tenant atual**, ordenar por **`Priority` asc** (nulls last), **primeira entrada** por `CodStatusRm` **vence**.
- **`PortalStatusKey`**: **nome estável do membro** `SolicitacaoStatus` (**AUD-01** alinhado) — igual convenção atual da entidade `RmRequisicaoStatusMap` (ex.: `EmIntegracao`).
- **CODSTATUS sem mapa:**
  - Não mudar **`SolicitacaoStatus`** automaticamente (evita saltos ilegais);  
  - Expor em **`SolicitacaoVagaResponse`** (planejamento Fase 4) **`RmStatusLegenda`** usando **`STATUS_DESCRICAO` do RM quando disponível** ou texto neutro parametrizável.
- **Transições proibidas (guardas):** não mover de estados terminais **(`Reprovada`, `Cancelada`, `Concluida`)** apenas por sync automatizado sem configuração explícita posterior — MVP **bloqueado** (`if terminal → skip atualização PortalStatus`).
- **`Conflito` RM mais “atrás” que Portal**: MVP **preferir sempre estado mais avançado do Portal na máquina conhecida** — se sync tentar regredir, **skip + log mensagem** em `RmStatusSyncUltimaMensagem`.

### D-SYN-05 — Gestão parametrizável (admins atualizam mapa sem deploy)

- **API CRUD** (ou PATCH mínimo) para **`RmRequisicaoStatusMaps`** sob política/permissões **admin configurador**, seguindo padrão de controllers + manifest de navegação existentes.
- **Seed opcional** por ambiente apenas com **fallback dev** documentado — **não** exige migration para novo valor de negócio.
- **Validação:** rejeitar `PortalStatusKey` que não existe em `enum SolicitacaoStatus` (mensagem HTTP clara).

### D-SYN-06 — SUPERFÍCIES API SYN-02 (sem UI Fase 5)

- **`GetById` / lista** já usados por gestor devem incluir: `RmCodStatus`, **`RmUltimaSincronizacaoUtc`**, **`RmStatusSyncUltimaMensagem`**, `RmStatusLegenda`/`RmCodStatusFriendly` (nome final de contrato decidido na implementação respeitando naming existente nos DTOs), e **timeline** já cobre mudanças de status se escritas via serviço (AUD-01).
- Painel **`Integração TOTVS`** tipo 9: quando aplicável, refletir **últimos campos SYN** onde hoje aparece apenas integração resultado criação (extensão mínima de DTO lista/detalhe).

### D-SYN-07 — Observabilidade e testes

- Testes automatizados: **serviço de resolução de mapas** unitário + **integração memória**/SQL mock onde já for padrão do repo.
- Logs estruturados: nível **`Information`** no fim do lote (**count ok / skip / erro**); **`Warning`** código RM sem mapa.

## Deferred (backlog conscientemente)

| Item | Por quê |
|------|---------|
| Motor workflow gráfico / regras por tenant em JSON para mapa | Sobrecarga; tabela atual cobre MVP |
| Webhook push CODSTATUS desde RM substituindo poll | Depende infra cliente; só após política segurança definida |
| Reversão automatizada estado terminal quando RM cancela | Requer regra jurídica + UX confirmação — Fase posterior |

---

*Phase slug: `04-sincronismo-status-rm`*  

**Next step:** `$gsd-plan-phase 4` → pasta `04-sincronismo-status-rm/04-PLAN.md`; depois `$gsd-execute-phase 4`.
