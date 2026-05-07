# Liotecnica.Integration.RM

Worker que lê dados do banco Corporativo RM (CORPORERM_HMG) e envia para a API do portal:

- **Departamento (RM / PSECAO)** → **Área** no portal (`api/areas`, hierarquia pai/filho).
- **Cargo/Função (RM)** → **Categoria** no portal (`api/requisito-categorias`). Por padrão usa **PFUNCAO** (função: ex. ANALISTA DE SISTEMA, COORDENADOR DE SISTEMA); em `RmSchema.CargoTable` pode ser `PCARGO` (nível: Diretoria, Gerência).
- **Estabelecimentos/Filiais (RM / GFILIAL)** → **Unit** no portal (`api/units`). Por padrão usa **GFILIAL** (cadastro de filiais/estabelecimentos); em `RmSchema.UnidadeTable` pode ser **LUNIDADE**.
- **Pessoa (RM / PPESSOA)** → **Pessoa** no portal (`api/pessoas`).
- **Funcionário (RM / EFUNCIONARIO)** → **Funcionario** no portal (`api/funcionarios`).
- **Vagas em aberto (RM / VRSVAGAS ou VVAGA)** → **Vaga** no portal (`api/vagas`). Só integra vagas em aberto (filtro por DATAABERTURA/DATAFECHAMENTO e ATIVO).

### Integração exata: Vagas × Área e Departamento

As vagas enviadas ao Portal usam **a Área e o Departamento já cadastrados** (sincronizados do RM):

1. **Área** = a que veio do RM (PSECAO → `api/areas`). O **Code** da área no Portal é o **CODIGO** da seção no RM (ex.: `"01"`, `"01.01"`).
2. **Departamento** = um departamento do Portal **vinculado a essa Área** (chamada `api/departments?areaId=...`).
3. Configure em **RmSync**:
   - **VagaDefaultAreaCode**: código da Área cadastrada (ex.: `"01"` = CODIGO do PSECAO que você sincronizou).
   - **VagaDefaultDepartmentCode**: código do Departamento cadastrado (opcional; se não informar, usa o primeiro departamento da área).
4. **Não se cria** área nem departamento na hora do sync de vagas; é obrigatório que já existam no Portal (sincronize áreas/departamentos antes).

## Dependência de rastreio

O pacote **[Liotecnica.Integration.RM.Schema](../Liotecnica.Integration.RM.Schema)** centraliza:

- Quais **tabelas** do RM são usadas (Área, Departamento, Cargo, Vaga, Unidade, Funcionário, Pessoa)
- Quais **colunas** cada tabela possui

Assim fica rastreável onde estão as tabelas e colunas incluídas neste processo. Ajuste o Schema quando o esquema real do CORPORERM_HMG for conhecido.

## Configuração

- **Rm**: connection string ou Server/Database/UserId/Password (ex.: svr-sql-hmg / 172.19.30.7, CORPORERM_HMG, rm/rm).
- **RmSchema**: opcional; sobrescreve nomes de tabelas/schema (ex.: VagaTable = VRSVAGAS ou VVAGA).
- **RmSync**: intervalo entre ciclos é configurado no Portal (aba Owner Integração RM, persistido por tenant — padrão 5 min). **SyncVagas**, **SyncVagasOnly**; **VagaDefaultAreaCode** e **VagaDefaultDepartmentCode** para usar exatamente a Área e o Departamento já cadastrados no sync de vagas.
- **Portal**: BaseUrl da API, TenantId e **ApiKey** (criar a chave no portal em Admin/ApiKeys para o tenant; não commitar). Com a chave, o worker envia o departamento (RM) como área para `api/areas`.

## Execução

```bash
dotnet run --project Liotecnica.Integration.RM
```

Ou publicar e rodar como serviço/agendado.

### Limpar dados de integração

Para apagar no Portal todos os dados enviados pela integração (Funcionários, Pessoas, Cargos, Funções, Unidades, Áreas) e poder rodar a sincronização de novo do zero:

```bash
dotnet run --project Liotecnica.Integration.RM -- clean
```

A ordem de exclusão respeita as dependências: Funcionários → Pessoas → Cargos → Funções → Unidades → Áreas. Usa a mesma configuração **Portal** (BaseUrl, TenantId, ApiKey).

### Extrair currículos (CV) do RM por CPF

Captura anexos de currículo da tabela **VCURRICULOANEXO** do RM (por CODPESSOA de `candidato_vaga.json`), obtém CPF de **PPESSOA**, converte o binário e salva na pasta **CV/** por CPF da pessoa. Gera também um JSON com base64 para uso futuro (ex.: importação no Portal).

**Pré-requisito:** ter `candidato_vaga.json` na pasta de saída (rodar antes a extração de candidatos por vaga).

```bash
dotnet run --project Liotecnica.Integration.RM -- extract-cv
```

- **Destino:** `{SchemaTablesPath}/CV/{CPF}/` (CPF só dígitos; se não houver CPF, usa `SEM_CPF_{CODPESSOA}`).
- **Arquivos por pessoa:** `curriculo.pdf` (ou `.doc` se detectado) e `curriculo.json` com `fileName`, `base64`, `codPessoa`, `cpf`, `nome`, `sizeBytes` para importação posterior no Portal.
