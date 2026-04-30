# Phase 1: Domínio, persistência e auditoria — Context

**Gathered:** 2026-04-30  
**Status:** Ready for planning

<domain>

## Phase Boundary

Entregar modelo de dados e auditoria para o fluxo de **abertura de vaga (aumento de quadro)** com RM: persistência em tenant DB, parametrização de mapeamento RM↔portal (armazenamento), enum/campos de status alinhados à história, e trilhas de auditoria mínimas em **criação/rascunho**. **Sem** máquina de estados operacional completa (Fase 2), **sem** escrita RM (Fase 3), **sem** UI nova (Fase 5).

</domain>

<decisions>

## Implementation Decisions

### Agregado e nomenclatura (vs ROADMAP v1 inicial)

- **D-01:** **Não** criar um novo agregado paralelo tipo `SolicitacaoAberturaVaga`. **Estender** a entidade existente `RhPortal.Api.Domain.Entities.SolicitacaoVaga`, que já cobre fluxo gestor→aprovação, vínculo `VagaId`, campos Totvs (`IntegracaoResultado`, tentativas, etc.) e `TipoSolicitacao`. O fluxo “aumento de quadro” desta milestone deve modelar‑se como evolução de **SolicitacaoVaga + Tipo/motivos**, não um segundo modelo concorrente.
- **D-02:** Para “aumento de quadro” explícito, usar **`TipoSolicitacaoVaga`** existente (**`VagaNova` = aumento/definitivo** no vocabulário atual) **ou** introduzir valor enum **adicional** `AumentoQuadro` apenas se produto distinguir semanticamente de `VagaNova` nos relatórios/RM — preferência: **valor dedicado `AumentoQuadro`** se a integração RM exigir tipo distinto; caso contrário **`VagaNova` + `MotivoRequisicaoId`** parametrizável. Planner deve confirmar com contrato RM (Fase 3).

### Estados do portal vs `SolicitacaoStatus`

- **D-03:** Estados da história (§8) **não** substituem de uma só vez o enum `SolicitacaoStatus` legado **sem** migração de dados. Para Fase 1: **expandir** `SolicitacaoStatus` de forma **aditiva** (novos valores `short`), preservando valores atuais. Mapeamento sugerido inicial (ajustável na Fase 2):
  - Rascunho → `Rascunho`
  - Pendente triagem / Em triagem → **novos** `PendenteTriagem`, `EmTriagem` (nomes Pascal conforme C#)
  - Devolvida → alinhar a `AjustesNecessarios` **ou** novo `DevolvidaAjustes` se relatórios exigirem distinção de “ajustes aprovador” vs “triagem”; default locked: **`DevolvidaTriagemGestor`** (novo valor) vs manter `AjustesNecessarios` apenas se semântica bater — **resolver na implementação**: se hoje `AjustesNecessarios` já significa feedback do superior, **reutilizar** e acrescentar triagem só com novos valores.
  - Estados pós‑RM (“Pendente integração RM”, “Erro integração”) → alinhar a `EmIntegracao` existente **e** novos valores **`PendenteIntegracaoRm`, `ErroIntegracaoRm`, `AguardandoReprocessamento`** se necessário para CA09 — Fase 1 pode **reservar** valores + colunas RM (`RmRequisicaoCodigo`, `RmCodStatus`, `UltimaSyncRmUtc`) mesmo com lógica preenchida na Fase 3–4.
- **D-04:** Separar **status canônico interno** (enum) de **rótulos exibíveis**: tabela ou resource PT‑BR opcional na Fase 5; Fase 1 prepara enum estável.

### Campos do formulário (§7.x)

- **D-05:** Campos já existentes em `SolicitacaoVaga` (cargo, empresa, CC, quantidade, justificativa, tipo contrato, etc.) **reutilizar**. Para listas grandes (linguagens, ferramentas, competências comportamentais) usar **`jsonb`** em coluna nova `RequisitosDetalhadosJson` (nome final a cargo do planner) com **contrato JSON versionado (`schemaVersion`)** validado na API na Fase 2 — evita explosão de colunas na migração Fase 1. Alternativa rejeitada para MVP da migração: dezenas de colunas texto.
- **D-06:** Campos financeiros sensíveis (faixa salarial, verba) — colunas dedicadas nullable ou dentro do JSON conforme política LGPD/consultoria jurídica; **Fase 1** cria placeholders alinhados à história (**colunas opcionais** ou sub‑objeto JSON com mesma política que dados salariais em `Vaga`/`SolicitacaoVaga` existentes).

### Mapeamento `CODSTATUS` RM (SYN‑01 schema)

- **D-07:** Nova tabela tenant **`RmRequisicaoStatusMap`** (`Id`, `TenantId`, `CodStatusRm` int, `PortalStatusKey` string ou FK para código enum, `Prioridade` opcional). Seed/default linhas espelham §9 da história como **dados**, não código fixo.

### Auditoria (AUD‑01)

- **D-08:** Continuar usando **`StatusHistoricoService`** com `TipoEntidadeStatus.SolicitacaoVaga` para transições de status com **strings estáveis** (nomes dos enums ou keys fixas). Fase 1 garante registros para **Created**, **Draft saved** (opcional granularidade via observação ou evento único ao sair rascunho na Fase 2).
- **D-09:** Se eventos não forem apenas mudanças de status, considerar segunda tabela **`SolicitacaoVagaEvento`** apenas se necessário para CA10/integration logs **além** do histórico de integração já previsto (`TentativasIntegracao`) — **default Fase 1:** não criar segunda tabela; expandir apenas se planner identificar lacuna vs RN10.

### RBAC modelo (ACC‑01 storage)

- **D-10:** Enforcement completo é Fase 2; Fase 1 adiciona **FKs opcionais** ou índices se necessários: `CentroCustoId` / estrutura já amarra área — documentar que **scopes** são validados contra `Funcionario`/hierarquia existente igual `SolicitacaoVagaService` hoje.

### Migrações

- **D-11:** Seguir **`CLAUDE.md`**: migrações idempotentes onde aplicável (`IF NOT EXISTS` para cenário multi‑tenant heterogêneo).

### Agente — discrição

- Nomes finais exatos de colunas JSON/tabelas.  
- Exatamente quais novos valores `SolicitacaoStatus` após revisit com produto versus reutilização de `AjustesNecessarios` / `EmIntegracao`.  
- Normalização PT‑BR de labels §8 em resources.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning / product

- `.planning/PROJECT.md` — baseline Validated, milestone goal, decisão RM como system of record  
- `.planning/REQUIREMENTS.md` — ACC‑01, CMP‑01‑04, AUD‑01, traceability Phase 1  
- `.planning/ROADMAP.md` — Fase 1 goal, critérios de sucesso, riscos  
- `CLAUDE.md` — regras de migration EF multi‑tenant  

### Código dominio existente

- `RHPortal.Api/RHPortal.Api/Domain/Entities/SolicitacaoVaga.cs` — **agregado a estender**  
- `RHPortal.Api/RHPortal.Api/Domain/Enums/SolicitacaoStatus.cs` — enum de workflow atual  
- `RHPortal.Api/RHPortal.Api/Domain/Enums/SolicitacaoVagaEnums.cs` — `TipoSolicitacaoVaga`, etc.  
- `RHPortal.Api/RHPortal.Api/Domain/Entities/Vaga.cs` — relacionamento atual `VagaId` em solicitações aprovadas  
- `RHPortal.Api/RHPortal.Api/Application/SolicitacoesVaga/SolicitacaoVagaService.cs` — fluxos e integração Totvs hooks  
- `RHPortal.Api/RHPortal.Api/Application/Common/StatusHistoricoService.cs` — padrão de auditoria de status  

### Contratos API existentes

- `RHPortal.Api/RHPortal.Api/Contracts/SolicitacoesVaga/SolicitacaoVagaContracts.cs`  

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- **`SolicitacaoVaga`** + **`SolicitacaoVagaService`** — formulário gestor parcial já existe; nova milestone enriquece campos e ciclo até RM sem duplicar entidade  
- **`StatusHistoricoService`** — auditoria já acoplada nas transições de solicitação de vaga  
- **`MotivoRequisicaoId` / `MotivosRequisicaoVagaConfig`** — parametrização de motivo (RN02/RN03)  
- **`IntegracaoTotvsService`** (`TipoIntegracao.SolicitacaoVaga`) — trilho existente para leitura/integrações  

### Established Patterns

- **`ITenantEntity`** + **`AppDbContext`** com query filters tenant  
- **Enums em `short`** para status compatíveis com PostgreSQL ef  
- **`EmIntegracao`**, **`TentativasIntegracao`**, **`UltimaTentativaUtc`** — modelo já prevê retries  

### Integration Points

- **Fase 2:** transições e validação CMP‑03 em `SolicitacaoVagaService` ou serviço de domínio extraído  
- **Fase 3:** preenchimento de código RM e estados erro em integração já alinhados a propriedades existentes na entidade  
- **Fase 5/6:** contratos/contracts DTO já em `Contracts/SolicitacoesVaga`

</code_context>

<specifics>

## Specific Ideas

- Produto já trata **`VagaNova`** como contratação nova; historia fala só “aumento de quadro” — alinhar copy e enum com negócio (D‑02).  
- História lista muitos **status UX** §8 — implementação gradual: enum técnico mínimo Fase 1–2 + mapa UX em camada de apresentação se necessário.

</specifics>

<deferred>

## Deferred Ideas

- Mecânismo técnico de **escrita** da requisição no RM — Fase 3 (spike)  
- Sincronismo periódico **CODSTATUS** — Fase 4  
- **Triagem RH** workforce UI — Fases 5–6  
- Lista detalhada backlog: duplicar `SolicitacaoVaga` em microserviço separado — **fora de escopo** (explicitamente contra D‑01)

### Reviewed Todos (not folded)

- Nenhum `gsd-sdk todo.match-phase` disponível neste ambiente — nada registado.

</deferred>

---

*Phase: 01-domain-persistence-audit · Context gathered: 2026-04-30*
