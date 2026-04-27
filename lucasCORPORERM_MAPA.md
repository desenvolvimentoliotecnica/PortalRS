# Mapa do CORPORERM (TOTVS RM) — Dicionário de Tabelas

> **Última atualização:** 2026-04-26
> **Mantenedor:** Equipe de integração Liotécnica
> **Dono lógico:** Lucas Machado

---

## 1. Introdução

### 1.1 O que é o CORPORERM

`CORPORERM` é o banco do **TOTVS RM** (ERP de gestão de RH/Folha da TOTVS) usado pela **Liotécnica**.
**Não é** banco da nossa aplicação — é o banco do sistema legado do cliente.

A aplicação `Voltage.RenderRH` **lê dados** do CORPORERM via worker
[Liotecnica.Integration.RM/](Voltage.RenderRH/Liotecnica.Integration.RM/), transforma para JSON
intermediário e envia via REST para nossa API ([RHPortal.Api/](Voltage.RenderRH/RHPortal.Api/)) que
persiste em PostgreSQL multi-tenant.

```
CORPORERM (SQL Server, externo, READ-ONLY)
        │
        │  ApplicationIntent=ReadOnly
        ▼
[Liotecnica.Integration.RM] worker
        │
        │  SELECT * FROM tabela → JSON em disco
        ▼
[Liotecnica.Integration.RM.Schema.Tables/*.json]
        │
        │  POST /api/.../sync-rm/bulk
        ▼
[RHPortal.Api] (PostgreSQL multi-tenant)
```

### 1.2 Conexão

- **Server:** `172.19.30.3`
- **Database:** `CORPORERM`
- **Usuário:** `rm_readonly_voltage` (somente leitura)
- **ApplicationIntent:** `ReadOnly` — garante que SQL Server bloqueia qualquer DML
- **Configuração:** [Liotecnica.Integration.RM/appsettings.json:8-17](Voltage.RenderRH/Liotecnica.Integration.RM/appsettings.json)
- **Histórico:** antes era `svr-sql-hmg` (172.19.30.7) `CORPORERM_HMG` user `rm`

> ⚠️ **Gotcha de segurança:** [Liotecnica.Integration.RM/appsettings.Development.json](Voltage.RenderRH/Liotecnica.Integration.RM/appsettings.Development.json)
> tem a senha `YkmF@2022*` em texto plano. Confirmar `.gitignore` e rotacionar.

### 1.3 Volume

- Total de tabelas no banco: **8.562** (extraído via `INFORMATION_SCHEMA.TABLES`)
- Tabelas que efetivamente lemos: **~25** (refator de 2026-04-26)
- Tabelas mapeadas neste documento: **~150** (cobertura dos principais módulos do TOTVS RM)

### 1.4 Convenção de prefixos TOTVS RM

| Prefixo | Significado | Exemplos |
|---|---|---|
| **P*** | Tabela base de Pessoa/RH (Labore núcleo) | PPESSOA, PFUNC, PFUNCAO, PCARGO, PSECAO, PFHSTSAL |
| **F*** | Folha de pagamento (Labore) | FCHFUNFUN, FOPAG, FFICHA |
| **V*** | View ou tabela auxiliar de visão | VHIERARQUIA, VFORMACAOACAD, VCURRICULOANEXO |
| **VRS*** | Recrutamento e Seleção (módulo VRS) | VRSVAGAS, VRSSELECOESVAGASCANDIDATOS |
| **VREQ*** | Requisições (movimentação) | VREQDESLIGAMENTO, VREQAUMENTOQUADRO, VREQSUBSTITUICAO, VREQTRANSFPROMOCAO |
| **VHIST*** | Histórico de alteração | VHISTFUNCAO, VHISTPOSICAO, VHISTTABELASALARIAL |
| **VPLANO*** | Planos (carreira, treinamento, vagas) | VPLANOCARREIRA, VPLANOTREINAMENTO |
| **G*** | Tabelas globais/gerais (Gestão) | GFILIAL, GCOLIGADA, GUSUARIO |
| **B*** | Cadastros base (Backoffice) | BAREA |
| **L*** | Tabelas do Labore extension | LUNIDADE, LCATEGORIA |
| **H*** | Tabelas históricas / categorias | HCATEGORIA |
| **E*** | Cadastros do Labore (legado) | EFUNCIONARIO, EALOCACAO |
| **S*** | Soft House / módulos auxiliares | SVAGAS, SPESSOA, SEMPRESAFUNCIONARIO |
| **SCV*** | Sistema de Currículo Vitae (acadêmico) | SCVATUACAOPROFISSIONAL, SCVFORMACAOACADEMICA |
| **SZ*** | Customizações Soft Zero (Portal externo) | SZPORTALCADASTRO, SZPORTALLOGIN |
| **SPS*** | Seleção de Pessoal (controle de quadros) | SPSCONTROLEVAGAS |
| **X*** | Extensões customizadas / pessoa física | XPESSOAFISICA |
| **U*** | Educacional/Acadêmico | UCANDIDATOPROCSEL |

### 1.5 Como usar este documento

1. **Procurando uma tabela específica?** Ctrl+F pelo nome (ex: `PFUNC`, `VRSVAGAS`).
2. **Procurando um dado de negócio?** Use a [Seção 2 — Índice rápido](#2-índice-rápido).
3. **Procurando "como fazer"?** Veja a [Seção 6 — Cookbook de queries SQL](#6-cookbook-de-queries-sql).
4. **Quer entender o mapeamento RM → nosso Portal?** [Seção 5](#5-mapeamento-rm--portal-coluna-a-coluna).
5. **Quer evitar pegadinhas?** [Seção 7 — Gotchas](#7-gotchas-e-regras-de-negócio).

### 1.6 Status das tabelas no projeto

- ✅ **Sincronizada** — lida E enviada ao Portal
- 🔍 **Lida sem sync** — extraída para JSON, mas ainda não sincronizada
- ⚠️ **Documentada não usada** — conhecemos, podemos precisar no futuro
- ➖ **Conhecida (TOTVS)** — existe no banco, mapeada aqui só por completude

---

## 2. Índice rápido

### 2.1 Tabelas que efetivamente usamos hoje

| Tabela | Módulo | Propósito | Status | Arquivo .cs |
|---|---|---|---|---|
| `BAREA` | Cadastros | Áreas (configurada mas não usada na prática) | ➖ | — |
| `PSECAO` | Cadastros | Departamentos/seções (estrutura pai/filho) | ✅ | [PortalAreaSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalAreaSyncService.cs) |
| `PCARGO` | Cadastros | Cargos (níveis: Diretoria, Gerência…) | ✅ | [PortalCargoSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalCargoSyncService.cs) |
| `PFUNCAO` | Cadastros | Funções (nome do cargo: Analista de Sistemas) | ✅ | [PortalCategoriaSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalCategoriaSyncService.cs) |
| `GFILIAL` | Cadastros | Filiais/estabelecimentos (Empresas + Units) | ✅ | [PortalEmpresaSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalEmpresaSyncService.cs), [PortalUnitSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalUnitSyncService.cs) |
| `LUNIDADE` | Cadastros | Unidades (alternativa, geralmente vazia) | 🔍 | — |
| `PPESSOA` | Pessoas | Cadastro mestre de pessoas (CPF, email, endereço) | ✅ | [PortalPessoaSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalPessoaSyncService.cs) |
| `PFUNC` | Pessoas | Funcionários (vínculo empregatício, salário, situação) | ✅ | [PortalFuncionarioSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalFuncionarioSyncService.cs) |
| `XPESSOAFISICA` | Pessoas | Pessoa física (filiação, naturalidade) — Liotécnica | 🔍 | extração apenas |
| `EFUNCIONARIO` | Pessoas | Funcionários (Labore legado, vazia em PROD) | ➖ | — |
| `SEMPRESAFUNCIONARIO` | Pessoas | Empresa↔Funcionário (Soft House, fallback) | ⚠️ | — |
| `VHIERARQUIA` | Hierarquia | Organograma (nó pai/filho) | ✅ | [PortalHierarquiaSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalHierarquiaSyncService.cs) |
| `VHIERARQUIACOLIGADAEXTERNA` | Hierarquia | Liga funcionário ↔ nó hierárquico | 🔍 | extração apenas (vazia em PROD) |
| `VQUADHIERARQUIA` | Hierarquia | Quadrante na hierarquia | 🔍 | extração apenas |
| `PFUNCLIDERHRPLATFORM` | Hierarquia | Líder HR Platform | 🔍 | extração apenas |
| `VWPFUNCHIERARQUIA` | Hierarquia | View consolidada PFUNC × Hierarquia | 🔍 | extração apenas |
| `VRSVAGAS` | Vagas | Vagas em aberto (módulo VRS) | ✅ | [PortalVagaSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalVagaSyncService.cs) |
| `VVAGA` | Vagas | Cadastro simples de vagas (alternativa) | ➖ | configurável via VagaTable |
| `VRSSELECOESVAGASCANDIDATOS` | Vagas | Candidatos por vaga VRS | ✅ | [PortalCandidatoVagaSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalCandidatoVagaSyncService.cs), [PortalTalentoSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalTalentoSyncService.cs) |
| `VREQDESLIGAMENTO` | Movimentação | Solicitações de desligamento | ✅ | [PortalDesligamentoSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalDesligamentoSyncService.cs) |
| `VREQAUMENTOQUADRO` | Movimentação | Requisição de vaga nova (origem da vaga) | ✅ | usado em PortalVagaSyncService |
| `VREQSUBSTITUICAO` | Movimentação | Substituição de funcionário (origem de vaga) | ✅ | usado em PortalVagaSyncService |
| `VREQTRANSFPROMOCAO` | Movimentação | Transferência ou promoção concluída | ✅ | usado em PortalFuncionarioSyncService e MovimentacaoSync |
| `PFHSTSAL` | Folha | Histórico salarial (mudanças de salário) | ✅ | [PortalHistoricoSalarialSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalHistoricoSalarialSyncService.cs) |
| `VFORMACAOACAD` | CV | Formação acadêmica (cursos, instituições) | ✅ | [RmDataExtractor.cs:211](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs) |
| `SCVATUACAOPROFISSIONAL` | CV | Experiência profissional do candidato | ✅ | [RmDataExtractor.cs:232](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs) |
| `VCOMPETENCIAPESSOA` | CV | Competências da pessoa | ✅ | [RmDataExtractor.cs:251](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs) |
| `VCERTIFICACAOPESSOA` | CV | Certificações | ✅ | [RmDataExtractor.cs:270](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs) |
| `VCURRICULOANEXO` | CV | Currículo em arquivo (PDF binário) | ✅ | [RmDataExtractor.cs:373](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs) |

### 2.2 Tabelas mapeadas mas ainda não usadas (módulos TOTVS principais)

Resumo do inventário amplo. Ficha completa em cada seção.

| Módulo | Tabelas mapeadas | Total de tabelas (prefixo) |
|---|---|---|
| Vagas e recrutamento (VRS, S, V) | VVAGA, SVAGAS, VREQUISICAOPESSOAL, VRSSELECOES, VRSSELECOESVAGAS, VRSSELECOESPESSOASVAGAS, VVAGAPESSOA, SVAGASCANDIDATOS, SCANDIDATOPROCSEL, SPSCONTROLEVAGAS, VRSTRIAGEM, VRSVAGASCOMPL, VRSVAGASFILIAIS, VRSVAGASPERFILPROF, VRSPERGUNTASCAPTACAO, VRSQUESTIONARIOCAPTACAO | 60+ |
| Folha (Labore) | FCHFUNFUN, FOPAG, FFICHA, PFFINANC, PFFOLHA, PFHSTAFAS, PFHSTFER (e variantes) | 200+ |
| Currículo SCV | SCVFORMACAOACADEMICA, SCVAREAATUACAO, SCVAREACONHECIMENTO, SCVIDIOMA, SCVPREMIO, SCVEVENTO, SCVPRODBIBLIOGRAFICA, SCVPRODUCAOTECNICA, SCVPRODUCAOCULTURAL, SCVPROJETOPESQUISA, SCVEQUIPEPESQUISA, SCVPROFESSOR, SCVBANCA, SCVORIENTACAO, SCVCITACAO, SCVPALAVRACHAVE, SCVSETORATV | 40+ |
| Formação/CV (views) | VFORMACAOADIC, VFORMACAOADICCOMPL, VCURSOSPESSOAIS, VUSUARIOCURRICULO, VCANDIDATOS, VCANDIDATOCOLIGADA, VCANDIDATOHISTCONSENT | 20+ |
| Treinamento | VPLANOTREINAMENTO, VPLANOTREINA, VPLANOTREINACURSO, VPLANOTREINAMENTOVERBA, VTREINAMENTO, VTURMATREINAMENTO, VPLANOCARREIRA, VPLANOCURSO, VPLANOMETAS, VPLANORECRUTAMENTO, VPLANOVAGAS, VPLANOALCADA | 25+ |
| Histórico (VHIST*) | VHISTFUNCAO, VHISTPOSICAO, VHISTTABELASALARIAL, VHISTNIVEISTABSALARIAISFUNCAO, VHISTNIVEISTABSALARIAISLOTACAO, VHISTHABPESS, VHISTBENEFFUNC, VHISTBENEFCARGO, VHISTBENEFDEPEND, VHISTBENEFFUNCAO, VHISTBENEFSECAO, VHISTBENEFVINCFUNC, VHISTBENEFVINCDEPEND, VHISTEPISEGURANCA, VHISTFUNCAOHABIL, VHISTMAPARISCO, VHISTMOVEPI, VHISTPOSTOPFUNC, VHISTTAREFA, VHISTVAGASFUNCAO, VHISTVAGASLOTACAO, VHISTVAGASSECAO, VHISTEXCCANDETAPA | 25+ |
| Portal externo SZ | SZPORTALAGENDAMENTO, SZPORTALARQUIVO, SZPORTALCADASTRO, SZPORTALCONVENIO, SZPORTALLOGIN, SZPORTALLOGINBLOQUEIO, SZPORTALNOTIFICACAO, SZPORTALPRESTCADASTRO, SZPORTALPRESTCADASTRORECSENHA, SZPORTALPRESTLOGIN, SZPORTALPRESTLOGINBLOQ, SZPORTALPRESTSESSAO, SZPORTALSESSAO | 13 |
| Domínios e tipos | LCATEGORIA, HCATEGORIA, SCODCATEGORIA, SZTIPOCATEGORIA, PCARGOCOMPL, PCLASSCARGO, PENCARGO, PGRUPOOCUP | 30+ |

---

## 3. Configuração

### 3.1 Connection string

Arquivo: [Liotecnica.Integration.RM/appsettings.json:8-17](Voltage.RenderRH/Liotecnica.Integration.RM/appsettings.json)

```json
"Rm": {
  "Server": "172.19.30.3",
  "Database": "CORPORERM",
  "UserId": "rm_readonly_voltage",
  "Password": "",
  "Encrypt": true,
  "TrustServerCertificate": true,
  "ApplicationIntent": "ReadOnly",
  "ConnectTimeout": 15
}
```

Construído em [RmConnectionOptions.cs](Voltage.RenderRH/Liotecnica.Integration.RM/RmConnectionOptions.cs)
via `SqlConnectionStringBuilder`.

### 3.2 Override de nomes de tabela (RmSchema)

Arquivo: [Liotecnica.Integration.RM/appsettings.json:22-37](Voltage.RenderRH/Liotecnica.Integration.RM/appsettings.json)

```json
"RmSchema": {
  "Schema": "dbo",
  "AreaTable": "BAREA",
  "DepartamentoTable": "PSECAO",
  "FuncaoTable": "PFUNCAO",
  "CargoTable": "PCARGO",
  "VagaTable": "VRSVAGAS",
  "UnidadeTable": "GFILIAL",
  "FuncionarioTable": "PFUNC",
  "PessoaTable": "PPESSOA",
  "HierarquiaTable": "VHIERARQUIA",
  "DesligamentoTable": "VREQDESLIGAMENTO",
  "AumentoQuadroTable": "VREQAUMENTOQUADRO",
  "SubstituicaoTable": "VREQSUBSTITUICAO",
  "TransferenciaPromocaoTable": "VREQTRANSFPROMOCAO"
}
```

**Por que existe:** ambientes diferentes da TOTVS RM podem ter nomes/módulos distintos.
Ex: cliente que não usa VRS pode ter `VagaTable = VVAGA` (cadastro simples). O código nunca
hardcoda nomes — sempre lê de `_schemaOptions.VagaTable` etc.

Constantes default em [RmTableNames.cs](Voltage.RenderRH/Liotecnica.Integration.RM.Schema/RmTableNames.cs).

### 3.3 Flags de sincronização (RmSync)

Arquivo: [Liotecnica.Integration.RM/appsettings.json:38-51](Voltage.RenderRH/Liotecnica.Integration.RM/appsettings.json)

```json
"RmSync": {
  "IntervalMinutes": 5,
  "SyncUnits": true,
  "SyncVagas": true,
  "SyncEmpresas": true,
  "SyncHierarquia": true,
  "SyncDesligamentos": true,
  "SyncCandidatosVagaDiagnostic": true,
  "SyncCandidatosVaga": true,
  "SyncCandidatosPerfilCv": true
}
```

### 3.4 Modos de execução do worker

| Comando | O que faz |
|---|---|
| `dotnet run` | Cíclico (BackgroundService, IntervalMinutes) |
| `dotnet run -- sync` | Um ciclo completo e encerra |
| `dotnet run -- sync-one` | Smoke test: Max=1 por entidade |
| `dotnet run -- sync-clayton` | Sync apenas para `clayton@gmail.com` (debug) |
| `dotnet run -- sync-historico-salarial` | Apenas PFHSTSAL |
| `dotnet run -- extract` | Apenas extração SQL → JSON, sem POST |
| `dotnet run -- extract-cv` | Extrai PDFs de VCURRICULOANEXO em CV/{CPF}/ |
| `dotnet run -- import-cv-10` | Importa 10 CVs para o Portal |
| `dotnet run -- import-cv-by-talento <GUID> <path>` | Importa CV específico |
| `dotnet run -- clean` | DELETE de tudo no Portal (ordem correta) |
| `dotnet run -- clean-candidatos` | DELETE só candidatos |
| `dotnet run -- clean-candidatos-and-sync` | DELETE candidatos + re-sync |

Implementado em [Program.cs](Voltage.RenderRH/Liotecnica.Integration.RM/Program.cs).

### 3.5 JSONs gerados pela extração

Pasta: `Voltage.RenderRH/Liotecnica.Integration.RM.Schema.Tables/`

| Arquivo | Tabela origem | Tamanho típico |
|---|---|---|
| `schema_tabelas.json` | INFORMATION_SCHEMA.TABLES | ~1.2 MB (8.562 linhas) |
| `schema_colunas.json` | INFORMATION_SCHEMA.COLUMNS | ~31 MB |
| `area.json` | BAREA | pequeno |
| `departamento.json` | PSECAO | médio |
| `cargo.json` | PCARGO | pequeno |
| `funcao.json` | PFUNCAO | pequeno |
| `unidade.json` | GFILIAL ou LUNIDADE | pequeno |
| `pessoa.json` | PPESSOA | ~28 MB |
| `funcionario.json` | PFUNC | ~53 MB (5.314 linhas) |
| `vaga.json` | VRSVAGAS (em aberto) | pequeno (~72 vagas) |
| `hierarquia.json` | VHIERARQUIA | pequeno (176 nós) |
| `hierarquia_coligada_externa.json` | VHIERARQUIACOLIGADAEXTERNA | geralmente vazio |
| `quadrante_hierarquia.json` | VQUADHIERARQUIA | pequeno |
| `pfunc_lider_hrplatform.json` | PFUNCLIDERHRPLATFORM | pequeno |
| `view_pfunc_hierarquia.json` | VWPFUNCHIERARQUIA | médio |
| `desligamento.json` | VREQDESLIGAMENTO | médio |
| `aumento_quadro.json` | VREQAUMENTOQUADRO | médio |
| `substituicao.json` | VREQSUBSTITUICAO | médio |
| `transf_promocao.json` | VREQTRANSFPROMOCAO | médio |
| `historico_salarial.json` | PFHSTSAL | ~17 MB |
| `pessoa_fisica.json` | XPESSOAFISICA | médio |
| `candidato_vaga.json` | VRSVAGAS + VRSSELECOESVAGASCANDIDATOS + PPESSOA (JOIN) | médio |
| `candidato_perfil.json` | VFORMACAOACAD + SCVATUACAOPROFISSIONAL + VCOMPETENCIAPESSOA + VCERTIFICACAOPESSOA | médio |
| `CV/{CPF}/curriculo.pdf` | VCURRICULOANEXO.ARQUIVO (binário) | ~631 pessoas |

---

## 4. Fichas detalhadas por módulo

### 4.1 Cadastros básicos (hierarquia organizacional)

#### `BAREA` — Áreas

**Status:** ➖ Conhecida (configurada como AreaTable, mas não usada na prática)
**Módulo TOTVS:** Cadastros base
**Schema:** dbo
**Volume Liotécnica PROD:** desconhecido (pequeno)

**Propósito:** Cadastro de áreas de atuação/ramos. No TOTVS Liotécnica, **departamentos** são
modelados em `PSECAO` (não em BAREA), então BAREA fica residual.

**Colunas-chave:**

| Coluna | Tipo | PK/FK | Descrição |
|---|---|---|---|
| `CODCOLIGADA` | smallint | PK | Empresa/coligada |
| `CODAREA` | varchar(16) | PK | Código da área |
| `NOME` | varchar(65) | | Nome curto |
| `DESCRICAO` | varchar(255) | | Descrição longa |
| `ID` | int | unique | ID interno do RM |
| `CODIDIOMA` | int | | Idioma da descrição |

**Total de colunas:** 10 (+ audit `REC*`)

**JOINs comuns:** geralmente isolada, não tem FKs claras com outras tabelas.

**Query típica:**

```sql
SELECT CODCOLIGADA, CODAREA, NOME, DESCRICAO
FROM dbo.BAREA
ORDER BY CODAREA;
```

**Onde é usado no nosso código:**
- Constante: [RmTableNames.cs:10](Voltage.RenderRH/Liotecnica.Integration.RM.Schema/RmTableNames.cs)
- Config: `appsettings.json` → `RmSchema.AreaTable`
- Extração: [RmDataExtractor.cs:509](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs) (gera `area.json`)
- **Sync:** nenhum — `PortalAreaSyncService` na prática usa `PSECAO` (departamentos), não `BAREA`

**JSON gerado:** `area.json`

**Gotchas:**
- Apesar do nome, "Área" no TOTVS ≠ Centro de Custo. Centros de custo na Liotécnica vêm de PSECAO.
- Não confundir com `PAREAATUACAO`, `SCVAREAATUACAO`, `VAREASATUACAO` (todas tratam de áreas em contextos diferentes).

---

#### `PSECAO` — Departamentos (Seções)

**Status:** ✅ Sincronizada
**Módulo TOTVS:** Labore — núcleo
**Schema:** dbo
**Volume Liotécnica PROD:** ~centenas de seções

**Propósito:** Tabela mestre de **departamentos** no TOTVS RM. No vocabulário Labore, "seção"
= departamento. Tem **estrutura pai/filho** via `CODIGOPAI` — códigos no formato `01`, `01.11`,
`01.11.023.002` formam a árvore organizacional. Mapeada como `Area / Centro de Custo` no Portal.

**Colunas-chave:**

| Coluna | Tipo | PK/FK | Descrição |
|---|---|---|---|
| `CODCOLIGADA` | smallint | PK | Empresa |
| `CODIGO` | varchar(35) | PK | Código da seção (ex: `01.11.023.002`) |
| `DESCRICAO` | varchar(60) | | Nome da seção |
| `CODIGOPAI` | varchar(35) | FK→PSECAO.CODIGO | Seção pai; `null` = raiz |
| `CGC` | varchar(20) | | CNPJ da seção |
| `CHAPACHEFE` | varchar(16) | FK→PFUNC.CHAPA | Matrícula do chefe |
| `CODFILIAL` | smallint | FK→GFILIAL | Filial onde a seção está |
| `CODDEPTO` | varchar(25) | | Departamento contábil |
| `SECAODESATIVADA` | smallint | | 1 = desativada (não excluir, só desativar) |
| `EMAIL` | varchar(45) | | Email da seção |
| `LIMITEFUNC` | int | | Limite de funcionários |
| `DESCRICAOPPP` | text | | Descrição PPP (eSocial) |
| `LOCALIDADE` | varchar(40) | | Localidade |
| `CODCALENDARIO` | varchar(16) | | Calendário de trabalho |
| `ID` | int | unique | ID numérico do RM |

**Total de colunas:** ~160 (a tabela é gigantesca — eSocial, FGTS, INSS, GRPS, todos têm campos aqui).
Lista completa em `schema_colunas.json`.

**JOINs comuns:**
- `PSECAO.CODIGOPAI = PSECAO.CODIGO` (auto-relacionamento para hierarquia)
- `PSECAO.CHAPACHEFE = PFUNC.CHAPA` (chefe da seção é um funcionário)
- `PSECAO.CODFILIAL = GFILIAL.CODFILIAL`
- `PFUNC.CODSECAO = PSECAO.CODIGO` (funcionário pertence a uma seção)

**Query típica:**

```sql
-- Árvore de departamentos
SELECT CODIGO, DESCRICAO, CODIGOPAI, SECAODESATIVADA, CHAPACHEFE
FROM dbo.PSECAO
WHERE CODCOLIGADA = 1
  AND ISNULL(SECAODESATIVADA, 0) = 0
ORDER BY CODIGO;
```

**Onde é usado no nosso código:**
- Constante: [RmTableNames.cs:13](Voltage.RenderRH/Liotecnica.Integration.RM.Schema/RmTableNames.cs)
- Config: `appsettings.json` → `RmSchema.DepartamentoTable`
- Extração: [RmDataExtractor.cs:510](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs) (gera `departamento.json`)
- Sync: [PortalAreaSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalAreaSyncService.cs) → `POST /api/centros-custo`

**JSON gerado:** `departamento.json`

**Gotchas:**
- Para listar **árvore correta**: ordenar por `CODIGO` (alfabético funciona porque é prefixado).
- Sync envia **pais antes de filhos** via `OrderByHierarchy()` para o Portal não rejeitar a referência.
- `SECAODESATIVADA = 1` deve ser respeitado (não envia para Portal).
- Tem 160+ colunas mas só usamos ~5 (CODIGO, DESCRICAO, CODIGOPAI, CHAPACHEFE, EMAIL).

---

#### `PCARGO` — Cargos

**Status:** ✅ Sincronizada
**Módulo TOTVS:** Labore
**Schema:** dbo
**Volume Liotécnica PROD:** ~10-20 cargos (níveis organizacionais)

**Propósito:** Tabela de **cargos** no sentido de **nível organizacional** (Diretoria, Gerência,
Coordenação, Analista). Diferente de `PFUNCAO` que tem o **nome do cargo** (Analista de Sistemas).

**Colunas-chave:**

| Coluna | Tipo | PK/FK | Descrição |
|---|---|---|---|
| `CODCOLIGADA` | smallint | PK | Empresa |
| `CODIGO` | varchar(16) | PK | Código do cargo (ex: `1`, `2`) |
| `NOME` | varchar(40) | | Nome (ex: `Diretoria`, `Gerência`) |
| `JORNADATRABALHO` | int | | Jornada padrão em horas |
| `CODGRUPOOCUP` | varchar(10) | FK→PGRUPOOCUP | Grupo ocupacional |
| `DESCRICAO` | text | | Descrição longa |
| `INATIVO` | smallint | | 1 = inativo |
| `ID` | int | unique | ID numérico |
| `CODCLASSCARGO` | char(3) | FK→PCLASSCARGO | Classe do cargo |
| `SIGLA` | varchar(30) | | Sigla (ex: `DIR`, `GER`) |

**Total de colunas:** 15

**JOINs comuns:**
- `PFUNCAO.CARGO = PCARGO.CODIGO` (função pertence a um cargo/nível)
- `PCARGO.CODGRUPOOCUP = PGRUPOOCUP.CODIGO`
- `PCARGO.CODCLASSCARGO = PCLASSCARGO.CODIGO`

**Query típica:**

```sql
SELECT CODIGO, NOME, SIGLA, INATIVO, CODGRUPOOCUP, CODCLASSCARGO
FROM dbo.PCARGO
WHERE ISNULL(INATIVO, 0) = 0
ORDER BY CODIGO;
```

**Onde é usado no nosso código:**
- Constante: [RmTableNames.cs:19](Voltage.RenderRH/Liotecnica.Integration.RM.Schema/RmTableNames.cs)
- Config: `RmSchema.CargoTable`
- Extração: [RmDataExtractor.cs:512](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs) (`cargo.json`)
- Sync: [PortalCargoSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalCargoSyncService.cs) → `POST /api/job-positions`

**JSON gerado:** `cargo.json`

**Gotchas:**
- Cargo aqui = **nível**, não nome da posição. Para nome da posição (ex: "Analista de Sistemas") use `PFUNCAO`.
- O `PortalCargoSyncService` resolve `CentroCustoId` padrão (primeiro da lista) — pode precisar de override por cargo se evoluir.

---

#### `PFUNCAO` — Funções

**Status:** ✅ Sincronizada (como Categoria no Portal)
**Módulo TOTVS:** Labore
**Schema:** dbo
**Volume Liotécnica PROD:** ~centenas de funções

**Propósito:** Cadastro de **funções** = nomes de cargos. Ex: `ANALISTA DE SISTEMA`,
`COORDENADOR DE SISTEMA`. Cada função pertence a um cargo (`CARGO` → `PCARGO.CODIGO`).
**No nosso Portal vira "Categoria de Requisito"** (`api/requisito-categorias`), terminologia diferente.

**Colunas-chave:**

| Coluna | Tipo | PK/FK | Descrição |
|---|---|---|---|
| `CODCOLIGADA` | smallint | PK | Empresa |
| `CODIGO` | varchar(10) | PK | Código (ex: `875`) |
| `NOME` | varchar(100) | | Nome (ex: `ANALISTA DE SISTEMA`) |
| `CARGO` | varchar(16) | FK→PCARGO.CODIGO | Cargo/nível desta função |
| `CBO` | varchar(8) | | CBO (Brasil) |
| `CBO2002` | varchar(10) | | CBO 2002 |
| `INATIVA` | smallint | | 1 = inativa |
| `DESCRICAO` | text | | Descrição longa |
| `OBJETIVO` | text | | Objetivo da função |
| `DESCRICAOPPP` | text | | Descrição PPP (eSocial) |
| `CODFUNCAOCHEFIA` | varchar(10) | FK→PFUNCAO | Função da chefia desta |
| `JORNADAREF` | numeric | | Jornada de referência |
| `CODPERFILCAND` | varchar(15) | | Perfil do candidato (módulo VRS) |
| `DATAULTIMAREVISAO` | datetime | | Última revisão |
| `SIGLA` | varchar(30) | | Sigla |
| `ID` | int | unique | ID numérico |

**Total de colunas:** 34

**JOINs comuns:**
- `PFUNCAO.CARGO = PCARGO.CODIGO` (função → nível organizacional)
- `PFUNCAO.CODFUNCAOCHEFIA = PFUNCAO.CODIGO` (auto-ref: função da chefia)
- `PFUNC.CODFUNCAO = PFUNCAO.CODIGO` (funcionário tem uma função)
- `VRSVAGAS.CODFUNCAO = PFUNCAO.CODIGO` (vaga é para uma função)
- `PFUNCAO.CODPERFILCAND = VRSPERFILCANDIDATO.CODIGO` (módulo VRS)

**Query típica:**

```sql
SELECT f.CODIGO, f.NOME, f.CARGO, c.NOME AS NOMECARGO, f.CBO, f.INATIVA
FROM dbo.PFUNCAO f
LEFT JOIN dbo.PCARGO c ON c.CODIGO = f.CARGO AND c.CODCOLIGADA = f.CODCOLIGADA
WHERE ISNULL(f.INATIVA, 0) = 0
ORDER BY f.NOME;
```

**Onde é usado no nosso código:**
- Constante: [RmTableNames.cs:16](Voltage.RenderRH/Liotecnica.Integration.RM.Schema/RmTableNames.cs)
- Config: `RmSchema.FuncaoTable`
- Extração: [RmDataExtractor.cs:511](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs) (`funcao.json`)
- Sync: [PortalCategoriaSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalCategoriaSyncService.cs) → `POST /api/requisito-categorias`
- JOIN também em [PortalFuncionarioSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalFuncionarioSyncService.cs) e [PortalVagaSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalVagaSyncService.cs)

**JSON gerado:** `funcao.json`

**Gotchas:**
- "Função" é o nome do cargo, não confundir com PCARGO (nível). Diferença sutil mas importante.
- Filtro `INATIVA != 1` é regra de negócio aplicada no PortalCategoriaSyncService.
- O atributo se chama `INATIVA` (feminino), enquanto em PCARGO é `INATIVO` (masculino) — TOTVS é inconsistente.

---

#### `GFILIAL` — Filiais/Estabelecimentos

**Status:** ✅ Sincronizada (em duas formas: Empresa + Unit)
**Módulo TOTVS:** Global (G* = tabelas globais entre módulos)
**Schema:** dbo
**Volume Liotécnica PROD:** 4 filiais

**Propósito:** Cadastro de **filiais/estabelecimentos** da empresa. Cada filial tem CGC (CNPJ),
endereço, telefone, contato. **No Portal alimenta TANTO `Empresa` quanto `Unit`** (entidades
diferentes para um mesmo conceito de origem).

**Colunas-chave:**

| Coluna | Tipo | PK/FK | Descrição |
|---|---|---|---|
| `CODCOLIGADA` | smallint | PK | Empresa-mãe |
| `CODFILIAL` | smallint | PK | Código da filial |
| `NOME` | varchar(100) | | Razão social |
| `NOMEFANTASIA` | varchar(100) | | Nome fantasia |
| `CGC` | varchar(20) | | CNPJ |
| `INSCRICAOESTADUAL` | varchar(20) | | IE |
| `EMAIL` | varchar(60) | | Email da filial |
| `TELEFONE` | varchar(15) | | Telefone |
| `RUA`, `NUMERO`, `BAIRRO`, `CIDADE`, `ESTADO`, `CEP` | varchar | | Endereço completo |
| `PAIS` | varchar(20) | | País |
| `CONTATO` | varchar(40) | | Pessoa de contato |
| `ATIVO` | smallint | | 1 = ativa |
| `IDINTEGRACAO` | varchar(100) | | ID externo (para integrações) |
| `ID` | int | unique | ID numérico do RM |

**Total de colunas:** 53 (sem contar audit/log)

**JOINs comuns:**
- `PFUNC.CODFILIAL = GFILIAL.CODFILIAL`
- `VRSVAGAS.CODFILIAL = GFILIAL.CODFILIAL`
- `PSECAO.CODFILIAL = GFILIAL.CODFILIAL`
- `LUNIDADE.CODFILIAL = GFILIAL.CODFILIAL`
- `VREQAUMENTOQUADRO.CODFILIAL = GFILIAL.CODFILIAL`

**Query típica:**

```sql
SELECT CODFILIAL, NOME, NOMEFANTASIA, CGC, EMAIL,
       CONCAT(RUA, ', ', NUMERO, ' - ', BAIRRO, ' / ', CIDADE, '-', ESTADO) AS ENDERECO
FROM dbo.GFILIAL
WHERE CODCOLIGADA = 1 AND ATIVO = 1
ORDER BY CODFILIAL;
```

**Onde é usado no nosso código:**
- Constante: [RmTableNames.cs:28](Voltage.RenderRH/Liotecnica.Integration.RM.Schema/RmTableNames.cs)
- Config: `RmSchema.UnidadeTable`
- Extração: [RmDataExtractor.cs:514](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs) (`unidade.json`)
- Sync 1: [PortalEmpresaSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalEmpresaSyncService.cs) → `POST /api/empresas`
- Sync 2: [PortalUnitSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalUnitSyncService.cs) → `POST /api/units`

**JSON gerado:** `unidade.json`

**Gotchas:**
- **Mesma fonte → 2 entidades no Portal.** Empresa = informação fiscal/legal; Unit = unidade física onde funcionário trabalha. Estranho mas deliberado.
- Ordenar `RmSyncWorker` para empresas/units **antes** de funcionários (FK depende deles).
- Não confundir com `LUNIDADE` (tabela do Labore extension; geralmente vazia).

---

#### `LUNIDADE` — Unidades (Labore Extension)

**Status:** 🔍 Lida sem sync (em ambientes onde GFILIAL é insuficiente)
**Módulo TOTVS:** Labore extension
**Schema:** dbo
**Volume Liotécnica PROD:** geralmente vazia

**Propósito:** Cadastro de unidades — alternativa a `GFILIAL` em ambientes que separam unidade
física de filial fiscal. **No CORPORERM Liotécnica está vazia ou subutilizada**, por isso usamos GFILIAL.

**Colunas-chave:**

| Coluna | Tipo | PK/FK | Descrição |
|---|---|---|---|
| `CODCOLIGADA` | smallint | PK | Empresa |
| `CODIGO` | int | PK | Código da unidade |
| `UNIDADE` | varchar(30) | | Nome da unidade |
| `CODFILIAL` | smallint | FK→GFILIAL | Filial associada |
| `CODCCUSTO` | varchar(25) | FK | Centro de custo |
| `CODDEPARTAMENTO` | varchar(25) | FK→PSECAO | Departamento |
| `HORAABERTURA`, `HORAFECHAMENTO` | datetime | | Horário de funcionamento |
| `AREATOTAL`, `AREAPARAUSUARIO` | numeric | | Área física m² |
| `CAPACIDADE` | int | | Capacidade |

**Total de colunas:** 17

**Query típica:**

```sql
SELECT CODIGO, UNIDADE, CODFILIAL, CAPACIDADE
FROM dbo.LUNIDADE
WHERE CODCOLIGADA = 1
ORDER BY CODIGO;
```

**Onde é usado no nosso código:**
- Constante: [RmTableNames.cs:25](Voltage.RenderRH/Liotecnica.Integration.RM.Schema/RmTableNames.cs)
- Atualmente NÃO configurada como `UnidadeTable` (que aponta para `GFILIAL`)

**JSON gerado:** se for configurada, vai para `unidade.json` (sobrescreve dados de GFILIAL)

**Gotchas:**
- **Não use as duas ao mesmo tempo** — `UnidadeTable` aponta para uma só.
- Se for ativada, lembrar de desabilitar `PortalUnitSyncService` que hoje lê de GFILIAL.

---

### 4.2 Pessoas e funcionários

#### `PPESSOA` — Cadastro mestre de pessoas

**Status:** ✅ Sincronizada
**Módulo TOTVS:** Labore — núcleo
**Schema:** dbo
**Volume Liotécnica PROD:** ~28 MB de JSON (~milhares de pessoas, mistura funcionários e candidatos)

**Propósito:** Tabela **mestre de pessoas físicas** no TOTVS. Toda pessoa (funcionário ativo,
ex-funcionário, candidato, dependente) tem registro aqui. Funcionários referenciam via
`PFUNC.CODPESSOA`. Candidatos VRS referenciam via `VRSSELECOESVAGASCANDIDATOS.CODPESSOA`.

**Colunas-chave:**

| Coluna | Tipo | PK/FK | Descrição |
|---|---|---|---|
| `CODIGO` | int | PK | ID único da pessoa (NÃO tem CODCOLIGADA — pessoa é global) |
| `NOME` | varchar(120) | | Nome completo |
| `APELIDO` | varchar(40) | | Apelido / nome social |
| `DTNASCIMENTO` | datetime | | Data de nascimento |
| `SEXO` | char(1) | | M / F |
| `ESTADOCIVIL` | char(1) | | 1=solteiro, 2=casado, 3=viúvo, 4=desquitado, 5=divorciado |
| `NACIONALIDADE` | varchar(3) | | Código nacionalidade |
| `GRAUINSTRUCAO` | varchar(3) | | Grau de instrução |
| `CPF` | varchar(11) | | CPF (sem formatação) |
| `EMAIL` | varchar | | Email principal |
| `EMAILPESSOAL` | varchar | | Email pessoal (fallback) |
| `TELEFONE1` | varchar(15) | | Telefone principal |
| `TELEFONE2` | varchar(15) | | Telefone secundário |
| `RUA`, `NUMERO`, `BAIRRO`, `CIDADE`, `ESTADO`, `CEP` | | | Endereço |
| `PAIS` | varchar(60) | | País |
| `CARTIDENTIDADE`, `UFCARTIDENT`, `ORGEMISSORIDENT`, `DTEMISSAOIDENT` | | | RG completo |
| `TITULOELEITOR`, `ZONATITELEITOR`, `SECAOTITELEITOR` | | | Título eleitor |
| `CARTEIRATRAB`, `SERIECARTTRAB`, `UFCARTTRAB`, `DTCARTTRAB` | | | Carteira de trabalho |
| `NIT` | smallint | | Número de inscrição do trabalhador |
| `NATURALIDADE`, `ESTADONATAL` | | | Cidade/UF de nascimento |
| `IDIMAGEM` | int | | Foto (referência blob) |

**Total de colunas:** 268. As mais relevantes para nós estão acima.

**JOINs comuns:**
- `PFUNC.CODPESSOA = PPESSOA.CODIGO` (funcionário → pessoa)
- `VRSSELECOESVAGASCANDIDATOS.CODPESSOA = PPESSOA.CODIGO` (candidato → pessoa)
- `SCVATUACAOPROFISSIONAL.CODPESSOA = PPESSOA.CODIGO` (experiência)
- `VFORMACAOACAD.CODPESSOA = PPESSOA.CODIGO` (formação)
- `VCURRICULOANEXO.CODPESSOA = PPESSOA.CODIGO` (CV em PDF)
- `VHIERARQUIACOLIGADAEXTERNA.CODPESSOA = PPESSOA.CODIGO`

**Query típica:**

```sql
-- Buscar pessoa pelo CPF
SELECT CODIGO, NOME, CPF, EMAIL, EMAILPESSOAL,
       ISNULL(NULLIF(RTRIM(EMAIL), ''), NULLIF(RTRIM(EMAILPESSOAL), '')) AS EMAIL_RESOLVIDO,
       TELEFONE1, CIDADE, ESTADO, DTNASCIMENTO
FROM dbo.PPESSOA
WHERE CPF = @cpf;
```

**Onde é usado no nosso código:**
- Constante: [RmTableNames.cs:34](Voltage.RenderRH/Liotecnica.Integration.RM.Schema/RmTableNames.cs)
- Config: `RmSchema.PessoaTable`
- Extração: [RmDataExtractor.cs:516](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs) (gera `pessoa.json` ~28 MB)
- Sync: [PortalPessoaSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalPessoaSyncService.cs) → `POST /api/pessoas`
- JOIN em **TODAS** as queries de funcionário/candidato

**JSON gerado:** `pessoa.json` (~28 MB)

**Gotchas:**
- **Email frequentemente vem em `EMAILPESSOAL`, não em `EMAIL`.** A query típica usa `ISNULL(NULLIF(RTRIM(EMAIL),''), NULLIF(RTRIM(EMAILPESSOAL), ''))` — implementado em [RmDataExtractor.cs:134](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs).
- **Sem CODCOLIGADA na PK.** PPESSOA é global; `PFUNC` é por coligada (1 pessoa pode ser funcionária em várias empresas).
- **CPF sem formatação** (só 11 dígitos). Validar antes de mandar para o Portal.
- Antes do refator de 2026-04-26, sincronizávamos 7.924 pessoas como funcionários — agora filtra pelo `PFUNC.CODSITUACAO`.

---

#### `PFUNC` — Funcionários

**Status:** ✅ Sincronizada (filtro: ativos/férias/prorrogação)
**Módulo TOTVS:** Labore — núcleo
**Schema:** dbo
**Volume Liotécnica PROD:** 5.314 linhas; **637 ativos**

**Propósito:** Tabela de **vínculo empregatício**: liga uma pessoa (`CODPESSOA` → PPESSOA) a uma
empresa (`CODCOLIGADA`) com matrícula (`CHAPA`). Tem 680 colunas porque concentra dados de admissão,
demissão, FGTS, INSS, IRRF, férias, salário, jornada, etc.

**Colunas-chave (recortadas das 680):**

| Coluna | Tipo | PK/FK | Descrição |
|---|---|---|---|
| `CODCOLIGADA` | smallint | PK | Empresa |
| `CHAPA` | varchar(16) | PK | Matrícula (ex: `00000001`) |
| `NROFICHAREG` | int | | Nº ficha de registro |
| `CODPESSOA` | int | FK→PPESSOA | Pessoa |
| `CODSITUACAO` | char(1) | | **A**=ativo, **F**=férias, **P**=prorrogação aviso, **D**=desligado, **L**=licença, etc. |
| `CODTIPO` | char(1) | | Tipo: `M`=mensalista, `H`=horista, `D`=diarista |
| `CODSECAO` | varchar(35) | FK→PSECAO | Departamento atual |
| `CODFUNCAO` | varchar(10) | FK→PFUNCAO | Função atual |
| `CODFILIAL` | smallint | FK→GFILIAL | Filial atual |
| `CODSINDICATO` | varchar(10) | | Sindicato |
| `JORNADA` | numeric | | Jornada diária |
| `JORNADAMENSAL` | smallint | | Jornada mensal |
| `CODHORARIO` | varchar(10) | | Código de horário |
| `SALARIO` | numeric | | Salário base atual |
| `GRUPOSALARIAL` | varchar(10) | | Grupo salarial |
| `DATAADMISSAO` | datetime | | Admissão |
| `DATADEMISSAO` | datetime | | Demissão (se desligado) |
| `DTDESLIGAMENTO` | datetime | | Data efetiva de desligamento |
| `TIPOADMISSAO` | char(1) | | Tipo de admissão |
| `MOTIVOADMISSAO` | varchar(2) | | Motivo |
| `TIPODEMISSAO` | char(1) | | Tipo de demissão |
| `MOTIVODEMISSAO` | varchar(5) | | Motivo demissão |
| `DTBASE` | datetime | | Data-base sindical |
| `DTULTIMOMOVIM` | datetime | | Última movimentação processada |
| `NOME` | varchar(120) | | Desnormalizado de PPESSOA (não confiar — usar JOIN) |
| `ID` | int | unique | ID numérico |

**Total de colunas:** 680 (FGTS: ~15, IRRF: ~10, férias: ~20, RAIS/eSocial: ~30, etc.)

**JOINs comuns:**
- `PFUNC.CODPESSOA = PPESSOA.CODIGO` (sempre — fonte autoritativa de nome/email/CPF)
- `PFUNC.CODFUNCAO = PFUNCAO.CODIGO` (função atual)
- `PFUNC.CODSECAO = PSECAO.CODIGO` (departamento atual)
- `PFUNC.CODFILIAL = GFILIAL.CODFILIAL`
- `PFUNC.CHAPA = VHIERARQUIACOLIGADAEXTERNA.CHAPAFUNC` (hierarquia)
- `PFUNC.CHAPA = VREQTRANSFPROMOCAO.CHAPA` (última promoção/transferência)
- `PFUNC.CHAPA = VREQDESLIGAMENTO.CHAPA` (desligamento se houve)
- `PFUNC.CHAPA = PFHSTSAL.CHAPA` (histórico salarial)

**Query típica (funcionários ativos com dados consolidados):**

```sql
SELECT
  f.CODCOLIGADA, f.CHAPA, f.CODSITUACAO, f.CODSECAO, f.CODFUNCAO, f.CODFILIAL,
  f.SALARIO, f.DATAADMISSAO, f.DTBASE,
  p.CODIGO AS CODPESSOA, p.NOME, p.CPF,
  ISNULL(NULLIF(RTRIM(p.EMAIL), ''), NULLIF(RTRIM(p.EMAILPESSOAL), '')) AS EMAIL,
  p.TELEFONE1, p.DTNASCIMENTO,
  fc.NOME AS FUNCAO_NOME, c.NOME AS CARGO_NIVEL,
  s.DESCRICAO AS DEPARTAMENTO,
  fil.NOME AS FILIAL
FROM dbo.PFUNC f
INNER JOIN dbo.PPESSOA p ON p.CODIGO = f.CODPESSOA
LEFT JOIN dbo.PFUNCAO fc ON fc.CODIGO = f.CODFUNCAO AND fc.CODCOLIGADA = f.CODCOLIGADA
LEFT JOIN dbo.PCARGO c ON c.CODIGO = fc.CARGO AND c.CODCOLIGADA = f.CODCOLIGADA
LEFT JOIN dbo.PSECAO s ON s.CODIGO = f.CODSECAO AND s.CODCOLIGADA = f.CODCOLIGADA
LEFT JOIN dbo.GFILIAL fil ON fil.CODFILIAL = f.CODFILIAL AND fil.CODCOLIGADA = f.CODCOLIGADA
WHERE f.CODSITUACAO IN ('A', 'F', 'P')
ORDER BY p.NOME;
```

**Onde é usado no nosso código:**
- Constante: [RmTableNames.cs:31](Voltage.RenderRH/Liotecnica.Integration.RM.Schema/RmTableNames.cs)
- Config: `RmSchema.FuncionarioTable`
- Extração: [RmDataExtractor.cs:515](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs) (gera `funcionario.json` ~53 MB)
- Sync: [PortalFuncionarioSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalFuncionarioSyncService.cs) → `POST /api/funcionarios/sync-rm/bulk`

**JSON gerado:** `funcionario.json` (~53 MB)

**Gotchas:**
- **Filtro de ativos:** `CODSITUACAO IN ('A','F','P')` (Ativo, Férias, Prorrogação aviso). 5.314 linhas → 637 ativos.
- **`NOME` na PFUNC está desnormalizado** — usar PPESSOA via JOIN para nome real.
- **Não tem `IDHIERARQUIA` direto.** Hierarquia atual vem de `VREQTRANSFPROMOCAO.IDHIERARQUIADESTINO` da última requisição com `CODSTATUS=4` (concluída) por CHAPA. Apenas 38% têm.
- Tem 680 colunas — não fazer `SELECT *` em produção, mira o que precisa.

---

#### `EFUNCIONARIO` — Funcionários (Labore legado)

**Status:** ➖ Conhecida (vazia em PROD Liotécnica)
**Módulo TOTVS:** Labore (versão antiga)
**Schema:** dbo
**Volume Liotécnica PROD:** 0 registros

**Propósito:** Tabela de funcionários do Labore antigo. Em ambientes que migraram para PFUNC, fica vazia.

**Colunas-chave:** apenas 7 colunas — `CODCOLIGADA`, `CHAPA`, `CODPROF`, e auditoria.

**Onde é usado no nosso código:**
- Constante: [RmTableNames.cs:31 (default)](Voltage.RenderRH/Liotecnica.Integration.RM.Schema/RmTableNames.cs) — sobrescrito para `PFUNC` no appsettings

**Gotchas:**
- Não usar — é uma tabela quase vazia/legada na Liotécnica.
- Documentação TOTVS antiga ainda menciona, por isso está aqui pelo histórico.

---

#### `SEMPRESAFUNCIONARIO` — Empresa↔Funcionário (Soft House)

**Status:** ⚠️ Documentada não usada (fallback se PFUNC/EFUNCIONARIO insuficientes)
**Módulo TOTVS:** Soft House / integração
**Schema:** dbo
**Volume Liotécnica PROD:** desconhecido (~tabela auxiliar)

**Propósito:** Cadastro de empresa-funcionário usado por integrações Soft House. Tem flag **`ATIVO`**
explícito ('S'/'N'), o que torna útil quando você não quer interpretar `CODSITUACAO` do PFUNC.

**Colunas-chave:**

| Coluna | Tipo | PK/FK | Descrição |
|---|---|---|---|
| `IDEMPRESA` | int | PK | Empresa |
| `IDFUNCIONARIO` | int | PK | Funcionário |
| `NOME` | varchar(120) | | Nome |
| `CHAPA` | varchar(50) | | Matrícula (mais largo que PFUNC.CHAPA!) |
| `EMAIL` | varchar(60) | | Email |
| `CARGO` | varchar(60) | | Cargo (texto) |
| `CPF` | varchar(11) | | CPF |
| `ATIVO` | varchar(1) | | 'S'/'N' ou '1'/'0' |
| `FUNCAO` | smallint | | Código função |
| `CODPESSOA` | int | FK→PPESSOA | Pessoa |
| `RUA`, `NUMERO`, `BAIRRO`, `ESTADO`, `CEP`, `DTNASCIMENTO`, `CARTIDENTIDADE`, `TELEFONE` | | | Dados pessoais (desnormalizados) |
| `RFC`, `NPASSAPORTE`, `PAISORIGEM` | | | Estrangeiro |
| `NUMEROCARTCIDADAO` | varchar(30) | | Cartão cidadão (Portugal) |

**Total de colunas:** 90 (sem audit)

**Query típica:**

```sql
SELECT IDFUNCIONARIO, NOME, CHAPA, CPF, EMAIL, ATIVO, CODPESSOA
FROM dbo.SEMPRESAFUNCIONARIO
WHERE ATIVO IN ('S', '1')
  AND IDEMPRESA = @idempresa;
```

**Onde é usado no nosso código:**
- Não usado atualmente. Manter no radar como fallback se EFUNCIONARIO continuar vazia e PFUNC mudar.

**Gotchas:**
- `CHAPA` aqui é varchar(50), em PFUNC é varchar(16). Cuidado em joins se as larguras divergem.
- Tem campos para estrangeiro (passaporte, RFC, cartão cidadão) — útil em multinacionais.
- Pode duplicar o que está em PFUNC + PPESSOA — evitar usar como fonte primária.

---

#### `XPESSOAFISICA` — Pessoa Física (extensão Liotécnica)

**Status:** 🔍 Lida sem sync (extraída para `pessoa_fisica.json`)
**Módulo TOTVS:** Customização (X*)
**Schema:** dbo
**Volume Liotécnica PROD:** Liotécnica usa para filiação (NOM_PAI, NOM_MAE)

**Propósito:** Customização da Liotécnica para guardar dados específicos de pessoa física —
filiação, naturalidade, situação operacional. Chave externa `COD_PESS` (não `CODPESSOA`!).

**Colunas-chave:**

| Coluna | Tipo | PK/FK | Descrição |
|---|---|---|---|
| `COD_PESS` | int | PK | Código pessoa (= PPESSOA.CODIGO) |
| `COD_PESSJ` | int | FK | Pessoa jurídica vinculada (se houver) |
| `COD_PROF` | varchar(3) | | Profissão |
| `COD_EST_CIV` | char(1) | | Estado civil |
| `COD_NAC` | varchar(20) | | Nacionalidade |
| `COD_SEXO` | char(1) | | Sexo |
| `NUM_CI_PESS`, `ORG_EMIS_CI`, `DAT_CI_EMIS` | | | RG completo |
| `DAT_NASC` | datetime | | Nascimento |
| `NOM_PAI` | varchar(45) | | Nome do pai |
| `NOM_MAE` | varchar(45) | | Nome da mãe |
| `LOCAL_TRAB` | varchar(40) | | Local de trabalho |
| `TEL_COMER` | varchar(15) | | Telefone comercial |
| `NACPESSOA` | varchar(30) | | Nacionalidade descrita |
| `CODMUNICIPIO` | varchar(20) | | Município de nascimento |

**Total de colunas:** 54

**JOINs comuns:**
- `XPESSOAFISICA.COD_PESS = PPESSOA.CODIGO` (atenção ao nome da coluna)

**Query típica:**

```sql
SELECT p.CODIGO, p.NOME, p.CPF, x.NOM_PAI, x.NOM_MAE, x.NACPESSOA
FROM dbo.PPESSOA p
LEFT JOIN dbo.XPESSOAFISICA x ON x.COD_PESS = p.CODIGO
WHERE p.CODIGO = @codpessoa;
```

**Onde é usado no nosso código:**
- Extração: [RmDataExtractor.cs:525](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs) (gera `pessoa_fisica.json`)
- Sync: nenhum (LUC-122 — disponibilizada para contexto futuro de filiação no perfil)

**JSON gerado:** `pessoa_fisica.json`

**Gotchas:**
- **Nomes de colunas com underscore** (estilo customização). Não confundir `COD_PESS` (XPESSOAFISICA) com `CODPESSOA` (resto do RM).
- Pode ter pessoa física **sem registro** em XPESSOAFISICA (joins devem ser LEFT).

---

### 4.3 Hierarquia / organograma

#### `VHIERARQUIA` — Organograma

**Status:** ✅ Sincronizada
**Módulo TOTVS:** Hierarquia (V*)
**Schema:** dbo
**Volume Liotécnica PROD:** 176 nós

**Propósito:** **Organograma** do TOTVS RM. Cada nó representa um "cargo" na estrutura
(Diretor de Ops, Gerente Comercial, etc.) — não o funcionário, mas a posição hierárquica.
Estrutura recursiva via `IDHIERARQUIASUPERIOR` + `ESTRUTURA` (caminho `1.2.20.21`).

**Colunas-chave:**

| Coluna | Tipo | PK/FK | Descrição |
|---|---|---|---|
| `CODCOLIGADA` | smallint | PK | Empresa |
| `IDHIERARQUIA` | int | PK | ID do nó |
| `DESCHIERARQUIA` | varchar(100) | | Nome do nó (ex: `Diretor de Operações`) |
| `IDHIERARQUIASUPERIOR` | int | FK→VHIERARQUIA.IDHIERARQUIA | Pai (`null` = raiz) |
| `CODCOLHIERARQUIASUPERIOR` | int | FK | Coligada do pai |
| `IDNIVELHIERARQUIA` | int | | Nível (1, 2, 3…) |
| `ESTRUTURA` | varchar(150) | | Caminho `1.2.20.21` para indexação rápida |
| `IDHIERAQUIAEXTERNO` | varchar(20) | | ID externo (ERP integração) |
| `CODCALENDARIO` | varchar(16) | | Calendário |
| `STATUS` | int | | Status do nó |

**Total de colunas:** 14

**JOINs comuns:**
- `VHIERARQUIA.IDHIERARQUIASUPERIOR = VHIERARQUIA.IDHIERARQUIA` (auto-ref)
- `VHIERARQUIACOLIGADAEXTERNA.IDHIERARQUIA = VHIERARQUIA.IDHIERARQUIA` (liga funcionário)
- `VREQTRANSFPROMOCAO.IDHIERARQUIADESTINO = VHIERARQUIA.IDHIERARQUIA`
- `VREQAUMENTOQUADRO.IDHIERARQUIADESTINO = VHIERARQUIA.IDHIERARQUIA`

**Query típica:**

```sql
-- Organograma com indentação
SELECT IDHIERARQUIA, IDHIERARQUIASUPERIOR, DESCHIERARQUIA,
       IDNIVELHIERARQUIA, ESTRUTURA
FROM dbo.VHIERARQUIA
WHERE CODCOLIGADA = 1 AND STATUS = 1
ORDER BY ESTRUTURA;
```

**Onde é usado no nosso código:**
- Constante: [RmTableNames.cs:37](Voltage.RenderRH/Liotecnica.Integration.RM.Schema/RmTableNames.cs)
- Config: `RmSchema.HierarquiaTable`
- Extração: [RmDataExtractor.cs:518](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs) (`hierarquia.json`)
- Sync: [PortalHierarquiaSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalHierarquiaSyncService.cs) → `POST /api/hierarquias/bulk`

**JSON gerado:** `hierarquia.json`

**Gotchas:**
- Sync envia **antes** dos funcionários (FK depende dele).
- Truncar `DESCHIERARQUIA` em 200 chars no Portal (campo Portal é mais curto).
- `ESTRUTURA` é útil para queries hierárquicas — ordenar por ele dá o organograma em DFS.

---

#### `VHIERARQUIACOLIGADAEXTERNA` — Liga funcionário ao nó hierárquico

**Status:** 🔍 Lida sem sync (geralmente vazia em PROD)
**Módulo TOTVS:** Hierarquia
**Schema:** dbo
**Volume Liotécnica PROD:** vazia (data de extração 2026-04-26)

**Propósito:** Tabela de associação. Liga um funcionário (`CHAPAFUNC`+`CODCOLIGADACHAPA`) a um
nó da hierarquia (`IDHIERARQUIA`+`CODCOLIGADA`). **Em teoria** seria a fonte oficial da
hierarquia atual de cada funcionário, **na prática** está vazia na Liotécnica e usamos
`VREQTRANSFPROMOCAO` para inferir.

**Colunas-chave:**

| Coluna | Tipo | PK/FK | Descrição |
|---|---|---|---|
| `CODCOLIGADA` | smallint | PK | Coligada do nó |
| `IDHIERARQUIA` | int | PK | Nó hierárquico |
| `CODPESSOA` | int | PK→PPESSOA | Pessoa |
| `CHAPAFUNC` | varchar(16) | FK→PFUNC.CHAPA | Matrícula |
| `CODCOLIGADACHAPA` | smallint | FK | Coligada do funcionário |
| `CODEXTERNO` | varchar(16) | | Código externo |
| `STATUS` | int | | Status |

**Total de colunas:** 11

**Query típica:**

```sql
SELECT vc.IDHIERARQUIA, vc.CHAPAFUNC, h.DESCHIERARQUIA
FROM dbo.VHIERARQUIACOLIGADAEXTERNA vc
JOIN dbo.VHIERARQUIA h ON h.IDHIERARQUIA = vc.IDHIERARQUIA AND h.CODCOLIGADA = vc.CODCOLIGADA
WHERE vc.CHAPAFUNC = @chapa AND vc.CODCOLIGADACHAPA = @codcoligada;
```

**Onde é usado no nosso código:**
- Constante: [RmTableNames.cs:40](Voltage.RenderRH/Liotecnica.Integration.RM.Schema/RmTableNames.cs)
- Extração: [RmDataExtractor.cs:519](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs) (`hierarquia_coligada_externa.json`)
- Sync: nenhum

**JSON gerado:** `hierarquia_coligada_externa.json` (vazio)

**Gotchas:**
- **VAZIA NA LIOTÉCNICA.** Não dependa dela. Use `VREQTRANSFPROMOCAO` com `CODSTATUS=4` para hierarquia atual.

---

#### `VQUADHIERARQUIA` — Quadrante hierarquia (avaliação 9-box)

**Status:** 🔍 Lida sem sync
**Módulo TOTVS:** Avaliação de desempenho / nine-box
**Schema:** dbo
**Volume Liotécnica PROD:** desconhecido

**Propósito:** Quadrante 9-box / avaliação. Liga avaliador (`CHAPAAVALIADOR`) a avaliado
(`CHAPAAVALIADO`) com cargo, função e código de quadrante (`CODGQUADRANTE`).

**Colunas-chave:**

| Coluna | Tipo | PK/FK | Descrição |
|---|---|---|---|
| `CODCOLIGADA` | smallint | PK | Coligada |
| `CHAPAAVALIADOR` | varchar(16) | FK→PFUNC | Quem avalia |
| `CHAPAAVALIADO` | varchar(16) | FK→PFUNC | Quem é avaliado |
| `CODCOLIGADAAVALIADOR` | smallint | | |
| `CODCOLIGADAAVALIADO` | smallint | | |
| `CODGQUADRANTE` | varchar(10) | | Código do quadrante (9-box) |
| `CODCARGO` | varchar(16) | FK→PCARGO | Cargo do avaliado |
| `CODFUNCAO` | varchar(10) | FK→PFUNCAO | Função do avaliado |
| `CODGRUPOOCUP` | varchar(10) | | Grupo ocupacional |
| `AVALIADODIRETO` | smallint | NO | Avaliação direta (S/N) |

**Total de colunas:** 14 (sem audit)

**Onde é usado no nosso código:**
- Extração: [RmDataExtractor.cs:520](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs) (`quadrante_hierarquia.json`)
- Sync: nenhum

**Gotchas:**
- Avaliação anual; pode estar com cara de "snapshot" e não refletir hierarquia operacional.

---

#### `VWPFUNCHIERARQUIA` — View consolidada PFUNC + Hierarquia

**Status:** 🔍 Lida sem sync
**Módulo TOTVS:** View do TOTVS (V*W*)
**Schema:** dbo
**Volume Liotécnica PROD:** semelhante a PFUNC

**Propósito:** **VIEW** mantida pelo TOTVS que consolida campos de PFUNC com a hierarquia atual
do funcionário. Tem 200+ colunas — basicamente PFUNC enriquecida.

**Colunas-chave (recortes):**
- Todas as de PFUNC (CHAPA, CODSITUACAO, CODSECAO, CODFUNCAO, SALARIO, etc.)
- Mais campos de hierarquia/posição

**Onde é usado no nosso código:**
- Extração: [RmDataExtractor.cs:522](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs) (`view_pfunc_hierarquia.json`)
- Sync: nenhum

**JSON gerado:** `view_pfunc_hierarquia.json`

**Gotchas:**
- **É VIEW, não tabela.** Mais lenta que ler PFUNC direto.
- Pode ser útil para diagnóstico, mas o sync usa PFUNC + JOINs explícitos.

---

#### `PFUNCLIDERHRPLATFORM` — Líderes (HR Platform)

**Status:** 🔍 Lida sem sync
**Módulo TOTVS:** HR Platform extension
**Schema:** dbo
**Volume Liotécnica PROD:** poucos registros

**Propósito:** Liga funcionário (`CHAPA`) ao seu líder (`CHAPALIDER`). Útil para "quem é meu chefe?"
no portal HR. Tem flag `MASTER` para líder principal.

**Colunas-chave:**

| Coluna | Tipo | PK/FK | Descrição |
|---|---|---|---|
| `CODCOLIGADA` | smallint | PK | Coligada do funcionário |
| `CHAPA` | varchar(16) | PK→PFUNC.CHAPA | Funcionário |
| `CODPESSOA` | int | FK→PPESSOA | Pessoa do funcionário |
| `CODCOLIGADALIDER` | smallint | | Coligada do líder |
| `CHAPALIDER` | varchar(16) | FK→PFUNC.CHAPA | Líder |
| `CODPESSOALIDER` | int | FK→PPESSOA | Pessoa do líder |
| `CODSECAO` | varchar(35) | FK→PSECAO | Departamento |
| `MASTER` | smallint | | 1 = líder principal |
| `TIPO` | varchar(250) | | Tipo da liderança |

**Total de colunas:** 13

**Query típica:**

```sql
SELECT CHAPA, CHAPALIDER, MASTER, TIPO
FROM dbo.PFUNCLIDERHRPLATFORM
WHERE CHAPA = @chapa AND CODCOLIGADA = @codcoligada;
```

**Onde é usado no nosso código:**
- Extração: [RmDataExtractor.cs:521](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs) (`pfunc_lider_hrplatform.json`)
- Sync: nenhum (oportunidade futura: relacionar a Hierarquia/Cargo)

**Gotchas:**
- Pode ter múltiplos líderes por funcionário — filtrar `MASTER=1` para o principal.

---

### 4.4 Vagas e recrutamento

#### `VRSVAGAS` — Vagas (módulo VRS)

**Status:** ✅ Sincronizada (apenas em aberto)
**Módulo TOTVS:** VRS — Recrutamento e Seleção
**Schema:** dbo
**Volume Liotécnica PROD:** ~72 vagas em aberto

**Propósito:** Cadastro de **vagas** do módulo VRS (Recrutamento e Seleção). Configurada como
`VagaTable` padrão; alternativas: `VVAGA` (cadastro simples), `SVAGAS` (estágio).

**Colunas-chave:**

| Coluna | Tipo | PK/FK | Descrição |
|---|---|---|---|
| `CODCOLIGADA` | smallint | PK | Empresa |
| `CODVAGA` | varchar(10) | PK | Código da vaga |
| `CODFUNCAO` | varchar(10) | FK→PFUNCAO | Função (cargo) da vaga |
| `NOME` | varchar(120) | | Título da vaga |
| `DATAABERTURA` | datetime | | Data de abertura |
| `DATAFECHAMENTO` | datetime | | Data de fechamento (`null` = sem prazo) |
| `ATIVO` | smallint | NO | 1/`S` = ativa |
| `REMUNERACAO` | varchar(4000) | | Remuneração (texto livre) |
| `EXPERIENCIASEXIGIDAS` | varchar(4000) | | Exp. exigidas |
| `EXPERIENCIASDESEJADAS` | varchar(4000) | | Exp. desejadas |
| `COMPLEMENTO` | text | | Descrição complementar |
| `CODGRAUINSTRUCAO` | int | | Grau de instrução exigido |
| `COMPLEMENTOGRAUINSTRUCAO` | varchar(4000) | | Complemento da instrução |
| `TIPOANDAMENTOETAPA` | smallint | | Tipo de fluxo |
| `PUBLICARFUNCAO`, `PUBLICARGRAUINSTRUCAO`, `PUBLICARREMUNERACAO`, `PUBLICARCOMPLEMENTO` | smallint | | Flags de publicação |

**Total de colunas:** 22

**JOINs comuns:**
- `VRSVAGAS.CODFUNCAO = PFUNCAO.CODIGO`
- `VRSVAGAS.CODVAGA = VRSSELECOESVAGASCANDIDATOS.CODVAGA` (candidatos)
- `VRSVAGAS.CODVAGA = VRSSELECOES.CODVAGA` (processos)
- `VREQAUMENTOQUADRO.IDREQ ↔ VRSVAGAS` (origem da vaga — ver gotcha)

**Query típica (vagas em aberto):**

```sql
SELECT * FROM dbo.VRSVAGAS
WHERE CAST(ATIVO AS VARCHAR(10)) IN ('1', 'S', 's', 'Y', 'y')
  AND (DATAABERTURA IS NULL OR TRY_CAST(DATAABERTURA AS DATE) <= @hoje)
  AND (DATAFECHAMENTO IS NULL OR TRY_CAST(DATAFECHAMENTO AS DATE) >= @hoje);
```

**Onde é usado no nosso código:**
- Constante: [RmTableNames.cs:22](Voltage.RenderRH/Liotecnica.Integration.RM.Schema/RmTableNames.cs)
- Config: `RmSchema.VagaTable` = `VRSVAGAS`
- Extração: [RmDataExtractor.cs:79-105](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs) (`vaga.json`)
- Sync: [PortalVagaSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalVagaSyncService.cs) → `POST /api/vagas/sync-rm/bulk`
- JOIN: [RmDataExtractor.cs:130-141](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs) com VRSSELECOESVAGASCANDIDATOS + PPESSOA

**JSON gerado:** `vaga.json`

**Gotchas:**
- **`ATIVO`** aceita `'1'`, `'S'`, `'s'`, `'Y'`, `'y'` — sempre fazer `CAST(ATIVO AS VARCHAR(10))`.
- **Não tem `CODFILIAL` direto.** Filial e CC vêm da requisição-pai (VREQAUMENTOQUADRO ou VREQSUBSTITUICAO) por matching heurístico em [PortalVagaSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalVagaSyncService.cs).
- VRSVAGAS guarda só dados da vaga em si — quem é o requisitante, qual seção, qual filial está na **requisição** (VREQ*).

---

#### `VVAGA` — Vagas (cadastro simples)

**Status:** ➖ Conhecida (alternativa, não usada)
**Módulo TOTVS:** Cadastro simples
**Schema:** dbo

**Propósito:** Cadastro de vagas mais antigo/simples, alternativo ao VRSVAGAS. Usado em ambientes
sem o módulo VRS.

**Colunas-chave:**

| Coluna | Tipo | PK/FK | Descrição |
|---|---|---|---|
| `CODCOLIGADA` | smallint | PK | |
| `CODVAGA` | varchar(16) | PK | |
| `NOME` | varchar(60) | | |
| `HORARIO` | varchar(60) | | |
| `SALARIO` | varchar(60) | | |
| `ESCOLARIDADE` | varchar(200) | | |
| `EXPEXIGIDA`, `EXPDESEJADA` | varchar | | |
| `OBSERVACAO` | varchar(2000) | | |
| `DATAABERTURA`, `DATAFECHAMENTO` | datetime | | |
| `DATAINIDIVULGACAO`, `DATAFIMDIVULGACAO` | datetime | | |
| `CODFILIAL` | smallint | FK→GFILIAL | Tem CODFILIAL direto, diferente de VRSVAGAS |
| `CODPERFILCAND` | varchar(15) | | Perfil candidato |
| `PUBLICOALVO` | char(1) | | |
| `LOCAL` | varchar(60) | | |
| `CONTATO` | varchar(60) | | |

**Total de colunas:** 22

**Onde é usado no nosso código:** atualmente nenhum (VagaTable aponta para VRSVAGAS)

**Gotchas:**
- Tem `CODFILIAL` direto (diferente de VRSVAGAS).
- Tabela mais simples; menos integrada com fluxo de requisições.

---

#### `VRSSELECOESVAGASCANDIDATOS` — Candidatos por vaga (VRS)

**Status:** ✅ Sincronizada (gera Candidatos + Talentos no Portal)
**Módulo TOTVS:** VRS
**Schema:** dbo

**Propósito:** Tabela de candidatos inscritos em uma vaga do VRS. Liga `CODVAGA` (de VRSVAGAS)
a `CODPESSOA` (de PPESSOA). Tem flag de aprovação e status de triagem.

**Colunas-chave:**

| Coluna | Tipo | PK/FK | Descrição |
|---|---|---|---|
| `CODCOLIGADA` | smallint | PK | |
| `CODSELECAO` | varchar(10) | PK | Processo seletivo |
| `CODVAGA` | varchar(10) | PK→VRSVAGAS | Vaga |
| `CODPESSOA` | int | PK→PPESSOA | Candidato |
| `APROVADO` | int | | Status de aprovação |
| `STATUSTRIAGEM` | int | NO | Status da triagem |
| `CHAPA` | varchar(16) | FK→PFUNC | Se ex-funcionário |
| `CODCOLIGADACHAPA` | smallint | | |
| `CODCOLREQUISICAO` | smallint | | Coligada da requisição |
| `IDREQ` | int | FK | Requisição-pai |

**Total de colunas:** 14

**JOINs comuns:**
- `VRSSELECOESVAGASCANDIDATOS.CODVAGA = VRSVAGAS.CODVAGA AND .CODCOLIGADA = .CODCOLIGADA`
- `VRSSELECOESVAGASCANDIDATOS.CODPESSOA = PPESSOA.CODIGO`

**Query típica (candidatos com dados pessoais):**

```sql
SELECT v.CODCOLIGADA, v.CODVAGA, v.NOME AS NOMEVAGA,
       c.CODPESSOA, c.APROVADO, c.STATUSTRIAGEM, c.CODSELECAO, c.CHAPA,
       p.NOME AS NOMEPESSOA,
       ISNULL(NULLIF(RTRIM(p.EMAIL), ''), NULLIF(RTRIM(p.EMAILPESSOAL), '')) AS EMAIL,
       p.TELEFONE1, p.TELEFONE2, p.CIDADE, p.ESTADO
FROM dbo.VRSVAGAS v
INNER JOIN dbo.VRSSELECOESVAGASCANDIDATOS c
       ON c.CODVAGA = v.CODVAGA AND c.CODCOLIGADA = v.CODCOLIGADA
INNER JOIN dbo.PPESSOA p ON p.CODIGO = c.CODPESSOA
WHERE (v.DATAABERTURA IS NULL OR TRY_CAST(v.DATAABERTURA AS DATE) <= @hoje)
  AND (v.DATAFECHAMENTO IS NULL OR TRY_CAST(v.DATAFECHAMENTO AS DATE) >= @hoje)
  AND (CAST(v.ATIVO AS VARCHAR(10)) IN ('1', 'S', 's', 'Y', 'y'));
```

(query exata em [RmDataExtractor.cs:130-141](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs))

**Onde é usado no nosso código:**
- Extração: [RmDataExtractor.cs:111-155](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs) (`candidato_vaga.json`)
- Sync 1: [PortalCandidatoVagaSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalCandidatoVagaSyncService.cs) → `POST /api/candidatos`
- Sync 2: [PortalTalentoSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalTalentoSyncService.cs) → `POST /api/talentos`

**JSON gerado:** `candidato_vaga.json`

**Gotchas:**
- **Email obrigatório.** Se PPESSOA.EMAIL e EMAILPESSOAL forem vazios, candidato NÃO é sincronizado e fica em log.
- O mesmo registro vira **Candidato** (vinculado à vaga) E **Talento** (banco de talentos por email).

---

### 4.5 Movimentação e requisições

> **Modelo conceitual.** As tabelas VREQ* representam tipos de **requisição** no fluxo TOTVS RM:
> 1. **VREQAUMENTOQUADRO** = pedido de vaga nova
> 2. **VREQSUBSTITUICAO** = pedido de substituição (gerado se desligamento ou promoção tem flag `CRIASUBSTITUICAO=1`)
> 3. **VREQTRANSFPROMOCAO** = transferência ou promoção
> 4. **VREQDESLIGAMENTO** = rescisão
>
> Todas têm `CODSTATUS` (ver tabela abaixo), `IDREQ`, `CHAPAREQUISITANTE`, `JUSTIFICATIVA`,
> `DATAABERTURA`, `DATACONCLUSAO`. Substituição e Promoção têm `IDREQPAI`+`TIPOREQPAI` para
> rastrear cadeia (substituição decorre de desligamento ou promoção).

#### Domínio de `CODSTATUS` (todas as VREQ*)

Significado validado contra dados reais (`Liotecnica.Integration.RM.Schema.Tables/*.json`) cruzando `CODSTATUS` com `DATACONCLUSAO` / `DATACANCELAMENTO`:

| Código | Status | Significado | Fontes |
|--------|--------|-------------|--------|
| 1 | Em digitação | Rascunho do solicitante, ainda não foi para aprovação | Inferido |
| 2 | Em andamento | Workflow de aprovação rodando | Inferido |
| 3 | Aprovada | Aprovada — RH/R&S pode trabalhar a vaga / efetivar a rescisão | Inferido |
| **4** | **Concluída** | **Efetivada (vaga preenchida com admissão / rescisão concretizada / promoção em vigor).** Significativo: 74-96% dos registros com `CODSTATUS=4` têm `DATACONCLUSAO` preenchida | ✅ Confirmado |
| 6 | Cancelada | Cancelada em qualquer fase. >91% têm `DATACANCELAMENTO` | ✅ Confirmado |
| 7 | Suspensa | Standby (qualquer fase). **Aparece apenas em vaga/substituição/aumento_quadro — desligamento e transf/promoção não têm Suspensa.** Ao retomar, o **SLA zera e reinicia** | ✅ Confirmado |

**Regras de negócio importantes:**
- **SLA** (vaga/substituição/aumento) começa a contar a partir da **Aprovada** (3). Suspensa pausa e ao retomar zera o contador.
- **Desligamento** não tem Suspensa nem SLA.
- **Reprovada** existe no domínio TOTVS mas o código numérico não foi observado nos dumps atuais — pode ser tratada como Cancelada (6) neste tenant ou usar código fora do conjunto observado. Confirmar caso necessário.

**Cuidados ao filtrar:**
- Para **estado vigente / efetivado** (hierarquia atual de funcionário, última promoção em vigor, vagas efetivamente preenchidas): use `CODSTATUS = 4`.
- Para **vagas no Portal (sync)**: use `CODSTATUS IN (3, 4, 6, 7)` — todas as fases pós-aprovação. O mapping para `VagaStatus` no Portal é feito pelo worker:
  - `3` (Aprovada RM) → `VagaStatus.Aberta` (R&S trabalhando)
  - `4` (Concluída RM) → `VagaStatus.Encerrada` (vaga preenchida com admissão)
  - `6` (Cancelada RM) → `VagaStatus.Cancelada`
  - `7` (Suspensa RM) → `VagaStatus.Pausada`
- Para **histórico completo**: não filtre `CODSTATUS` — pegue tudo.

### Inversão de fonte de vagas (refactor 2026-04-27)

Antes desse refactor, o sync de vagas tomava `VRSVAGAS` como fonte primária. O problema: o R&S frequentemente esquece de baixar `ATIVO=0` em `VRSVAGAS` após admitir o substituto, gerando vagas zumbi (33/72 = 46% das abertas em 27/04/2026).

A nova arquitetura inverte: as **VREQ*** (`VREQAUMENTOQUADRO` e `VREQSUBSTITUICAO`) são a fonte primária. Cada `IDREQ` com `CODSTATUS IN (3, 4, 6, 7)` vira uma vaga no Portal. `VRSVAGAS` é consultada apenas como **enriquecimento opcional** (descrição, requisitos, salário negociado pelo R&S) — match heurístico via CODFUNCAO + janela de DATAABERTURA.

**Por que resolve os zumbis:** o `CODSTATUS` da req-mãe é atualizado automaticamente pelo workflow do TOTVS quando a admissão é registrada (vai para 4 = Concluída). A `VRSVAGAS.ATIVO` continua dependendo de ação manual e é ignorada para definir o status da vaga no Portal — é apenas fonte de campos opcionais quando match existe.

**Chave de upsert no Portal:**
- Vagas com origem RM: `IdReqRmOrigem` (= IDREQ da req-mãe). Estável e atualizado pelo TOTVS.
- Vagas "Direta" (existem em `VRSVAGAS` aberta sem casamento com nenhuma VREQ viva): `Codigo` (= CODVAGA). Caso residual.

**Como Natera/zumbis se resolvem sozinhos no próximo sync:**
- Vaga 65 atual no Portal tem `Codigo="65"` e `IdReqRmOrigem="260"` (gravado pelo refactor anterior).
- Novo payload manda item `IdReqRm="260"`, `Status=Encerrada` (porque `VREQSUBSTITUICAO 260.CODSTATUS=4`).
- Match por `IdReqRmOrigem` → atualiza Status da vaga 65 para `Encerrada`. Mesmo padrão para os outros 32 zumbis.

#### `VREQDESLIGAMENTO` — Solicitação de desligamento

**Status:** ✅ Sincronizada
**Módulo TOTVS:** Movimentação (VREQ*)
**Schema:** dbo

**Propósito:** Solicitações de **rescisão**. Tem motivo, data, flag de gerar substituição.

**Colunas-chave:**

| Coluna | Tipo | PK/FK | Descrição |
|---|---|---|---|
| `CODCOLREQUISICAO` | smallint | PK | Coligada da requisição |
| `IDREQ` | int | PK | ID da requisição |
| `CHAPA` | varchar(16) | FK→PFUNC.CHAPA | Funcionário a desligar |
| `CHAPAREQUISITANTE` | varchar(16) | FK→PFUNC | Quem solicitou |
| `CODCOLREQUISITANTE` | smallint | | |
| `CODSTATUS` | int | NO | 4 = concluída |
| `CODTIPORESCISAO` | char(1) | | 1-9, B/N/T (mapeamento legado — ver gotcha) |
| `CODMOTRESCISAO` | varchar(5) | | Motivo |
| `CRIASUBSTITUICAO` | smallint | NO | 1 = vai gerar VREQSUBSTITUICAO |
| `DATAABERTURA` | datetime | NO | Data da requisição |
| `DATACANCELAMENTO` | datetime | | |
| `DATACONCLUSAO` | datetime | | Data de efetivação |
| `DATAPREVISTA` | datetime | | |
| `JUSTIFICATIVA` | text | NO | Texto |
| `NUMDIASAVISO` | smallint | | Aviso prévio |
| `EPNE` | smallint | NO | Empregado portador de necessidades especiais |
| `CODCCUSTO` | varchar(25) | | Centro de custo |
| `IDPOSICAOORIGEM` | int | | Posição origem |

**Total de colunas:** 27

**Mapeamento `CODTIPORESCISAO` (em [PortalDesligamentoSyncService.cs:34-48](Voltage.RenderRH/Liotecnica.Integration.RM/PortalDesligamentoSyncService.cs)):**

| Código | Descrição |
|---|---|
| 1 | Iniciativa empregador sem justa causa |
| 2 | Iniciativa empregador com justa causa |
| 3 | Iniciativa empregado com aviso prévio |
| 4 | Iniciativa empregado sem justa causa |
| 5 | Acordo entre partes |
| 6 | Término contrato prazo |
| 7 | Aposentadoria |
| 8 | Falecimento |
| 9 | Transferência |
| B, N, T | Códigos legados |

**Query típica:**

```sql
SELECT IDREQ, CHAPA, CODTIPORESCISAO, CODSTATUS, CRIASUBSTITUICAO,
       DATAABERTURA, DATACONCLUSAO, NUMDIASAVISO, JUSTIFICATIVA
FROM dbo.VREQDESLIGAMENTO
WHERE CODSTATUS = 4
ORDER BY DATACONCLUSAO DESC;
```

**Onde é usado no nosso código:**
- Constante: [RmTableNames.cs:43](Voltage.RenderRH/Liotecnica.Integration.RM.Schema/RmTableNames.cs)
- Config: `RmSchema.DesligamentoTable`
- Extração: [RmDataExtractor.cs:526](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs) (`desligamento.json`)
- Sync: [PortalDesligamentoSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalDesligamentoSyncService.cs) → `POST /api/desligamentos/bulk`
- Movimentação: [PortalFuncionarioMovimentacaoSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalFuncionarioMovimentacaoSyncService.cs) (tipo 5 = Desligamento)

**JSON gerado:** `desligamento.json`

**Gotchas:**
- `CODTIPORESCISAO` tem códigos numéricos **e** legados (B/N/T). Mapeamento hardcoded.
- `CRIASUBSTITUICAO=1` cria VREQSUBSTITUICAO automaticamente — útil para rastrear "desligou X, vaga gerada Y".

---

#### `VREQAUMENTOQUADRO` — Solicitação de vaga nova

**Status:** ✅ Sincronizada (origem das vagas)
**Módulo TOTVS:** Movimentação
**Schema:** dbo

**Propósito:** Pedido de aumento de quadro = abertura de vaga nova. **Origem da maioria dos
atributos da vaga** (seção, função, filial, hierarquia destino, salário previsto).

**Colunas-chave:**

| Coluna | Tipo | PK/FK | Descrição |
|---|---|---|---|
| `CODCOLREQUISICAO` | smallint | PK | |
| `IDREQ` | int | PK | ID requisição |
| `CHAPAREQUISITANTE` | varchar(16) | FK→PFUNC | Quem pediu |
| `CODSECAO` | varchar(35) | FK→PSECAO | Seção da vaga |
| `CODFUNCAO` | varchar(10) | FK→PFUNCAO | Função da vaga |
| `CODFILIAL` | smallint | FK→GFILIAL | Filial |
| `CODCCUSTO` | varchar(25) | | Centro de custo |
| `CODSTATUS` | int | NO | 4 = concluída |
| `IDHIERARQUIADESTINO` | int | FK→VHIERARQUIA | Nó hierárquico |
| `CODCOLHIERARQUIADESTINO` | smallint | | |
| `IDHIERARQUIAREQUISITANTE` | int | FK→VHIERARQUIA | Hierarquia do requisitante |
| `CODCOLHIERARQUIAREQUISITANTE` | smallint | | |
| `CODNIVELSALARIAL` | varchar(10) | | Nível |
| `CODFAIXASALARIAL` | varchar(10) | | Faixa |
| `CODTABELASALARIAL` | varchar(10) | | Tabela |
| `VLRSALARIO` | numeric | | Salário previsto |
| `NUMVAGAS` | smallint | NO | Qtd de vagas |
| `JUSTIFICATIVA` | text | NO | |
| `DATAABERTURA`, `DATACONCLUSAO`, `DATACANCELAMENTO`, `DATAPREVISTA` | datetime | | Datas |
| `IDCLASSEVALOR`, `IDITEMCONTABIL` | int | | Contábil |

**Total de colunas:** 31

**Query típica (vagas com origem):**

```sql
-- Origem completa de cada vaga via aumento de quadro
SELECT a.IDREQ, a.NUMVAGAS, a.CODSECAO, a.CODFUNCAO, a.CODFILIAL,
       a.IDHIERARQUIADESTINO, a.VLRSALARIO,
       a.DATAABERTURA, a.DATACONCLUSAO,
       s.DESCRICAO AS SECAO, fc.NOME AS FUNCAO, fil.NOME AS FILIAL
FROM dbo.VREQAUMENTOQUADRO a
LEFT JOIN dbo.PSECAO s ON s.CODIGO = a.CODSECAO AND s.CODCOLIGADA = a.CODCOLREQUISICAO
LEFT JOIN dbo.PFUNCAO fc ON fc.CODIGO = a.CODFUNCAO AND fc.CODCOLIGADA = a.CODCOLREQUISICAO
LEFT JOIN dbo.GFILIAL fil ON fil.CODFILIAL = a.CODFILIAL AND fil.CODCOLIGADA = a.CODCOLREQUISICAO
WHERE a.CODSTATUS = 4
ORDER BY a.DATACONCLUSAO DESC;
```

**Onde é usado no nosso código:**
- Constante: [RmTableNames.cs:46](Voltage.RenderRH/Liotecnica.Integration.RM.Schema/RmTableNames.cs)
- Config: `RmSchema.AumentoQuadroTable`
- Extração: [RmDataExtractor.cs:527](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs) (`aumento_quadro.json`)
- Usado em: [PortalVagaSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalVagaSyncService.cs) (resolver origem da vaga: matching por CODFUNCAO + DATAABERTURA próxima)

**JSON gerado:** `aumento_quadro.json`

**Gotchas:**
- **Não tem FK direta para VRSVAGAS.** Matching no sync é heurístico — `CODFUNCAO` + `DATAABERTURA` próximas. Pode falhar se duas vagas iguais abrirem perto.
- `NUMVAGAS` pode ser >1 — aumento de quadro pode pedir 5 vagas para mesma função.

---

#### `VREQSUBSTITUICAO` — Solicitação de substituição

**Status:** ✅ Sincronizada (origem secundária de vagas)
**Módulo TOTVS:** Movimentação
**Schema:** dbo

**Propósito:** Vaga de **substituição** — gerada automaticamente quando um VREQDESLIGAMENTO ou
VREQTRANSFPROMOCAO tem `CRIASUBSTITUICAO=1`. Liga ao pai via `IDREQPAI` + `TIPOREQPAI`.

**Colunas-chave:**

| Coluna | Tipo | PK/FK | Descrição |
|---|---|---|---|
| `CODCOLREQUISICAO` | smallint | PK | |
| `IDREQ` | int | PK | ID requisição |
| `IDREQPAI` | int | FK | Requisição que originou (Desligamento ou Transf/Promoção) |
| `TIPOREQPAI` | int | | Tipo da requisição-pai (1=desligamento, 2=transf/promoção) |
| `CODCOLIGADAREQPAI` | smallint | | Coligada da req-pai |
| `CHAPAREQUISITANTE` | varchar(16) | FK→PFUNC | |
| `CHAPASUBSTITUTO` | varchar(16) | FK→PFUNC | Quem vai substituir (se já decidido) |
| `CODSECAO` | varchar(35) | FK→PSECAO | NO |
| `CODFUNCAO` | varchar(10) | FK→PFUNCAO | NO |
| `CODFILIAL` | smallint | FK→GFILIAL | NO |
| `CODSTATUS` | int | NO | 4 = concluída |
| `IDHIERARQUIADESTINO` | int | FK→VHIERARQUIA | |
| `IDPOSICAODESTINO` | int | | Posição |
| `VLRSALARIO` | numeric | | |
| `JUSTIFICATIVA` | text | NO | |
| `DATAABERTURA`, `DATACONCLUSAO`, `DATACANCELAMENTO`, `DATAPREVISTA` | datetime | | |
| `CODNIVELSALARIAL`, `CODFAIXASALARIAL`, `CODTABELASALARIAL` | varchar | | Sal. |

**Total de colunas:** 34

**Query típica (substituições com pai):**

```sql
SELECT s.IDREQ, s.IDREQPAI, s.TIPOREQPAI, s.CHAPAREQUISITANTE, s.CHAPASUBSTITUTO,
       s.CODFUNCAO, s.CODSECAO, s.CODFILIAL, s.CODSTATUS,
       CASE s.TIPOREQPAI
         WHEN 1 THEN 'Desligamento'
         WHEN 2 THEN 'Transf/Promoção'
         ELSE 'Outro' END AS ORIGEM
FROM dbo.VREQSUBSTITUICAO s
WHERE s.CODSTATUS = 4
ORDER BY s.DATACONCLUSAO DESC;
```

**Onde é usado no nosso código:**
- Constante: [RmTableNames.cs:49](Voltage.RenderRH/Liotecnica.Integration.RM.Schema/RmTableNames.cs)
- Config: `RmSchema.SubstituicaoTable`
- Extração: [RmDataExtractor.cs:528](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs) (`substituicao.json`)
- Usado em: [PortalVagaSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalVagaSyncService.cs) (origem alternativa da vaga)

**JSON gerado:** `substituicao.json`

**Gotchas:**
- Substituição **decorre** de outra requisição. Para entender o "porquê" da vaga, seguir IDREQPAI.
- `CHAPASUBSTITUTO` pode estar preenchido se já se sabe quem vai assumir (interna).

---

#### `VREQTRANSFPROMOCAO` — Transferência ou promoção

**Status:** ✅ Sincronizada (origem da hierarquia atual do funcionário)
**Módulo TOTVS:** Movimentação
**Schema:** dbo

**Propósito:** Solicitações de transferência ou promoção. Tem origem (CODFUNCAOORG, CODSECAOORG,
etc.) e destino. **Usada no sync de funcionário para definir hierarquia atual** (pegando a
última `CODSTATUS=4` por CHAPA).

**Colunas-chave:**

| Coluna | Tipo | PK/FK | Descrição |
|---|---|---|---|
| `CODCOLREQUISICAO` | smallint | PK | |
| `IDREQ` | int | PK | |
| `CHAPA` | varchar(16) | FK→PFUNC.CHAPA | Funcionário (atenção: aqui é a CHAPA do beneficiado) |
| `CHAPAREQUISITANTE` | varchar(16) | FK→PFUNC | Quem pediu |
| `CODSTATUS` | int | NO | 4 = concluída |
| `CODSECAO` | varchar(35) | FK→PSECAO | Seção destino |
| `CODSECAOORG` | varchar(35) | FK→PSECAO | Seção origem |
| `CODFUNCAO` | varchar(10) | FK→PFUNCAO | Função destino |
| `CODFUNCAOORG` | varchar(10) | FK→PFUNCAO | Função origem |
| `CODFILIAL` | smallint | FK→GFILIAL | Filial destino |
| `CODFILIALORG` | smallint | FK→GFILIAL | Filial origem |
| `IDHIERARQUIADESTINO` | int | FK→VHIERARQUIA | **Chave para hierarquia atual** |
| `IDHIERARQUIAORIGEM` | int | FK→VHIERARQUIA | |
| `VLRSALARIO` | numeric | | Salário destino |
| `VLRSALARIOORG` | numeric | | Salário origem |
| `CODNIVELSALARIAL`, `CODNIVELSALARIALORG` | varchar(10) | | |
| `CODMOTMUDFUNCAO`, `CODMOTMUDSALARIO`, `CODMOTMUDSECAO` | varchar(2) | | Motivos da mudança |
| `CRIASUBSTITUICAO` | smallint | NO | Se gera substituição na origem |
| `TRANSFERIRVAGA` | smallint | | Transferir vaga junto |
| `IDREQPAI`, `TIPOREQPAI` | | | Cadeia (substitui outro mov) |
| `JUSTIFICATIVA` | text | NO | |
| `DATAABERTURA`, `DATACONCLUSAO`, `DATACANCELAMENTO`, `DATAPREVISTA` | datetime | | |

**Total de colunas:** 47

**Query típica (hierarquia atual de cada funcionário ativo):**

```sql
-- Última transf/promoção concluída por CHAPA
WITH UltimaPromo AS (
  SELECT CHAPA, IDHIERARQUIADESTINO, CODSECAO, CODFUNCAO,
         ROW_NUMBER() OVER (PARTITION BY CHAPA ORDER BY DATACONCLUSAO DESC) AS rn
  FROM dbo.VREQTRANSFPROMOCAO
  WHERE CODSTATUS = 4 AND CHAPA IS NOT NULL
)
SELECT f.CHAPA, p.NOME, up.IDHIERARQUIADESTINO, h.DESCHIERARQUIA
FROM dbo.PFUNC f
JOIN dbo.PPESSOA p ON p.CODIGO = f.CODPESSOA
LEFT JOIN UltimaPromo up ON up.CHAPA = f.CHAPA AND up.rn = 1
LEFT JOIN dbo.VHIERARQUIA h ON h.IDHIERARQUIA = up.IDHIERARQUIADESTINO
WHERE f.CODSITUACAO IN ('A', 'F', 'P');
```

**Onde é usado no nosso código:**
- Constante: [RmTableNames.cs:52](Voltage.RenderRH/Liotecnica.Integration.RM.Schema/RmTableNames.cs)
- Config: `RmSchema.TransferenciaPromocaoTable`
- Extração: [RmDataExtractor.cs:529](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs) (`transf_promocao.json`)
- JOIN no sync de funcionários: [PortalFuncionarioSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalFuncionarioSyncService.cs)
- Movimentação: [PortalFuncionarioMovimentacaoSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalFuncionarioMovimentacaoSyncService.cs) (tipos 1=Promoção, 2=Transferência, 3=Mudança Função)

**JSON gerado:** `transf_promocao.json`

**Gotchas:**
- **Apenas 38% dos funcionários ativos** têm registro aqui (só quem foi promovido/transferido). O resto fica sem hierarquia explícita.
- `IDHIERARQUIADESTINO` pode ser null mesmo em status concluído.
- Para `MovimentacaoTipo` no Portal: 1=Promoção (CODMOTMUDFUNCAO), 2=Transferência (CODMOTMUDSECAO), 3=MudançaFunção, conforme decisão do PortalFuncionarioMovimentacaoSyncService.

---

### 4.6 Folha de pagamento e histórico salarial (Labore)

#### `PFHSTSAL` — Histórico salarial

**Status:** ✅ Sincronizada (LUC-122)
**Módulo TOTVS:** Labore — Folha
**Schema:** dbo
**Volume Liotécnica PROD:** ~17 MB de JSON (todas as alterações de salário desde início)

**Propósito:** Cada **mudança de salário** vira uma linha aqui — admissão, dissídio, mérito,
promoção, ajuste por jornada. Tabela-chave para histórico salarial e cálculo de evolução de carreira.

**Colunas-chave:**

| Coluna | Tipo | PK/FK | Descrição |
|---|---|---|---|
| `CODCOLIGADA` | smallint | PK | Empresa |
| `CHAPA` | varchar(16) | PK→PFUNC.CHAPA | Funcionário |
| `IDAUMENTO` | int | PK | ID do aumento |
| `NROSALARIO` | smallint | PK | Nº sequencial do salário |
| `DTMUDANCA` | datetime | NO | Data da mudança |
| `DATADEREFERENCIA` | datetime | NO | Data de referência (vigência) |
| `DATADEINCLUSAO` | datetime | | Quando foi cadastrado |
| `MOTIVO` | varchar(2) | NO | Código do motivo (ver mapeamento abaixo) |
| `SALARIO` | numeric | | Salário novo |
| `PERCENTAPLICADO` | numeric | | % aumento |
| `REFERENCIA` | numeric | | Valor referência |
| `JORNADA` | smallint | | Jornada (se mudou) |
| `ALTERACAOJORNADA` | smallint | | 1 = alteração de jornada também |
| `CODEVENTO` | varchar(4) | | Evento de folha |
| `HISTORICODEFAIXA` | varchar(10) | | Faixa salarial |
| `HISTORICODENIVEL` | varchar(10) | | Nível |
| `HISTORICOTABELASALARIAL` | varchar(10) | | Tabela salarial |

**Total de colunas:** 21

**Mapeamento `MOTIVO`** (hardcoded em [PortalHistoricoSalarialSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalHistoricoSalarialSyncService.cs)):

| Código | Tipo Movimentação | Descrição (Liotécnica) |
|---|---|---|
| `01` | AumentoSalarial | Admissão |
| `02` | AumentoSalarial | Dissídio |
| `03` | AumentoSalarial | Reclassificação |
| `04` | AumentoSalarial | Mérito |
| `05` | Promoção | Promoção (mesmo cargo) |
| `06` | AumentoSalarial | Acordo coletivo |
| `07` | AumentoSalarial | Equiparação salarial |
| `08` | AumentoSalarial | Outros |

**Query típica:**

```sql
-- Evolução salarial de um funcionário
SELECT CHAPA, NROSALARIO, DTMUDANCA, MOTIVO, SALARIO, PERCENTAPLICADO,
       HISTORICODEFAIXA, HISTORICODENIVEL
FROM dbo.PFHSTSAL
WHERE CHAPA = @chapa AND CODCOLIGADA = @codcoligada
ORDER BY DTMUDANCA, NROSALARIO;
```

**Onde é usado no nosso código:**
- Extração: [RmDataExtractor.cs:524](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs) (`historico_salarial.json` ~17 MB)
- Sync: [PortalHistoricoSalarialSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalHistoricoSalarialSyncService.cs) → `POST /api/funcionarios/movimentacoes/bulk`
- ID estável: `idReqRm = HSAL-{CHAPA}-{NRO}-{DTMUDANCA}` (para upsert sem duplicar)

**JSON gerado:** `historico_salarial.json` (~17 MB)

**Gotchas:**
- **Toda mudança vira linha**, mesmo aumentos pequenos. Pode crescer rápido.
- `MOTIVO` é varchar(2) com domínio próprio da empresa — códigos podem variar por cliente. Mapeamento Liotécnica é hardcoded.
- `DTMUDANCA` ≠ `DATADEREFERENCIA`: a primeira é quando foi feita a alteração, a segunda é quando passa a valer.

---

#### Outras tabelas de Folha (visão geral)

> **Status:** ➖ Conhecidas (não usadas hoje, mas existem). Volume gigante (200+ tabelas P*/F*).
> Não detalhamos cada uma — listagem só para referência.

| Tabela | Propósito |
|---|---|
| `FCHFUNFUN` | Cheque/folha funcionário-funcionário |
| `FOPAG` | Ordem de pagamento de folha |
| `PFFINANC` | Lançamentos financeiros do funcionário (provento/desconto por período) |
| `PFFINANCCOMPL` | Complemento de PFFINANC |
| `PFHSTAFAS` | Histórico de afastamentos |
| `PFHSTFER` | Histórico de férias |
| `PHISTORICO` | Histórico genérico de funcionário |
| `PCALCULO` | Cálculos de folha |
| `PFEVENTO` | Eventos da folha (proventos/descontos/bases) |

**Como descobrir mais:** rode `jq -r '.[] | select(.TABLE_NAME | startswith("P") or startswith("F")) | .TABLE_NAME' schema_tabelas.json | sort -u` em `Liotecnica.Integration.RM.Schema.Tables/`.

---

### 4.7 Currículo (módulo SCV)

> **Sobre o SCV:** "Sistema de Currículo Vitae" — módulo TOTVS focado em currículo acadêmico
> (estilo Lattes). Tabelas começam com `SCV`. **A Liotécnica não usa intensivamente** — só
> `SCVATUACAOPROFISSIONAL` (experiência) é populada para candidatos.

#### `SCVATUACAOPROFISSIONAL` — Experiência profissional

**Status:** ✅ Sincronizada (compõe `CvText` do Talento/Candidato)
**Módulo TOTVS:** SCV — Currículo
**Schema:** dbo

**Propósito:** Experiência profissional registrada na pessoa (instituições onde trabalhou).

**Colunas-chave:**

| Coluna | Tipo | PK/FK | Descrição |
|---|---|---|---|
| `CODPESSOA` | int | PK→PPESSOA | Pessoa |
| `CODATUACAOPROF` | int | PK | ID da atuação |
| `CODCV` | varchar(20) | | Código do CV |
| `CODPROF` | varchar(10) | | Profissão |
| `CODINSTITUICAO` | varchar(20) | | Instituição (FK) |
| `NOMEINSTITUICAO` | varchar(256) | | Nome da instituição (texto livre) |
| `SIGLAINSTITUICAO` | varchar(256) | | Sigla |

**Total de colunas:** 12

**Query típica:**

```sql
SELECT CODPESSOA, CODATUACAOPROF, NOMEINSTITUICAO, SIGLAINSTITUICAO
FROM dbo.SCVATUACAOPROFISSIONAL
WHERE CODPESSOA IN (SELECT CODPESSOA FROM dbo.VRSSELECOESVAGASCANDIDATOS);
```

**Onde é usado no nosso código:**
- Extração: [RmDataExtractor.cs:232](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs) (em `ExtractCandidatoPerfilAsync`)
- Sync: parte do `candidato_perfil.json` (envia como CvText no Talento/Candidato)

**JSON gerado:** `candidato_perfil.json` (campo `Experiencias`)

**Gotchas:**
- `NOMEINSTITUICAO` é texto livre (256 chars) — não fonte normalizada de empresas.
- Pode estar vazia para a maioria dos candidatos (preenchimento opcional no portal de candidato TOTVS).

---

#### `SCVFORMACAOACADEMICA` — Formação acadêmica (SCV)

**Status:** ⚠️ Documentada não usada (alternativa a VFORMACAOACAD)
**Módulo TOTVS:** SCV
**Schema:** dbo

**Propósito:** Formação acadêmica detalhada (mestrado, doutorado, orientadores, agência financiadora) — focada em pesquisa/Lattes.

**Colunas-chave:**

| Coluna | Tipo | PK/FK | Descrição |
|---|---|---|---|
| `CODPESSOA` | int | PK→PPESSOA | |
| `CODFORMACAO` | int | PK | |
| `NIVEL` | smallint | NO | Graduação/Mestrado/Doutorado |
| `NOMECURSO` | varchar(500) | | |
| `NOMEINSTITUICAO` | varchar(256) | | |
| `ANOINICIO`, `ANOCONCLUSAO` | varchar(4) | | |
| `STATUSCURSO` | varchar(1) | | Em andamento/Concluído/Trancado |
| `NOMEORIENTADOR` | varchar(256) | | |
| `NOMEAGENCIA` | varchar(256) | | Agência financiadora (CAPES/CNPq) |
| `BOLSA` | smallint | | |
| `TITTRABCONCLCURSO` | varchar(4000) | | Título da tese/dissertação |
| `CARGAHORARIA` | varchar(5) | | |

**Total de colunas:** 28

**Onde é usado no nosso código:** atualmente nenhum (preferimos `VFORMACAOACAD`)

**Gotchas:**
- Foco acadêmico (mestrado/doutorado). Para formação básica/superior, `VFORMACAOACAD` é mais simples.

---

#### Outras tabelas SCV (lista de referência)

> Todas têm `CODPESSOA` e ligam ao currículo da pessoa. Status: ➖ Conhecidas.

| Tabela | Propósito |
|---|---|
| `SCVAREAATUACAO` | Áreas de atuação |
| `SCVAREACONHECIMENTO` | Áreas de conhecimento |
| `SCVAREACONHECFORMACAD` | Áreas × Formação |
| `SCVIDIOMA` | Idiomas |
| `SCVPREMIO` | Prêmios |
| `SCVEVENTO` | Eventos (palestras, congressos) |
| `SCVPRODBIBLIOGRAFICA` | Produção bibliográfica (artigos, livros) |
| `SCVPRODUCAOTECNICA` | Produção técnica (softwares, processos) |
| `SCVPRODUCAOCULTURAL` | Produção cultural |
| `SCVPROJETOPESQUISA` | Projetos de pesquisa |
| `SCVEQUIPEPESQUISA` | Equipes de pesquisa |
| `SCVPROFESSOR` | Atuação como professor |
| `SCVBANCA` | Bancas examinadoras |
| `SCVORIENTACAO` | Orientações |
| `SCVCITACAO` | Citações |
| `SCVPALAVRACHAVE` | Palavras-chave |
| `SCVSETORATV` | Setor de atividade |
| `SCVATVATUACAOPROFISSIONAL` | Atividade × atuação |
| `SCVVINCULOATUACAOPROFISSIONAL` | Vínculo da atuação |
| `SCVAUTOR` | Autores |
| `SCVFINANPESQUISA` | Financiamento de pesquisa |

**Total no banco:** ~40 tabelas SCV*. Listar com `jq -r '.[] | select(.TABLE_NAME | startswith("SCV")) | .TABLE_NAME' schema_tabelas.json`.

---

### 4.8 Currículo (views V*) e formação

#### `VFORMACAOACAD` — Formação acadêmica (núcleo)

**Status:** ✅ Sincronizada (compõe CvText)
**Módulo TOTVS:** Currículo / candidato
**Schema:** dbo

**Propósito:** Formação acadêmica simples — curso, instituição, período. Mais comum que SCVFORMACAOACADEMICA.

**Colunas-chave:**

| Coluna | Tipo | PK/FK | Descrição |
|---|---|---|---|
| `CODPESSOA` | int | PK→PPESSOA | |
| `CODFORMACAD` | int | PK | ID da formação |
| `CODGRAU` | int | NO | Grau de instrução |
| `CODCURSO` | int | | Curso (FK) |
| `OUTROCURSO` | varchar(150) | | Curso texto livre |
| `CODENTIDADE` | varchar(16) | | Entidade (FK) |
| `NOMEENTIDADE` | varchar(100) | | Entidade texto livre |
| `MESINICIO`, `ANOINICIO` | smallint | | Início |
| `MESTERMINO`, `ANOTERMINO` | smallint | | Término |
| `DTINICIO`, `DTTERMINO` | datetime | | Datas |
| `ANDAMENTO` | varchar(1) | | C=concluído, A=andamento |
| `CBOFORMACAO` | varchar(10) | | CBO |
| `INFADIC` | varchar | | Info adicional |
| `PODECOMPROVAR` | smallint | | |

**Total de colunas:** 27

**Query típica:**

```sql
SELECT CODPESSOA, OUTROCURSO, CODCURSO, NOMEENTIDADE, ANOINICIO, ANOTERMINO, ANDAMENTO
FROM dbo.VFORMACAOACAD
WHERE CODPESSOA IN (...);
```

**Onde é usado no nosso código:**
- Extração: [RmDataExtractor.cs:211](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs) (em `ExtractCandidatoPerfilAsync`)

**JSON gerado:** parte do `candidato_perfil.json` (campo `Formacao`)

---

#### `VCOMPETENCIAPESSOA` — Competências

**Status:** ✅ Sincronizada (parte do CvText)

**Colunas-chave:**

| Coluna | Tipo | PK/FK | Descrição |
|---|---|---|---|
| `CODCOLIGADA` | smallint | PK | |
| `CODPESSOA` | int | PK→PPESSOA | |
| `CODCOMPETENCIA` | varchar(10) | PK | |
| `CODGRADUACAO` | varchar(10) | | Nível de proficiência |
| `OBSERVACAO` | text | | Texto livre |
| `ORIGEMGRADUACAO` | varchar(10) | | |
| `ORIGEMVALIDACAO` | varchar(5) | | |
| `DATAINCLUSAO` | datetime | | |

**Total de colunas:** 12

**Onde é usado:** [RmDataExtractor.cs:251](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs) → `candidato_perfil.json` (campo `Competencias`)

---

#### `VCERTIFICACAOPESSOA` — Certificações

**Status:** ✅ Sincronizada

**Colunas-chave:** apenas 6 (`CODPESSOA`, `CODCERTIFICACAO`, audit). Tabela mínima — para nome da certificação faria join com tabela auxiliar (não mapeada).

**Onde é usado:** [RmDataExtractor.cs:270](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs) → `candidato_perfil.json` (campo `Treinamentos`)

---

#### `VCURSOSPESSOAIS` — Cursos/treinamentos por funcionário

**Status:** 🔍 Lida (atenção: PK por **CHAPA**, não CODPESSOA!)
**Módulo TOTVS:** Treinamento
**Schema:** dbo

**Colunas-chave:**

| Coluna | Tipo | PK/FK | Descrição |
|---|---|---|---|
| `CODCOLIGADA` | smallint | PK | |
| `CHAPA` | varchar(16) | PK→PFUNC.CHAPA | **Não é CODPESSOA** |
| `CODCURSO` | varchar(16) | PK | Curso |
| `CODTURMA` | varchar(16) | | Turma |
| `CODENTIDADE` | varchar(16) | | Entidade |
| `DTINICURSO`, `DTFIMCURSO` | datetime | | Período |
| `APROVEITAMENTO` | int | | Nota |
| `OBSERVACOES` | text | | |
| `VALORPAGOEMPRESA` | numeric | NO | |
| `GERENCPELAEMPRESA` | smallint | NO | |
| `APROVAVIAVERBA` | smallint | NO | |

**Total de colunas:** 19

**Gotchas:**
- **PK é CHAPA, não CODPESSOA.** Para candidatos (não funcionários), seria preciso resolver via SEMPRESAFUNCIONARIO.
- Aplicação: histórico de cursos de funcionário existente, não candidato externo.

---

#### `VCURRICULOANEXO` — Currículo em arquivo (PDF)

**Status:** ✅ Sincronizada (extrai PDFs e envia ao Portal)
**Módulo TOTVS:** Currículo
**Schema:** dbo
**Volume Liotécnica PROD:** 631 currículos extraídos em `CV/{CPF}/`

**Colunas-chave:**

| Coluna | Tipo | PK/FK | Descrição |
|---|---|---|---|
| `CODCOLIGADA` | smallint | PK | |
| `ID` | int | PK | ID do anexo |
| `CODPESSOA` | int | PK→PPESSOA | |
| `DESCRICAO` | varchar(200) | | Descrição do anexo |
| `DATAANEXO` | datetime | NO | Data do upload |
| `ARQUIVO` | varbinary(max) | NO | **Conteúdo binário** (PDF, DOC, etc.) |

**Total de colunas:** 10

**Query típica:**

```sql
SELECT ID, CODPESSOA, DESCRICAO, ARQUIVO
FROM dbo.VCURRICULOANEXO
WHERE CODPESSOA IN (...) AND ARQUIVO IS NOT NULL;
```

**Onde é usado no nosso código:**
- Extração: [RmDataExtractor.cs:316-462](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs) (`ExtractCurriculosCvAsync`)
- Detecção de extensão: header bytes (`%PDF` ou `\xD0\xCF` para .doc) em [RmDataExtractor.cs:475-482](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs)
- Salva como `CV/{CPF}/curriculo.pdf` + JSON metadado com base64
- Importação: [ImportCvToPortalService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/ImportCvToPortalService.cs) → multipart `POST /api/talentos/import-pdf`

**JSON gerado:** não tem JSON único; em vez disso `Liotecnica.Integration.RM.Schema.Tables/CV/{CPF}/curriculo.pdf`

**Gotchas:**
- **Binário grande** — `cmd.CommandTimeout = 120` para queries com ARQUIVO.
- Detecção de tipo via bytes: `%PDF` = PDF, `\xD0\xCF` = .doc legacy.
- Para CPF normalizado, vê [`NormalizeCpfForFolder`](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs:464) — extrai dígitos; se < 11 dígitos usa `SEM_CPF_{CODPESSOA}`.

---

### 4.9 Treinamento

> **Status geral:** ➖ Conhecidas (não usadas hoje). Útil para futura feature "Plano de
> Desenvolvimento Individual" no Portal.

#### Resumo das tabelas de treinamento

| Tabela | Propósito |
|---|---|
| `VPLANOTREINAMENTO` | Plano de treinamento corporativo |
| `VPLANOTREINA` | Variante de plano |
| `VPLANOTREINACURSO` | Cursos do plano |
| `VPLANOTREINAMENTOVERBA` | Verba do plano |
| `VTREINAMENTO` | Treinamento executado |
| `VTURMATREINAMENTO` | Turmas |
| `VPLANOCARREIRA` | Plano de carreira |
| `VPLANOCURSO` | Cursos |
| `VPLANOMETAS` | Metas |
| `VPLANORECRUTAMENTO` | Plano de recrutamento |
| `VPLANOVAGAS` | Vagas planejadas |
| `VPLANOVAGASFUNCAO` | Vagas planejadas por função |
| `VPLANOALCADA` | Alçada de aprovação |

**Listar todas:** `jq -r '.[] | select(.TABLE_NAME | startswith("VPLANO") or startswith("VTREINA") or startswith("VTURMA")) | .TABLE_NAME' schema_tabelas.json`.

---

### 4.10 Histórico (VHIST*)

> **Status geral:** ➖ Conhecidas. Estruturadas como "snapshots" de mudanças. Úteis para auditoria
> e relatórios de evolução, não para sincronização cotidiana.

#### Resumo das tabelas de histórico

| Tabela | Propósito |
|---|---|
| `VHISTFUNCAO` | Histórico de revisão de função (CODFUNCAO, descrição, data alteração) |
| `VHISTPOSICAO` | Histórico de posição |
| `VHISTPOSTOPFUNC` | Histórico posto-PFUNC |
| `VHISTTABELASALARIAL` | Histórico tabela salarial |
| `VHISTORICOTABELASALARIAL` | Histórico tabela salarial (versão) |
| `VHISTNIVEISTABSALARIAISFUNCAO` | Níveis × função × histórico |
| `VHISTNIVEISTABSALARIAISLOTACAO` | Níveis × lotação × histórico |
| `VHISTHABPESS` | Habilidade pessoal histórica |
| `VHISTBENEFFUNC` | Histórico benefícios funcionário |
| `VHISTBENEFCARGO` | Histórico benefícios cargo |
| `VHISTBENEFDEPEND` | Histórico benefícios dependentes |
| `VHISTBENEFFUNCAO` | Histórico benefícios função |
| `VHISTBENEFSECAO` | Histórico benefícios seção |
| `VHISTBENEFVINCFUNC` | Histórico benefícios vínculo funcionário |
| `VHISTBENEFVINCDEPEND` | Histórico benefícios vínculo dependente |
| `VHISTEPISEGURANCA` | Histórico EPI segurança |
| `VHISTFUNCAOHABIL` | Histórico função × habilidade |
| `VHISTMAPARISCO` | Histórico mapa de risco |
| `VHISTMOVEPI` | Histórico movimentação EPI |
| `VHISTTAREFA` | Histórico de tarefas |
| `VHISTVAGASFUNCAO` | Histórico vagas × função |
| `VHISTVAGASLOTACAO` | Histórico vagas × lotação |
| `VHISTVAGASSECAO` | Histórico vagas × seção |
| `VHISTEXCCANDETAPA` | Histórico exclusão candidato × etapa |

**Listar todas:** `jq -r '.[] | select(.TABLE_NAME | startswith("VHIST")) | .TABLE_NAME' schema_tabelas.json`.

---

### 4.11 Portal externo (SZPORTAL*)

> **Sobre as SZ:** "SZ" = customizações Soft Zero (parceiro TOTVS). São tabelas que **alimentam um
> portal externo** (não o nosso) — recados, cadastros via portal, sessões, etc. **Provavelmente
> não vamos usar**, mas existem se um dia precisarmos sincronizar com o portal antigo do cliente.

#### Resumo das tabelas SZPORTAL*

| Tabela | Propósito |
|---|---|
| `SZPORTALCADASTRO` | Cadastro de pessoa via portal externo |
| `SZPORTALPRESTCADASTRO` | Cadastro de prestador |
| `SZPORTALPRESTCADASTRORECSENHA` | Recuperação de senha (prestador) |
| `SZPORTALAGENDAMENTO` | Agendamento via portal |
| `SZPORTALARQUIVO` | Arquivos enviados via portal |
| `SZPORTALCONVENIO` | Convênios |
| `SZPORTALLOGIN` | Login portal |
| `SZPORTALLOGINBLOQUEIO` | Bloqueio de login |
| `SZPORTALPRESTLOGIN` | Login prestador |
| `SZPORTALPRESTLOGINBLOQ` | Bloqueio login prestador |
| `SZPORTALSESSAO` | Sessões abertas |
| `SZPORTALPRESTSESSAO` | Sessões prestador |
| `SZPORTALNOTIFICACAO` | Notificações |

**Total:** 13 tabelas SZPORTAL*.

**Gotchas:**
- Não confundir com nosso Portal RH (RHPortal.Api). Estas SZ são do sistema antigo do cliente.

---

### 4.12 Domínios e tipos auxiliares

> **Status:** ➖ Conhecidas. Usadas em joins de descrição (lookups). Não sincronizamos.

#### Resumo das tabelas de domínio

| Tabela | Propósito |
|---|---|
| `LCATEGORIA` | Categorias do Labore |
| `HCATEGORIA` | Categorias históricas |
| `SCODCATEGORIA` | Códigos de categoria |
| `SZTIPOCATEGORIA` | Tipos de categoria (custom SZ) |
| `PCARGOCOMPL` | Cargo complementar (extensão de PCARGO) |
| `PCLASSCARGO` | Classe de cargo |
| `PENCARGO` | Encargo do cargo |
| `PGRUPOOCUP` | Grupo ocupacional (referenciado por PCARGO.CODGRUPOOCUP) |
| `PNIVELSALARIAL` | Nível salarial |
| `PFAIXASALARIAL` | Faixa salarial |
| `PTABSAL` | Tabela salarial |
| `PMOTRESCISAO` | Motivos de rescisão |
| `PMOTMUDFUNCAO` | Motivos mudança de função |
| `PMOTMUDSALARIO` | Motivos mudança de salário |
| `PMOTMUDSECAO` | Motivos mudança de seção |
| `PSITUACAO` | Domínio de CODSITUACAO de PFUNC |
| `PTIPOFUNC` | Domínio de CODTIPO de PFUNC |
| `PRECEBIMENTO` | Domínio de CODRECEBIMENTO |
| `PSINDICATO` | Sindicatos |

**Como achar nome de status/motivo:**

```sql
-- Exemplo: descobrir descrição do MOTIVODEMISSAO de um PFUNC
SELECT mr.CODMOTRESCISAO, mr.NOME, f.CHAPA, f.MOTIVODEMISSAO
FROM dbo.PFUNC f
LEFT JOIN dbo.PMOTRESCISAO mr ON mr.CODCOLIGADA = f.CODCOLIGADA AND mr.CODMOTRESCISAO = f.MOTIVODEMISSAO
WHERE f.CHAPA = '00000001' AND f.CODCOLIGADA = 1;
```

---

## 5. Mapeamento RM → Portal (coluna-a-coluna)

### 5.1 Visão geral dos endpoints

| Endpoint Portal | Tabela RM origem | DTO interno | Service responsável |
|---|---|---|---|
| `POST /api/centros-custo` | PSECAO | `DepartamentoRow` | [PortalAreaSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalAreaSyncService.cs) |
| `POST /api/empresas` | GFILIAL | `GfilialRow` | [PortalEmpresaSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalEmpresaSyncService.cs) |
| `POST /api/units` | GFILIAL | `GfilialRow` | [PortalUnitSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalUnitSyncService.cs) |
| `POST /api/job-positions` | PCARGO | `CargoRow` | [PortalCargoSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalCargoSyncService.cs) |
| `POST /api/requisito-categorias` | PFUNCAO | `FuncaoRow` | [PortalCategoriaSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalCategoriaSyncService.cs) |
| `POST /api/pessoas` | PPESSOA | `PessoaRow` | [PortalPessoaSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalPessoaSyncService.cs) |
| `POST /api/funcionarios/sync-rm/bulk` | PFUNC + PPESSOA + PFUNCAO + VREQTRANSFPROMOCAO | `PfuncRow` | [PortalFuncionarioSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalFuncionarioSyncService.cs) |
| `POST /api/vagas/sync-rm/bulk` | VRSVAGAS + VREQAUMENTOQUADRO + VREQSUBSTITUICAO | `VrsVagaRow` | [PortalVagaSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalVagaSyncService.cs) |
| `POST /api/hierarquias/bulk` | VHIERARQUIA | `HierarquiaRow` | [PortalHierarquiaSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalHierarquiaSyncService.cs) |
| `POST /api/desligamentos/bulk` | VREQDESLIGAMENTO | `DesligamentoRow` | [PortalDesligamentoSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalDesligamentoSyncService.cs) |
| `POST /api/funcionarios/movimentacoes/bulk` | VREQTRANSFPROMOCAO + VREQDESLIGAMENTO + VREQAUMENTOQUADRO + PFHSTSAL | múltiplos | [PortalFuncionarioMovimentacaoSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalFuncionarioMovimentacaoSyncService.cs), [PortalHistoricoSalarialSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalHistoricoSalarialSyncService.cs) |
| `POST /api/talentos` | VRSSELECOESVAGASCANDIDATOS + PPESSOA + perfil CV | dinâmico | [PortalTalentoSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalTalentoSyncService.cs) |
| `POST /api/candidatos` | VRSSELECOESVAGASCANDIDATOS + PPESSOA | dinâmico | [PortalCandidatoVagaSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalCandidatoVagaSyncService.cs) |
| `POST /api/talentos/import-pdf` | VCURRICULOANEXO.ARQUIVO | binário multipart | [ImportCvToPortalService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/ImportCvToPortalService.cs) |

### 5.2 Mapeamento Funcionário (PFUNC → /api/funcionarios)

| Campo Portal | Origem RM | Observação |
|---|---|---|
| `MatriculaRm` | `PFUNC.CHAPA` | Identificador único |
| `CodigoColigadaRm` | `PFUNC.CODCOLIGADA` | Empresa |
| `Nome` | `PPESSOA.NOME` (JOIN via CODPESSOA) | Nunca usar `PFUNC.NOME` (desnormalizado) |
| `Cpf` | `PPESSOA.CPF` | Validar formato (11 dígitos) |
| `Email` | `PPESSOA.EMAIL` ou `PPESSOA.EMAILPESSOAL` | Fallback via `ISNULL(NULLIF(...))` |
| `Telefone` | `PPESSOA.TELEFONE1` | |
| `DataNascimento` | `PPESSOA.DTNASCIMENTO` | |
| `StatusRm` | `PFUNC.CODSITUACAO` | A/F/P = ativo |
| `DataAdmissao` | `PFUNC.DATAADMISSAO` | |
| `DataDemissao` | `PFUNC.DATADEMISSAO` | Pode ser null |
| `Salario` | `PFUNC.SALARIO` | |
| `CodigoFuncaoRm` | `PFUNC.CODFUNCAO` | |
| `CodigoCargoRm` | `PFUNCAO.CARGO` (via JOIN PFUNC.CODFUNCAO → PFUNCAO.CODIGO) | Cargo é resolvido via Função |
| `CodigoSecaoRm` | `PFUNC.CODSECAO` | Centro de custo |
| `CodigoFilialRm` | `PFUNC.CODFILIAL` | |
| `IdHierarquiaRm` | `VREQTRANSFPROMOCAO.IDHIERARQUIADESTINO` (última `CODSTATUS=4` por CHAPA) | Apenas 38% têm |

### 5.3 Mapeamento Vaga (VRSVAGAS → /api/vagas)

| Campo Portal | Origem RM | Observação |
|---|---|---|
| `CodigoVagaRm` | `VRSVAGAS.CODVAGA` | |
| `Titulo` | `VRSVAGAS.NOME` | |
| `CodigoFuncaoRm` | `VRSVAGAS.CODFUNCAO` | |
| `Remuneracao` | `VRSVAGAS.REMUNERACAO` | Texto livre |
| `DataAbertura` | `VRSVAGAS.DATAABERTURA` | |
| `DataFechamento` | `VRSVAGAS.DATAFECHAMENTO` | |
| `Ativo` | `VRSVAGAS.ATIVO` | Casted para bool |
| `Descricao` | `VRSVAGAS.COMPLEMENTO` | |
| `ExperienciasExigidas` | `VRSVAGAS.EXPERIENCIASEXIGIDAS` | |
| `ExperienciasDesejadas` | `VRSVAGAS.EXPERIENCIASDESEJADAS` | |
| `CodigoFilialRm` | `VREQAUMENTOQUADRO.CODFILIAL` (matching CODFUNCAO + DATAABERTURA) | Heurístico |
| `CodigoSecaoRm` | `VREQAUMENTOQUADRO.CODSECAO` | Heurístico |
| `IdHierarquiaRm` | `VREQAUMENTOQUADRO.IDHIERARQUIADESTINO` ou `VREQSUBSTITUICAO.IDHIERARQUIADESTINO` | Heurístico |

### 5.4 Mapeamento Pessoa (PPESSOA → /api/pessoas)

| Campo Portal | Origem RM |
|---|---|
| `CodigoPessoaRm` | `PPESSOA.CODIGO` |
| `Nome` | `PPESSOA.NOME` |
| `Cpf` | `PPESSOA.CPF` |
| `Email` | `PPESSOA.EMAIL` ou `PPESSOA.EMAILPESSOAL` |
| `Fone` | `PPESSOA.TELEFONE1` |
| `DataNascimento` | `PPESSOA.DTNASCIMENTO` |
| `Endereco` | concat de RUA, NUMERO, COMPLEMENTO, BAIRRO, CIDADE, ESTADO, CEP |

### 5.5 Mapeamento Desligamento (VREQDESLIGAMENTO → /api/desligamentos)

| Campo Portal | Origem RM |
|---|---|
| `IdDesligamentoRm` | `VREQDESLIGAMENTO.IDREQ` |
| `MatriculaFuncionario` | `VREQDESLIGAMENTO.CHAPA` |
| `TipoRescisao` | `VREQDESLIGAMENTO.CODTIPORESCISAO` (mapeamento 1-9 + B/N/T) |
| `MotivoRescisao` | `VREQDESLIGAMENTO.CODMOTRESCISAO` |
| `GeraSubstituicao` | `VREQDESLIGAMENTO.CRIASUBSTITUICAO` |
| `DataDesligamento` | `VREQDESLIGAMENTO.DATACONCLUSAO` |
| `DataAbertura` | `VREQDESLIGAMENTO.DATAABERTURA` |
| `Justificativa` | `VREQDESLIGAMENTO.JUSTIFICATIVA` |
| `NumDiasAviso` | `VREQDESLIGAMENTO.NUMDIASAVISO` |

### 5.6 Mapeamento Histórico Salarial (PFHSTSAL → /api/funcionarios/movimentacoes)

| Campo Portal | Origem RM |
|---|---|
| `IdReqRm` | `'HSAL-' + CHAPA + '-' + NROSALARIO + '-' + DTMUDANCA` (calculado) |
| `MatriculaFuncionario` | `PFHSTSAL.CHAPA` |
| `TipoMovimentacao` | derivado de `MOTIVO` (ver mapeamento na seção 4.6) |
| `DataMovimentacao` | `PFHSTSAL.DTMUDANCA` |
| `SalarioNovo` | `PFHSTSAL.SALARIO` |
| `PercentualAplicado` | `PFHSTSAL.PERCENTAPLICADO` |
| `Descricao` | mapeamento Liotécnica do MOTIVO para texto humano |

### 5.7 Tipos de Movimentação no Portal

| Código | Origem RM | Significado |
|---|---|---|
| 1 | `VREQTRANSFPROMOCAO` (mudou função) | Promoção |
| 2 | `VREQTRANSFPROMOCAO` (mudou seção) | Transferência |
| 3 | `VREQTRANSFPROMOCAO` (mudou só função sem promoção) | MudançaFuncao |
| 4 | `PFHSTSAL` | AumentoSalarial |
| 5 | `VREQDESLIGAMENTO` | Desligamento |
| 6 | `VREQAUMENTOQUADRO` | AumentoQuadro |
| 7 | `VREQSUBSTITUICAO` | Substituição |

---

## 6. Cookbook de queries SQL

### 6.1 Vagas em aberto (VRSVAGAS)

```sql
-- Vagas ativas hoje (módulo VRS)
SELECT * FROM dbo.VRSVAGAS
WHERE CAST(ATIVO AS VARCHAR(10)) IN ('1', 'S', 's', 'Y', 'y')
  AND (DATAABERTURA IS NULL OR TRY_CAST(DATAABERTURA AS DATE) <= CAST(GETDATE() AS DATE))
  AND (DATAFECHAMENTO IS NULL OR TRY_CAST(DATAFECHAMENTO AS DATE) >= CAST(GETDATE() AS DATE))
ORDER BY DATAABERTURA DESC;
```

### 6.2 Funcionários ativos (PFUNC + JOINs)

```sql
SELECT
  f.CODCOLIGADA, f.CHAPA, f.CODSITUACAO, f.SALARIO, f.DATAADMISSAO,
  p.CODIGO AS CODPESSOA, p.NOME, p.CPF,
  ISNULL(NULLIF(RTRIM(p.EMAIL), ''), NULLIF(RTRIM(p.EMAILPESSOAL), '')) AS EMAIL,
  fc.CODIGO AS CODFUNCAO, fc.NOME AS FUNCAO_NOME,
  c.CODIGO AS CODCARGO, c.NOME AS CARGO_NIVEL,
  s.CODIGO AS CODSECAO, s.DESCRICAO AS DEPARTAMENTO,
  fil.CODFILIAL, fil.NOME AS FILIAL
FROM dbo.PFUNC f
INNER JOIN dbo.PPESSOA p ON p.CODIGO = f.CODPESSOA
LEFT JOIN dbo.PFUNCAO fc ON fc.CODIGO = f.CODFUNCAO AND fc.CODCOLIGADA = f.CODCOLIGADA
LEFT JOIN dbo.PCARGO c ON c.CODIGO = fc.CARGO AND c.CODCOLIGADA = f.CODCOLIGADA
LEFT JOIN dbo.PSECAO s ON s.CODIGO = f.CODSECAO AND s.CODCOLIGADA = f.CODCOLIGADA
LEFT JOIN dbo.GFILIAL fil ON fil.CODFILIAL = f.CODFILIAL AND fil.CODCOLIGADA = f.CODCOLIGADA
WHERE f.CODSITUACAO IN ('A', 'F', 'P')
ORDER BY p.NOME;
```

### 6.3 Candidatos por vaga (VRS)

```sql
SELECT v.CODCOLIGADA, v.CODVAGA, v.NOME AS NOMEVAGA,
       c.CODPESSOA, c.APROVADO, c.STATUSTRIAGEM, c.CODSELECAO, c.CHAPA,
       p.NOME AS NOMEPESSOA,
       ISNULL(NULLIF(RTRIM(p.EMAIL), ''), NULLIF(RTRIM(p.EMAILPESSOAL), '')) AS EMAIL,
       p.TELEFONE1, p.TELEFONE2, p.CIDADE, p.ESTADO
FROM dbo.VRSVAGAS v
INNER JOIN dbo.VRSSELECOESVAGASCANDIDATOS c
       ON c.CODVAGA = v.CODVAGA AND c.CODCOLIGADA = v.CODCOLIGADA
INNER JOIN dbo.PPESSOA p ON p.CODIGO = c.CODPESSOA
WHERE (v.DATAABERTURA IS NULL OR TRY_CAST(v.DATAABERTURA AS DATE) <= CAST(GETDATE() AS DATE))
  AND (v.DATAFECHAMENTO IS NULL OR TRY_CAST(v.DATAFECHAMENTO AS DATE) >= CAST(GETDATE() AS DATE))
  AND (CAST(v.ATIVO AS VARCHAR(10)) IN ('1', 'S'));
```

(idêntica à query do [RmDataExtractor.cs:130-141](Voltage.RenderRH/Liotecnica.Integration.RM/RmDataExtractor.cs))

### 6.4 Hierarquia atual de cada funcionário ativo

```sql
WITH UltimaPromo AS (
  SELECT CHAPA, IDHIERARQUIADESTINO, CODSECAO, CODFUNCAO, DATACONCLUSAO,
         ROW_NUMBER() OVER (PARTITION BY CHAPA ORDER BY DATACONCLUSAO DESC) AS rn
  FROM dbo.VREQTRANSFPROMOCAO
  WHERE CODSTATUS = 4 AND CHAPA IS NOT NULL
)
SELECT f.CHAPA, p.NOME, up.IDHIERARQUIADESTINO,
       h.DESCHIERARQUIA AS HIERARQUIA_DESCRICAO,
       hp.DESCHIERARQUIA AS HIERARQUIA_PAI
FROM dbo.PFUNC f
JOIN dbo.PPESSOA p ON p.CODIGO = f.CODPESSOA
LEFT JOIN UltimaPromo up ON up.CHAPA = f.CHAPA AND up.rn = 1
LEFT JOIN dbo.VHIERARQUIA h ON h.IDHIERARQUIA = up.IDHIERARQUIADESTINO
LEFT JOIN dbo.VHIERARQUIA hp ON hp.IDHIERARQUIA = h.IDHIERARQUIASUPERIOR
WHERE f.CODSITUACAO IN ('A', 'F', 'P');
```

### 6.5 Histórico salarial completo de um funcionário

```sql
SELECT h.CHAPA, p.NOME, h.NROSALARIO, h.DTMUDANCA, h.MOTIVO,
       h.SALARIO, h.PERCENTAPLICADO, h.HISTORICODEFAIXA, h.HISTORICODENIVEL
FROM dbo.PFHSTSAL h
JOIN dbo.PFUNC f ON f.CHAPA = h.CHAPA AND f.CODCOLIGADA = h.CODCOLIGADA
JOIN dbo.PPESSOA p ON p.CODIGO = f.CODPESSOA
WHERE h.CHAPA = '00000001' AND h.CODCOLIGADA = 1
ORDER BY h.DTMUDANCA, h.NROSALARIO;
```

### 6.6 CV completo de um candidato

```sql
DECLARE @cod_pessoa INT = 12345;

-- Formação
SELECT 'Formação' AS TIPO, OUTROCURSO AS ITEM, NOMEENTIDADE AS INSTITUICAO,
       ANOINICIO, ANOTERMINO, ANDAMENTO
FROM dbo.VFORMACAOACAD
WHERE CODPESSOA = @cod_pessoa

UNION ALL

-- Experiência
SELECT 'Experiência', CODATUACAOPROF, NOMEINSTITUICAO, NULL, NULL, NULL
FROM dbo.SCVATUACAOPROFISSIONAL
WHERE CODPESSOA = @cod_pessoa

UNION ALL

-- Competências
SELECT 'Competência', CODCOMPETENCIA, OBSERVACAO, NULL, NULL, NULL
FROM dbo.VCOMPETENCIAPESSOA
WHERE CODPESSOA = @cod_pessoa

UNION ALL

-- Certificações
SELECT 'Certificação', CODCERTIFICACAO, NULL, NULL, NULL, NULL
FROM dbo.VCERTIFICACAOPESSOA
WHERE CODPESSOA = @cod_pessoa

ORDER BY TIPO;
```

### 6.7 Vagas em aberto com origem (aumento de quadro / substituição)

```sql
WITH OrigemAumento AS (
  SELECT a.CODCOLREQUISICAO AS CODCOLIGADA, a.CODFUNCAO,
         ROW_NUMBER() OVER (PARTITION BY a.CODFUNCAO ORDER BY a.DATACONCLUSAO DESC) AS rn,
         a.CODSECAO, a.CODFILIAL, a.IDHIERARQUIADESTINO, 'AumentoQuadro' AS ORIGEM
  FROM dbo.VREQAUMENTOQUADRO a
  WHERE a.CODSTATUS = 4
),
OrigemSubst AS (
  SELECT s.CODCOLREQUISICAO AS CODCOLIGADA, s.CODFUNCAO,
         ROW_NUMBER() OVER (PARTITION BY s.CODFUNCAO ORDER BY s.DATACONCLUSAO DESC) AS rn,
         s.CODSECAO, s.CODFILIAL, s.IDHIERARQUIADESTINO, 'Substituição' AS ORIGEM
  FROM dbo.VREQSUBSTITUICAO s
  WHERE s.CODSTATUS = 4
)
SELECT v.CODCOLIGADA, v.CODVAGA, v.NOME, v.CODFUNCAO, v.DATAABERTURA,
       COALESCE(oa.ORIGEM, os.ORIGEM, 'Direta') AS ORIGEM_VAGA,
       COALESCE(oa.CODSECAO, os.CODSECAO) AS CODSECAO,
       COALESCE(oa.CODFILIAL, os.CODFILIAL) AS CODFILIAL,
       COALESCE(oa.IDHIERARQUIADESTINO, os.IDHIERARQUIADESTINO) AS IDHIERARQUIADESTINO
FROM dbo.VRSVAGAS v
LEFT JOIN OrigemAumento oa ON oa.CODCOLIGADA = v.CODCOLIGADA AND oa.CODFUNCAO = v.CODFUNCAO AND oa.rn = 1
LEFT JOIN OrigemSubst os ON os.CODCOLIGADA = v.CODCOLIGADA AND os.CODFUNCAO = v.CODFUNCAO AND os.rn = 1
WHERE CAST(v.ATIVO AS VARCHAR(10)) IN ('1', 'S')
  AND v.DATAABERTURA <= GETDATE()
  AND (v.DATAFECHAMENTO IS NULL OR v.DATAFECHAMENTO >= GETDATE());
```

### 6.8 Schema discovery (descobrir tabelas/colunas)

```sql
-- Listar todas as tabelas que começam com VREQ
SELECT TABLE_SCHEMA, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME LIKE 'VREQ%'
ORDER BY TABLE_NAME;

-- Listar colunas de uma tabela
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'PFUNC'
ORDER BY ORDINAL_POSITION;

-- Achar tabelas que contêm uma coluna específica (ex: CODPESSOA)
SELECT TABLE_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE COLUMN_NAME = 'CODPESSOA'
ORDER BY TABLE_NAME;
```

---

## 7. Gotchas e regras de negócio

### 7.1 Filtros de "ativo" são inconsistentes

| Tabela | Coluna | Valores que significam ativo |
|---|---|---|
| `PFUNC` | `CODSITUACAO` | `'A'`, `'F'`, `'P'` (3 valores!) |
| `VRSVAGAS` | `ATIVO` | `'1'`, `'S'`, `'s'`, `'Y'`, `'y'` |
| `GFILIAL` | `ATIVO` | `1` (smallint) |
| `PSECAO` | `SECAODESATIVADA` | invertido: `0` ou `null` = ativa |
| `PFUNCAO` | `INATIVA` | invertido: `0` ou `null` = ativa |
| `PCARGO` | `INATIVO` | invertido: `0` ou `null` = ativo |
| `SEMPRESAFUNCIONARIO` | `ATIVO` | `'S'` ou `'1'` |

**Cuidado:** ora é positivo (ATIVO=1), ora invertido (INATIVO=1). Ora char, ora smallint. Sempre testar.

### 7.2 EFUNCIONARIO está vazia em PROD

A tabela `EFUNCIONARIO` (Labore antigo) tem **0 registros** na Liotécnica. Use `PFUNC` (já configurado no `appsettings.json`).

### 7.3 Email obrigatório para candidatos

Se `PPESSOA.EMAIL` E `EMAILPESSOAL` forem null/vazios, o candidato **NÃO é sincronizado**. Logged em [PortalCandidatoVagaSyncService.cs](Voltage.RenderRH/Liotecnica.Integration.RM/PortalCandidatoVagaSyncService.cs).

### 7.4 Hierarquia restrita: 38% dos ativos têm

A hierarquia atual de cada funcionário vem de `VREQTRANSFPROMOCAO.IDHIERARQUIADESTINO` da última requisição com `CODSTATUS=4`. Apenas funcionários que foram promovidos/transferidos têm. Para os outros, hierarquia fica `null` no Portal.

A tabela "oficial" `VHIERARQUIACOLIGADAEXTERNA` está vazia na Liotécnica.

### 7.5 Vaga "Direta" sem CC

Vagas que não vêm de `VREQAUMENTOQUADRO` nem `VREQSUBSTITUICAO` (matching heurístico falhou) ficam marcadas como `Origem = "Direta"` e Centro de Custo `(sem CC)`.

### 7.6 CODTIPORESCISAO híbrido (números + letras)

Em `VREQDESLIGAMENTO.CODTIPORESCISAO`: 1-9 (códigos numéricos) + B/N/T (legados). Mapeamento hardcoded em [PortalDesligamentoSyncService.cs:34-48](Voltage.RenderRH/Liotecnica.Integration.RM/PortalDesligamentoSyncService.cs).

### 7.7 PCARGO ≠ PFUNCAO

- `PCARGO` = nível organizacional (Diretoria, Gerência) — poucos códigos.
- `PFUNCAO` = nome da posição (Analista de Sistemas) — muitos códigos.
- `PFUNCAO.CARGO` aponta para `PCARGO.CODIGO` (cada função pertence a um nível).
- **No Portal** `PCARGO` vira `JobPosition` e `PFUNCAO` vira `RequisitoCategoria`. Confuso, mas é assim.

### 7.8 NOME desnormalizado em PFUNC

`PFUNC.NOME` existe mas pode estar desatualizado. Sempre usar `PPESSOA.NOME` via JOIN por `CODPESSOA`.

### 7.9 PPESSOA não tem CODCOLIGADA

`PPESSOA` é **global** (PK só `CODIGO`). Já `PFUNC` é por coligada (`CODCOLIGADA`+`CHAPA`). Uma pessoa pode ter múltiplas chapas (em coligadas diferentes).

### 7.10 Inconsistência feminino/masculino em INATIVO/INATIVA

- `PCARGO.INATIVO` (masculino)
- `PFUNCAO.INATIVA` (feminino)

Não confunda no código.

### 7.11 CHAPA varia em largura

- `PFUNC.CHAPA` = varchar(16)
- `SEMPRESAFUNCIONARIO.CHAPA` = varchar(50)

Se for fazer JOIN/comparação, use `RTRIM` e cuidado com truncamento.

### 7.12 Senha em texto plano no appsettings.Development.json

⚠️ Confirmar que `appsettings.Development.json` está no `.gitignore`. Senha `YkmF@2022*` está em texto plano e precisa ser rotacionada.

### 7.13 schema_colunas.json tem duplicatas

Algumas tabelas (especialmente as com auditoria LOG*) aparecem com colunas duplicadas no `schema_colunas.json`. Quando fizer query, use `unique_by(.COLUMN_NAME)` no jq.

### 7.14 VCURRICULOANEXO.ARQUIVO é binário grande

Query com `ARQUIVO` precisa de `cmd.CommandTimeout = 120` (vs 60 padrão). Detecção de tipo via header bytes (PDF=`%PDF`, .doc=`\xD0\xCF`).

### 7.15 PFUNC tem 680 colunas — não fazer SELECT *

A tabela é gigantesca. Sempre listar colunas específicas.

### 7.16 O sync apaga e refaz

Comandos `clean*` fazem DELETE em massa antes de re-sync. Cuidado em ambientes compartilhados.

---

## 8. Apêndices

### A. Como rodar uma extração nova

```bash
cd /Users/lmuniz/Projetos/RH_V2/Voltage.RenderRH/Liotecnica.Integration.RM

# Extração completa (schema + dados de todas as tabelas configuradas)
dotnet run -- extract

# Apenas vagas em aberto
dotnet run -- extract  # já inclui (chama ExtractVagasEmAbertoOnlyAsync internamente)

# Currículos em PDF
dotnet run -- extract-cv
```

Os JSONs vão para `Liotecnica.Integration.RM.Schema.Tables/`.

### B. Onde ficam os JSONs extraídos

`/Users/lmuniz/Projetos/RH_V2/Voltage.RenderRH/Liotecnica.Integration.RM.Schema.Tables/`

| Tipo | Arquivo |
|---|---|
| Schema (metadados) | `schema_tabelas.json`, `schema_colunas.json` |
| Cadastros | `area.json`, `departamento.json`, `cargo.json`, `funcao.json`, `unidade.json` |
| Pessoas | `pessoa.json`, `funcionario.json`, `pessoa_fisica.json` |
| Hierarquia | `hierarquia.json`, `hierarquia_coligada_externa.json`, `quadrante_hierarquia.json`, `pfunc_lider_hrplatform.json`, `view_pfunc_hierarquia.json` |
| Vagas | `vaga.json`, `candidato_vaga.json`, `candidato_perfil.json` |
| Movimentação | `desligamento.json`, `aumento_quadro.json`, `substituicao.json`, `transf_promocao.json` |
| Folha | `historico_salarial.json` |
| Currículos PDF | `CV/{CPF}/curriculo.pdf` (+ JSON metadado) |

### C. Lista completa Portal*SyncService → tabela origem → endpoint destino

| Service | Tabela RM principal | Tabelas auxiliares (JOIN) | Endpoint Portal |
|---|---|---|---|
| `PortalAreaSyncService` | PSECAO | — | `POST /api/centros-custo` |
| `PortalEmpresaSyncService` | GFILIAL | — | `POST /api/empresas` |
| `PortalUnitSyncService` | GFILIAL | — | `POST /api/units` |
| `PortalCargoSyncService` | PCARGO | — | `POST /api/job-positions` |
| `PortalCategoriaSyncService` | PFUNCAO | — | `POST /api/requisito-categorias` |
| `PortalPessoaSyncService` | PPESSOA | — | `POST /api/pessoas` |
| `PortalFuncionarioSyncService` | PFUNC | PPESSOA, PFUNCAO, VREQTRANSFPROMOCAO | `POST /api/funcionarios/sync-rm/bulk` |
| `PortalVagaSyncService` | VRSVAGAS | VREQAUMENTOQUADRO, VREQSUBSTITUICAO | `POST /api/vagas/sync-rm/bulk` |
| `PortalHierarquiaSyncService` | VHIERARQUIA | — | `POST /api/hierarquias/bulk` |
| `PortalDesligamentoSyncService` | VREQDESLIGAMENTO | — | `POST /api/desligamentos/bulk` |
| `PortalFuncionarioMovimentacaoSyncService` | VREQTRANSFPROMOCAO | VREQDESLIGAMENTO, VREQAUMENTOQUADRO | `POST /api/funcionarios/movimentacoes/bulk` |
| `PortalHistoricoSalarialSyncService` | PFHSTSAL | — | `POST /api/funcionarios/movimentacoes/bulk` |
| `PortalCandidatoVagaSyncService` | VRSSELECOESVAGASCANDIDATOS | PPESSOA, VRSVAGAS | `POST /api/candidatos` |
| `PortalTalentoSyncService` | VRSSELECOESVAGASCANDIDATOS | PPESSOA, perfil CV | `POST /api/talentos` |
| `ImportCvToPortalService` | VCURRICULOANEXO | PPESSOA | `POST /api/talentos/import-pdf` (multipart) |
| `PortalIntegrationCleanupService` | — | — | `DELETE` em vários endpoints |

### D. Convenções de prefixo TOTVS RM (referência rápida)

Ver Seção [1.4](#14-convenção-de-prefixos-totvs-rm).

### E. Como pesquisar tabelas no banco que ainda não estão no mapa

```bash
cd /Users/lmuniz/Projetos/RH_V2/Voltage.RenderRH/Liotecnica.Integration.RM.Schema.Tables

# Listar tabelas por prefixo
jq -r '.[] | select(.TABLE_NAME | startswith("VTRE")) | .TABLE_NAME' schema_tabelas.json | sort -u

# Colunas de uma tabela específica
jq -r --arg t "PFUNC" '[.[] | select(.TABLE_NAME == $t)] | unique_by(.COLUMN_NAME) | .[] | "\(.COLUMN_NAME)|\(.DATA_TYPE)|\(.CHARACTER_MAXIMUM_LENGTH // "")|\(.IS_NULLABLE)"' schema_colunas.json

# Achar onde uma coluna específica aparece
jq -r --arg c "CODHIERARQUIA" '.[] | select(.COLUMN_NAME == $c) | .TABLE_NAME' schema_colunas.json | sort -u
```

### F. Documentação relacionada

- [lucasINTEGRACOES.md](Voltage.RenderRH/lucasINTEGRACOES.md) — visão geral de integrações (RM + Datasul)
- [lucasMODULOS_FUNCIONALIDADES.md](Voltage.RenderRH/lucasMODULOS_FUNCIONALIDADES.md) — módulos do Portal
- [lucasSTACK_TECNOLOGICA.md](Voltage.RenderRH/lucasSTACK_TECNOLOGICA.md) — stack técnico
- [lucaschangelog.md](Voltage.RenderRH/lucaschangelog.md) — histórico de refatorações (gotchas vêm de lá)
- [INTEGRACAO-MOVIMENTACOES-DATASUL.md](Voltage.RenderRH/INTEGRACAO-MOVIMENTACOES-DATASUL.md) — integração reversa (Portal → Datasul)
- [Liotecnica.Integration.RM/README.md](Voltage.RenderRH/Liotecnica.Integration.RM/README.md) — README do worker
- [Liotecnica.Integration.RM.Schema.Tables/TABELAS_RM_IDENTIFICADAS.md](Voltage.RenderRH/Liotecnica.Integration.RM.Schema.Tables/TABELAS_RM_IDENTIFICADAS.md) — versão antiga, absorvida aqui

### G. Quando atualizar este documento

- ✅ Quando adicionar um novo `Portal*SyncService.cs` — incluir endpoint, tabela, mapeamento.
- ✅ Quando descobrir uma nova tabela do CORPORERM relevante.
- ✅ Quando uma regra de negócio muda (ex: filtro de `CODSITUACAO`, novo motivo de rescisão).
- ✅ Após refator que muda `RmDataExtractor.cs` ou `appsettings.json:RmSchema`.
- ❌ Não atualizar para mudanças triviais (renomear método, refatorar Json options, etc.).

---

**Fim do mapa.** Dúvidas, completar tabela faltante, ou propor melhoria → editar este arquivo direto.
