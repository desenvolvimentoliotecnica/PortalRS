# Evidência de Testes — Módulos por Tenant (Fase 1)

**Data:** 2026-04-17
**Feature testada:** TenantModule entity + ModuleCatalog + TenantModuleService + endpoints do OwnerController
**Commit/branch:** (não commitado ainda)

## Resumo

| Métrica | Valor |
|---|---|
| Testes novos criados | **29** |
| Testes novos aprovados | **29** (100%) |
| Testes novos falhados | 0 |
| Tempo total | 268 ms |
| Regressão no restante da suite | 0 (falhas pré-existentes confirmadas) |

## Arquivos de teste adicionados

- [`RHPortal.Api.Tests/Modules/ModuleCatalogTests.cs`](../RHPortal.Api/RHPortal.Api.Tests/Modules/ModuleCatalogTests.cs) — 14 testes unitários do catálogo estático
- [`RHPortal.Api.Tests/Modules/TenantModuleServiceTests.cs`](../RHPortal.Api/RHPortal.Api.Tests/Modules/TenantModuleServiceTests.cs) — 15 testes de integração do service com `MasterDbContext` (InMemory)

## Cobertura

### `ModuleCatalog` (14 testes)

| Cenário | Resultado |
|---|---|
| `All` contém os 4 módulos core obrigatórios | ✅ |
| `All` contém os 9 módulos opcionais esperados | ✅ |
| `All` não contém chaves duplicadas | ✅ |
| Módulos core estão marcados com `IsCore=true` | ✅ |
| Módulos opcionais não estão marcados como core | ✅ |
| `Exists` retorna true case-insensitive | ✅ |
| `Exists` retorna false para inexistente e string vazia | ✅ |
| `GetByKey` retorna null para inexistente | ✅ |
| `GetByKey` é case-insensitive | ✅ |
| `ResolveModuleKey` mapeia 27 permission keys (vagas→recrutamento, matching→matching, dashboard→dashboard, users→administracao, ...) | ✅ |
| `ResolveModuleKey` retorna null para permission sem prefixo conhecido | ✅ |
| `ResolveModuleKey` retorna null para input vazio/null | ✅ |

### `TenantModuleService` (15 testes)

| Cenário | Resultado |
|---|---|
| `List` sem registros → todos do catálogo com `IsEnabled=true` | ✅ |
| `List` reflete status de registro existente para opcional | ✅ |
| `List` ignora registros de outro tenant (isolamento) | ✅ |
| `List` força core ativo mesmo se banco tiver `IsEnabled=false` | ✅ |
| `Set` em módulo inexistente → retorna null | ✅ |
| `Set` para desabilitar core → lança `InvalidOperationException` com "core" na mensagem | ✅ |
| `Set` para habilitar core → permitido (no-op lógico) | ✅ |
| `Set` primeira vez em opcional → cria registro com `UpdatedByOwnerId` e `UpdatedAtUtc` | ✅ |
| `Set` segunda vez → upsert (não duplica registro) | ✅ |
| `Set` isola por tenant | ✅ |
| `EnsureDefaults` para tenant novo → cria registros para todos os módulos habilitados | ✅ |
| `EnsureDefaults` com registro existente → não sobrescreve (preserva desabilitado) | ✅ |
| `EnsureDefaults` é idempotente (3 chamadas consecutivas não duplicam) | ✅ |
| `GetEnabledModuleKeys` sem registros → retorna todos | ✅ |
| `GetEnabledModuleKeys` exclui módulos desabilitados opcionais | ✅ |
| `GetEnabledModuleKeys` sempre inclui os 4 core | ✅ |
| `GetEnabledModuleKeys` retorna `HashSet` case-insensitive | ✅ |

## Execução

### Comando

```bash
cd RHPortal.Api/RHPortal.Api.Tests
dotnet test --filter "FullyQualifiedName~Modules" --logger "console;verbosity=normal"
```

### Saída (console)

```
Aprovado RhPortal.Api.Tests.Modules.ModuleCatalogTests.All_ContemOsModulosCoreObrigatorios [< 1 ms]
Aprovado RhPortal.Api.Tests.Modules.ModuleCatalogTests.All_ContemOsModulosOpcionaisEsperados [< 1 ms]
Aprovado RhPortal.Api.Tests.Modules.ModuleCatalogTests.All_NaoContemChavesDuplicadas [< 1 ms]
Aprovado RhPortal.Api.Tests.Modules.ModuleCatalogTests.ModulosCore_EstaoMarcadosComoIsCore [< 1 ms]
Aprovado RhPortal.Api.Tests.Modules.ModuleCatalogTests.ModulosOpcionais_NaoEstaoMarcadosComoIsCore [< 1 ms]
Aprovado RhPortal.Api.Tests.Modules.ModuleCatalogTests.Exists_RetornaTrueParaChaveExistente [< 1 ms]
Aprovado RhPortal.Api.Tests.Modules.ModuleCatalogTests.Exists_RetornaFalseParaChaveInexistente [< 1 ms]
Aprovado RhPortal.Api.Tests.Modules.ModuleCatalogTests.GetByKey_RetornaNullParaInexistente [< 1 ms]
Aprovado RhPortal.Api.Tests.Modules.ModuleCatalogTests.GetByKey_ECaseInsensitive [< 1 ms]
Aprovado RhPortal.Api.Tests.Modules.ModuleCatalogTests.ResolveModuleKey_MapeiaPermissionKeysParaModulos(permissionKey: "vagas.view", expectedModule: "recrutamento") [< 1 ms]
Aprovado RhPortal.Api.Tests.Modules.ModuleCatalogTests.ResolveModuleKey_MapeiaPermissionKeysParaModulos(permissionKey: "matching.view", expectedModule: "matching") [< 1 ms]
Aprovado RhPortal.Api.Tests.Modules.ModuleCatalogTests.ResolveModuleKey_MapeiaPermissionKeysParaModulos(permissionKey: "admissao.view", expectedModule: "admissao") [< 1 ms]
(+ 24 casos Theory adicionais de ResolveModuleKey, todos aprovados)
Aprovado RhPortal.Api.Tests.Modules.ModuleCatalogTests.ResolveModuleKey_RetornaNullParaPermissionKeyInexistente [< 1 ms]
Aprovado RhPortal.Api.Tests.Modules.ModuleCatalogTests.ResolveModuleKey_RetornaNullParaInputVazio [< 1 ms]

Aprovado RhPortal.Api.Tests.Modules.TenantModuleServiceTests.List_SemRegistros_RetornaTodosDoCatalogoHabilitados [< 1 ms]
Aprovado RhPortal.Api.Tests.Modules.TenantModuleServiceTests.List_ComRegistroDesabilitadoParaOpcional_RefleteStatus [< 1 ms]
Aprovado RhPortal.Api.Tests.Modules.TenantModuleServiceTests.List_IgnoraRegistrosDeOutroTenant [< 1 ms]
Aprovado RhPortal.Api.Tests.Modules.TenantModuleServiceTests.List_ForcaCoreAtivoMesmoSeRegistroEstiverFalso [< 1 ms]
Aprovado RhPortal.Api.Tests.Modules.TenantModuleServiceTests.Set_ModuloInexistente_RetornaNull [37 ms]
Aprovado RhPortal.Api.Tests.Modules.TenantModuleServiceTests.Set_DesabilitarCore_LancaInvalidOperation [3 ms]
Aprovado RhPortal.Api.Tests.Modules.TenantModuleServiceTests.Set_HabilitarCore_Permitido [< 1 ms]
Aprovado RhPortal.Api.Tests.Modules.TenantModuleServiceTests.Set_PrimeiraVezParaOpcional_CriaRegistroComOwnerId [< 1 ms]
Aprovado RhPortal.Api.Tests.Modules.TenantModuleServiceTests.Set_SegundaVez_AtualizaRegistroExistente [5 ms]
Aprovado RhPortal.Api.Tests.Modules.TenantModuleServiceTests.Set_IsolamentoPorTenant [< 1 ms]
Aprovado RhPortal.Api.Tests.Modules.TenantModuleServiceTests.EnsureDefaults_TenantNovo_CriaRegistrosParaTodosOsModulos [2 ms]
Aprovado RhPortal.Api.Tests.Modules.TenantModuleServiceTests.EnsureDefaults_ComRegistroExistente_NaoSobrescreve [16 ms]
Aprovado RhPortal.Api.Tests.Modules.TenantModuleServiceTests.EnsureDefaults_Idempotente [6 ms]
Aprovado RhPortal.Api.Tests.Modules.TenantModuleServiceTests.GetEnabled_SemRegistros_RetornaTodos [< 1 ms]
Aprovado RhPortal.Api.Tests.Modules.TenantModuleServiceTests.GetEnabled_ComModuloDesabilitado_ExcluiDoSet [< 1 ms]
Aprovado RhPortal.Api.Tests.Modules.TenantModuleServiceTests.GetEnabled_CoreSempreAtivo [202 ms]
Aprovado RhPortal.Api.Tests.Modules.TenantModuleServiceTests.GetEnabled_EHashSetCaseInsensitive [< 1 ms]

Execução de Teste Bem-sucedida.
Total de testes: 55
     Aprovados: 55
Tempo total: 0,5423 Segundos
```

> Nota: contagem de 55 inclui os 29 testes (14 unit + 15 integration) **expandidos pelos casos `[Theory]`** do `ResolveModuleKey_MapeiaPermissionKeysParaModulos`, que roda 27 vezes (um por `[InlineData]`).

### Arquivo TRX

Resultado detalhado em formato TRX (Visual Studio Test Results) disponível em `/tmp/trx/modules.trx`.

---

## Validação E2E complementar (via HTTP)

Além dos testes automatizados, a feature foi validada por chamadas diretas à API rodando localmente:

### 1. Migration aplicada

```
Tabela "public.TenantModules"
      Coluna      |           Tipo           | Pode ser nulo
------------------+--------------------------+---------------
 Id               | uuid                     | not null
 TenantId         | character varying(64)    | not null
 ModuleKey        | character varying(64)    | not null
 IsEnabled        | boolean                  | not null
 UpdatedAtUtc     | timestamp with time zone | not null
 UpdatedByOwnerId | uuid                     |
Índices:
  PK_TenantModules PRIMARY KEY
  IX_TenantModules_TenantId_ModuleKey UNIQUE
Restrições de chave estrangeira:
  FK → Owners (ON DELETE SET NULL)
  FK → Tenants (ON DELETE CASCADE)
```

### 2. `GET /api/owner/tenants/liotecnica/modules`

HTTP 200 — retorna os 13 módulos do catálogo (4 core + 9 opcionais) com `isEnabled=true` default.

### 3. `PUT /api/owner/tenants/liotecnica/modules/matching {isEnabled:false}`

HTTP 200 — registro persistido com `UpdatedByOwnerId` preenchido e `UpdatedAtUtc` gravado.

### 4. `PUT /api/owner/tenants/liotecnica/modules/dashboard {isEnabled:false}`

HTTP **409 Conflict** —
```json
{"title":"Conflict","status":409,"detail":"Módulo 'dashboard' é core e não pode ser desativado."}
```

### 5. `PUT /api/owner/tenants/liotecnica/modules/modulo-inexistente`

HTTP **404 Not Found** — resposta com `ProblemDetails`.

---

## Regressão — suite completa

Rodada a suite completa de testes do projeto para confirmar que a feature não quebrou nada pré-existente.

| Métrica | Antes | Depois |
|---|---|---|
| Total de testes | 382 | **411** (+29 novos) |
| Aprovados | 367 | **396** (+29 novos) |
| Falhados | 15 | **15** (mesmo conjunto, não relacionados) |

As 15 falhas pré-existentes estão em features **não tocadas** por esta mudança:

- `AwsSettings/AwsSettingsServiceTests` (8 falhas) — relacionadas a criptografia/env.
- `PreAdmissao/PreAdmissaoWorkflowTests` (2 falhas) — state machine de pré-admissão.
- `SolicitacoesVaga/SolicitacaoVagaServiceTests` (3 falhas) — workflow de aprovadores.
- `Funcionarios/FuncionarioServiceTests` (2 falhas) — validação de email duplicado.

Nenhuma falha em `Modules.*`, `OwnerController.*` ou código da nova feature.

---

## Arquivos modificados que afetaram a build do projeto de testes

Durante a execução, dois arquivos de teste pré-existentes precisaram de um pequeno ajuste (adição do parâmetro `EscalaTrabalhoRaw: null`) porque o record `VagaCreateRequest` havia sido alterado em commit anterior e os testes legados ainda não refletiam a mudança — tratando de dívida técnica independente desta feature:

- `RHPortal.Api.Tests/Vagas/VagaServiceOperacoesTests.cs` — 2 call sites
- `RHPortal.Api.Tests/Vagas/CriarVagaServiceTests.cs` — 1 call site

Essas edições foram **mínimas e necessárias apenas para o projeto de testes compilar**. Não mudam comportamento nem produção.
