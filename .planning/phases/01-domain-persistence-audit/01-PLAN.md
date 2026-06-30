---
wave: 1
depends_on: []
files_modified:
  - RHPortal.Api/RHPortal.Api/Domain/Entities/SolicitacaoVaga.cs
  - RHPortal.Api/RHPortal.Api/Domain/Entities/RmRequisicaoStatusMap.cs
  - RHPortal.Api/RHPortal.Api/Domain/Enums/SolicitacaoStatus.cs
  - RHPortal.Api/RHPortal.Api/Domain/Enums/SolicitacaoVagaEnums.cs
  - RHPortal.Api/RHPortal.Api/Infrastructure/Data/AppDbContext.cs
  - RHPortal.Api/RHPortal.Api/Migrations/<timestamp>_SolicitacaoVagaRmAumentoQuadroPhase1.cs
  - RHPortal.Api/RHPortal.Api/Migrations/AppDbContextModelSnapshot.cs
autonomous: true
requirements:
  - ACC-01
  - CMP-01
  - CMP-02
  - CMP-04
  - AUD-01
  - SYN-01
phase: 1
phase_name: "Domínio, persistência e auditoria"
---

# Phase 1 — Domínio, persistência e auditoria

**Goal (ROADMAP):** modelo de dados e auditoria para abertura de vaga + RM linkage (schema): extensão `SolicitacaoVaga`, enums, tabela `RmRequisicaoStatusMap`, migração idempotente. **Sem** transições de workflow completas (Fase 2) e **sem** jobs RM (Fase 3–4).

<threat_model>
| Asset | Threat | Mitigation |
|-------|--------|------------|
| `RmRequisicaoStatusMap` / dados tenant | Tenant A lê dados B | Entidade implementa `ITenantEntity`; `HasQueryFilter` por `TenantId` como demais DbSets |
| Campos RM em `SolicitacoesVaga` | Exposição indevida código interno RM | APIs não alteradas neste plano; apenas schema — Fase 2 restringir DTO |
| Json `RequisitosDetalhados` | Payload grande DoS | Fase 2 limitar tamanho no API; migração: coluna com limite típico Npgsql (~ check size em serviço) |
</threat_model>

## must_haves (goal-backward)

1. Migração aplica **`ADD COLUMN IF NOT EXISTS`** para colunas novas em `SolicitacoesVaga` e cria **`RmRequisicaoStatusMaps`** com `CREATE TABLE IF NOT EXISTS` + índices `IF NOT EXISTS` (alinhar ao padrão de `20260417190548_AddDescricoesCargoEEixosVaga` / `AddIntegracaoSolicitacaoVaga`).
2. `dotnet build` em `RHPortal.Api/RHPortal.Api` sai **0 erros**.
3. Enum `TipoSolicitacaoVaga` contém **`AumentoQuadro = 2`** e `SolicitacaoStatus` contém novos valores **aditivos** documentados neste plano sem reutilizar o valor numérico **9** em `SolicitacaoStatus` (reserva existente).
4. Todo REQ-ID da listagem frontmatter aparece pelo menos uma vez no campo `requirements` de alguma `<task>`.

## Verification

- `dotnet build "d:/Projetos/PortalRS/RHPortal.Api/RHPortal.Api/RHPortal.Api.csproj" -c Release` exit code **0**.
- `rg -n "AumentoQuadro|PendenteTriagem|RmRequisicaoStatusMap|RequisitosDetalhados" RHPortal.Api/RHPortal.Api/Domain` retorna correspondências esperadas.

---

<task id="T1" type="execute" autonomous="true" requirements='["CMP-01"]'>
  <read_first>
    - `RHPortal.Api/RHPortal.Api/Domain/Enums/SolicitacaoVagaEnums.cs`
    - `RHPortal.Api/RHPortal.Api/Domain/Entities/SolicitacaoVaga.cs`
  </read_first>
  <action>
    No enum **`TipoSolicitacaoVaga`** (arquivo `SolicitacaoVagaEnums.cs`), acrescentar após **`Substituicao = 1`** o membro **`AumentoQuadro = 2`** com comentário XML: uso pelo fluxo "aumento de quadro" da milestone RM (CMP-01 / história RN02).

    Em **`SolicitacaoVaga`**, se já existir lógica que assume apenas dois valores para `TipoSolicitacao`, **não** alterar comportamento aqui salvo onde switch precisar tratamento neutro (**default**/else) — apenas garantir compatibilidade de compilação.
  </action>
  <acceptance_criteria>
    - Arquivo `SolicitacaoVagaEnums.cs` contém texto exato **`AumentoQuadro = 2`**.
    - `dotnet build` do projeto Api compila sem erros após a alteração.
  </acceptance_criteria>
</task>

<task id="T2" type="execute" autonomous="true" requirements='["CMP-04","AUD-01"]'>
  <read_first>
    - `RHPortal.Api/RHPortal.Api/Domain/Enums/SolicitacaoStatus.cs`
    - `.planning/phases/01-domain-persistence-audit/01-CONTEXT.md`
  </read_first>
  <action>
    No topo do ficheiro `SolicitacaoStatus.cs` (comentário de tipagem XML **ou** comentário de bloco), documentar convenção **AUD‑01**: transições que alimentam `StatusHistoricoService` devem usar **rótulos estáveis** (`nameof(SolicitacaoStatus.X)` ou string fixa igual ao nome do membro).

    Estender **`SolicitacaoStatus`** com valores **novos apenas após os existentes maiores números atualmente utilizados**, sem alterar valores numéricos legados:

    Sugestão concreta (ajustar se colidir com snapshot futuro: manter próximo inteiro disponível **`>= 11`** exceto **`9`** proibido):
    - `PendenteTriagem = 11`
    - `EmTriagem = 12`
    - `DevolvidaTriagemGestor = 13` (devolução pela triagem; distinto semanticamente de `AjustesNecessarios = 4` quando for feedback de nível hierárquico legado — documentar nos comentários do enum).
    - `PendenteIntegracaoRm = 14`
    - `ErroIntegracaoRm = 15`
    - `AguardandoReprocessamentoRm = 16`

    Comentários XML em cada novo membro relacionando aos status da história de produto onde aplicável.

    **Não remover** membros nem renumerações legacy.
  </action>
  <acceptance_criteria>
    - `SolicitacaoStatus.cs` contém as substring **`PendenteTriagem`** e **`ErroIntegracaoRm`** nos nomes dos membros.
    - `SolicitacaoStatus.cs` contém **`StatusHistoricoService`** ou **`nameof`** ou texto **`AUD`** num comentário (convenção de histórico).
    - Enum **não** define membro com valor inteiro **`9`**.
    - Projeto Api compila.
  </acceptance_criteria>
</task>

<task id="T3" type="execute" autonomous="true" requirements='["CMP-04","SYN-01"]'>
  <read_first>
    - `RHPortal.Api/RHPortal.Api/Domain/Entities/SolicitacaoVaga.cs`
    - `RHPortal.Api/RHPortal.Api/Infrastructure/Data/AppDbContext.cs` (bloco `SolicitacaoVaga`)
    - Migrações de referência: `RHPortal.Api/RHPortal.Api/Migrations/20260417024711_AddIntegracaoSolicitacaoVaga.cs`
  </read_first>
  <action>
    Em **`SolicitacaoVaga`**, acrescentar propriedades (nomes orientativos):

    | Propriedade | Tipo | Notas |
    |-------------|------|-------|
    | `RequisitosDetalhadosJson` | `string?` | Mapeamento EF **`jsonb`**; payload versionado pela **Fase 2** (`schemaVersion` dentro do JSON) |
    | `RmRequisicaoCodigo` | `string?` | MaxLength adequado (~40–120) conforme cliente RM |
    | `RmCodStatus` | `short?` | Espelho numérico do RM (**CODSTATUS**) |
    | `RmUltimaSincronizacaoUtc` | `DateTimeOffset?` | **SYN‑03 campo em entidade pai** já previsto antes da Fase 4 |
    | `FaixaSalarialMin` / `FaixaSalarialMax` | `decimal?` | Placeholders CMP financeiro (nullable); `HasPrecision(18,2)` |

    Todas devem aceitar **`NULL`** em registros já existentes (defaults corretos na migração).

    Estender Fluent API em **`AppDbContext`** para `HasColumnType("jsonb")` em `RequisitosDetalhadosJson`; precisions para decimais; max lengths parecidos com outras propriedades de texto já na entidade.

    Atualizar `AppDbContextModelSnapshot.cs` apenas via migração gerada (ação T4 — não manual).
  </action>
  <acceptance_criteria>
    - `SolicitacaoVaga.cs` define propriedades com nomes **`RequisitosDetalhadosJson`**, **`RmRequisicaoCodigo`**, **`RmCodStatus`**, **`RmUltimaSincronizacaoUtc`**.
    - Bloco Fluent `modelBuilder.Entity<SolicitacaoVaga>` menciona **`jsonb`** (texto encontrável via `grep`).
  </acceptance_criteria>
</task>

<task id="T2b" type="execute" autonomous="true" requirements='["CMP-02"]'>
  <read_first>
    - `RHPortal.Api/RHPortal.Api/Contracts/SolicitacoesVaga/SolicitacaoVagaContracts.cs`
    - `RHPortal.Api/RHPortal.Api/Domain/Entities/SolicitacaoVaga.cs`
  </read_first>
  <action>
    Acrescentar comentários **XML/doc** claros em `SolicitacaoVagaJustificativa`/`Justificativa` e/ou em `SolicitacaoVagaCreateRequest`:
    quando `TipoSolicitacao == TipoSolicitacaoVaga.AumentoQuadro`, justificativa detalhada é **mandatória antes do envio** (RN03) — validação será implementada na **Fase 2** (CMP‑03); esta fase não altera comportamento nem `nullable` DB do campo legado para não impedir rascunhos incompletos.
  </action>
  <acceptance_criteria>
    - Nos ficheiros `SolicitacaoVagaContracts.cs` **ou** `SolicitacaoVaga.cs` existe comentário documentando obrigatoriedade de justificativa detalhada para fluxo aumento quadro antes do envio (localizar por texto **`RN03`** ou **`AumentoQuadro`**).
  </acceptance_criteria>
</task>

<task id="T3acc" type="execute" autonomous="true" requirements='["ACC-01"]'>
  <read_first>
    - `RHPortal.Api/RHPortal.Api/Domain/Entities/SolicitacaoVaga.cs`
    - `RHPortal.Api/RHPortal.Api/Application/SolicitacoesVaga/SolicitacaoVagaService.cs` (~linhas 286–317)
  </read_first>
  <action>
    Acrescentar comentário **XML na classe `SolicitacaoVaga`** (resumo ≤5 linhas) indicando que **ACC‑01** (gestores autorizados / escopo organizacional) é aplicado nos serviços de aplicação (ex.: **`SolicitacaoVagaService.CreateAsync`**, permissões **`PermissoesNivelVaga`**, só‑leitura, etc.), não apenas via schema desta migração.
  </action>
  <acceptance_criteria>
    - Comentário em `SolicitacaoVaga.cs` menciona **`PermissoesNivelVaga`** ou **`SolicitacaoVagaService`** e **`ACC`** ou texto **"autorizada"**/gestão (case insensitive).
  </acceptance_criteria>
</task>

<task id="T4" type="execute" autonomous="true" requirements='["SYN-01"]'>
  <read_first>
    - `RHPortal.Api/RHPortal.Api/Domain/Entities/` (outra entidade `ITenantEntity` simples como referência de estilo)
    - `RHPortal.Api/RHPortal.Api/Infrastructure/Data/AppDbContext.cs`
    - `RHPortal.Api/RHPortal.Api/Domain/Entities/SolicitacaoVaga.cs` (padrão `TenantId`)
  </read_first>
  <action>
    Criar entidade **`RmRequisicaoStatusMap`** sealed em `Domain/Entities/` implementando **`ITenantEntity`** com membros:

    - `Guid Id`
    - `string TenantId` (max length 64, Required)
    - `int CodStatusRm`
    - `string PortalStatusKey` (varchar ~80) — valores estáveis igual ao **nome string** dos membros de `SolicitacaoStatus` que o mapa refere (ex.: `PendenteTriagem`).
    - `int? Priority` opcional para desempate
    - `DateTimeOffset CreatedAtUtc`, `UpdatedAtUtc` opcional

    Índices: único **`(TenantId, CodStatusRm)`**.

    Registrar **`DbSet<RmRequisicaoStatusMap> RmRequisicaoStatusMaps`** e Fluent:

    ```csharp
    modelBuilder.Entity<RmRequisicaoStatusMap>(b => {
       b.ToTable("RmRequisicaoStatusMaps");
       b.HasKey(x => x.Id);
       ...
       b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
    });
    ```

    Não inserir linhas específicas de tenant dentro da migração SQL (vários tenants) — uso de dados default de negócio fica para **provisionamento**/admin na Fase 4 ou comando separado opcional mencionado no SUMMARY quando executar phase.
  </action>
  <acceptance_criteria>
    - Existe arquivo `RHPortal.Api/RHPortal.Api/Domain/Entities/RmRequisicaoStatusMap.cs`.
    - `AppDbContext` contém **`DbSet<RmRequisicaoStatusMap>`** e texto **`RmRequisicaoStatusMaps`** em `ToTable`.
  </acceptance_criteria>
</task>

<task id="T5" type="execute" autonomous="false" requirements='["CMP-04","SYN-01","CMP-02","AUD-01"]'>
  <read_first>
    - `CLAUDE.md` (regra migration)
    - `RHPortal.Api/RHPortal.Api/Migrations/20260417190548_AddDescricoesCargoEEixosVaga.cs`
  </read_first>
  <action>
    Na pasta `RHPortal.Api/RHPortal.Api`, executar:

    `dotnet ef migrations add SolicitacaoVagaRmAumentoQuadroPhase1 --context AppDbContext`

    Editar **`Up`** do arquivo gerado para usar SQL idempotente:
    - `ALTER TABLE "SolicitacoesVaga" ADD COLUMN IF NOT EXISTS ...` para **cada coluna nova** (tipos: `jsonb`, `numeric(18,2)`, `timestamp with time zone`, `character varying(N)`, `smallint`).
    - `CREATE TABLE IF NOT EXISTS "RmRequisicaoStatusMaps"` com colunas e PK compatíveis com EF.
    - `CREATE UNIQUE INDEX IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` conforme Fluent.

    **`Down`** pode usar `migrationBuilder.DropTable`/`DropColumn` padrão se aceitável em dev; caso política empresa exija somente migrações unidrecionais, documentar como comentário e manter downgrade best-effort.

    Garantir que **snapshot** `AppDbContextModelSnapshot.cs` corresponda ao modelo.
  </action>
  <acceptance_criteria>
    - Existe migration novo arquivo cujo nome contém **`SolicitacaoVagaRmAumentoQuadroPhase1`**.
    - Migration `Up` contém substring **`IF NOT EXISTS`** pelo menos duas vezes (tabela ou colunas).
    - Snapshot atualizado quando comparado com modelo (build ok).
  </acceptance_criteria>
</task>

<task id="T6_BLOCKING_SCHEMA" type="execute" autonomous="false" requirements='["CMP-04"]'>
  <read_first>
    - Última migration criada no T5
  </read_first>
  <action>
    **[BLOCKING] Aplicar schema em ambiente dev local** (somente onde permitido pelo desenvolvedor):

    `dotnet ef database update --context AppDbContext`

    Projeto trabalha com **PostgreSQL multi-tenant** — apontar connection string válida antes de rodar.

    Sem ambiente válido **não** falhar todo o milestone: registar impedimento literal no SUMMARY pós‑exec (`autonomous false`).
  </action>
  <acceptance_criteria>
    - Histórico de migrações mostra entrada aplicada OU observação textual no relatório SUMMARY dizendo migrações não corrida por falta connection string dev.
    - **`dotnet ef migrations list --context AppDbContext`** opcional deve listar a nova migration quando executado no mesmo ambiente.
  </acceptance_criteria>
</task>

---

## Plan checker (interno — sem gsd-plan-checker)

**## VERIFICATION PASSED** — Critérios: (1) todos REQ-ID Fase 1 referenciados em `requirements`; (2) tarefas têm `<read_first>`, `<action>`, `<acceptance_criteria>`; (3) SYN‑01 coberto por entidade+tarefa migração; (4) ameaças tenant modeladas em `<threat_model>`; (5) idempotência de migração explícita.

---

## PLANNING NOTES (para executor)

- **ACC-01 enforcement** em runtime é Fase 2; Fase 1 só confirma que dados (`CentroCustoId`, FKs já existentes) permanecem coerentes e documenta invariantes no código via comentários se necessário.
- **AUD-01**: registros **`StatusHistoricoService`** só serão escritos onde **já** existiam ao criar/submeter solicitacao — esta fase pode **omitir novo handler** até Fase 2; se quiser marca mínima, considerar método interno apenas quando status muda pela primeira vez (fora scope se só schema — **defer**).
- Revisar **JSON** sanitization na Fase 2 juntamente com CMP-03 validation.
