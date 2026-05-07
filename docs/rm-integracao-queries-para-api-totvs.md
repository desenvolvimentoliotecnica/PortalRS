# Consultas SQL do integrador RM (worker) — referência para endpoints TOTVS

**Objetivo:** listar **todas as consultas SQL** usadas hoje pelo projeto `Liotecnica.Integration.RM` quando conecta **diretamente** ao banco do RM (Microsoft.Data.SqlClient). O time deseja, no futuro, **substituir acesso direto ao banco** por **endpoints de API** expostos pela TOTVS / consultoria (REST ou similar), preservando o mesmo conjunto de dados e regras.

**Origem do código:** classe `RmDataExtractor` em `Liotecnica.Integration.RM/RmDataExtractor.cs`.

**Configuração:** nomes de tabela e schema vêm de `appsettings.json` → seção `RmSchema` (ex.: `Schema: "dbo"`, `VagaTable`, `PessoaTable`, etc.). Na documentação abaixo usamos o placeholder `{schema}.{tabela}` onde o código monta `RmSchemaOptions.FullTableName(...)`.

**Convenção:** nos trechos SQL, `{...}` indica substituição em tempo de execução pelo worker (não é sintaxe T-SQL).

---

## 1. Resumo executivo para o consultor

| # | Tipo | Uso no Portal / worker | Prioridade sugerida para API |
|---|------|-------------------------|------------------------------|
| A | `SELECT *` em N tabelas (+ delta `RECMODIFIEDON`) | Base de quase todo o sync (JSON intermediário) | Alta — pode ser fatiada por domínio |
| B | `INFORMATION_SCHEMA` | Apenas descoberta de schema (ferramental) | Baixa |
| C | Filtro vagas em aberto | `vaga.json` quando só vagas | Média |
| D | JOIN VRS vagas + candidatos + pessoa | `candidato_vaga.json` | Alta |
| E | 4 × `SELECT … WHERE CODPESSOA IN (…)` | Perfil CV (`candidato_perfil.json`) | Média |
| F | PPESSOA + `VCURRICULOANEXO` | Download CV binário | Média |
| G | VHIERARQUIAPOSICAO (2 snapshots) | Gestor + organograma por posição | Alta |

---

## 2. Inventário de tabelas lidas em modo “dump” (`ExtractAndSaveAsync`)

Para cada linha abaixo o worker executa **uma** das duas formas:

- **Full:** `SELECT * FROM {FullName}`
- **Incremental** (somente se a tabela estiver em `IncrementalTables` **e** existir watermark salvo):  
  `SELECT * FROM {FullName} WHERE RECMODIFIEDON > DATEADD(second, -60, @wm) ORDER BY RECMODIFIEDON`  
  (`@wm` = último `RECMODIFIEDON` conhecido — margem de 60 s para skew de relógio)

**Arquivo JSON gerado** = coluna “Arquivo”.

| Tabela base (RM) | Arquivo JSON | Incremental (`RECMODIFIEDON`)? |
|------------------|--------------|--------------------------------|
| Config: `AreaTable` (ex.: `BAREA`) | `area.json` | Não |
| Config: `DepartamentoTable` (ex.: `PSECAO`) | `departamento.json` | Não |
| Config: `FuncaoTable` (ex.: `PFUNCAO`) | `funcao.json` | Não |
| Config: `CargoTable` (ex.: `PCARGO`) | `cargo.json` | Não |
| Config: `VagaTable` (ex.: `VRSVAGAS` / `VVAGA`) | `vaga.json` | Sim, se base = `VRSVAGAS` |
| Config: `UnidadeTable` (ex.: `GFILIAL`) | `unidade.json` | Não |
| Config: `FuncionarioTable` (ex.: `PFUNC`) | `funcionario.json` | Sim |
| Config: `PessoaTable` (ex.: `PPESSOA`) | `pessoa.json` | Sim |
| Config: `HierarquiaTable` (ex.: `VHIERARQUIA`) | `hierarquia.json` | Não |
| Config: `HierarquiaColigadaExternaTable` (ex.: `VHIERARQUIACOLIGADAEXTERNA`) | `hierarquia_coligada_externa.json` | Não |
| `VQUADHIERARQUIA` | `quadrante_hierarquia.json` | Não |
| `PFUNCLIDERHRPLATFORM` | `pfunc_lider_hrplatform.json` | Não |
| `GUSUARIO` | `gusuario.json` | Não |
| `VWPFUNCHIERARQUIA` | `view_pfunc_hierarquia.json` | Não |
| `PFHSTSAL` | `historico_salarial.json` | Sim |
| `XPESSOAFISICA` | `pessoa_fisica.json` | Sim |
| `PTPDEMISSAO` | `tipo_demissao.json` | Não |
| `PMOTDEMISSAO` | `motivo_demissao.json` | Não |
| Config: `DesligamentoTable` (ex.: `VREQDESLIGAMENTO`) | `desligamento.json` | Sim |
| Config: `AumentoQuadroTable` (ex.: `VREQAUMENTOQUADRO`) | `aumento_quadro.json` | Sim |
| Config: `SubstituicaoTable` (ex.: `VREQSUBSTITUICAO`) | `substituicao.json` | Sim |
| Config: `TransferenciaPromocaoTable` (ex.: `VREQTRANSFPROMOCAO`) | `transf_promocao.json` | Sim |

**Observação:** um endpoint genérico “lista de entidades com paginação + `modifiedSince`” por tabela pode cobrir este bloco, desde que respeite a mesma semântica de `RECMODIFIEDON` onde aplicável.

---

## 3. Metadados de schema (`ExtractSchemaAsync`)

**Uso:** diagnóstico local (gera `schema_tabelas.json` e `schema_colunas.json`). Não entra no fluxo produtivo de sync.

```sql
-- Tabelas base
SELECT TABLE_CATALOG, TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_SCHEMA, TABLE_NAME;

-- Colunas
SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION, DATA_TYPE,
       CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION;
```

---

## 4. Vagas em aberto apenas (`ExtractVagasEmAbertoOnlyAsync`)

**Parâmetro:** `@hoje` = `DateTime.Today` (data do servidor do worker).

**Condição extra:** se `VagaTable` contém `VRSVAGAS`, acrescenta filtro em `ATIVO`.

```sql
SELECT *
FROM {FullTableName_Vaga}
WHERE (DATAABERTURA IS NULL OR TRY_CAST(DATAABERTURA AS DATE) <= @hoje)
  AND (DATAFECHAMENTO IS NULL OR TRY_CAST(DATAFECHAMENTO AS DATE) >= @hoje)
  -- apenas VRSVAGAS:
  AND (CAST(ATIVO AS VARCHAR(10)) IN ('1', 'S', 's', 'Y', 'y'));
```

---

## 5. Candidatos por vaga (VRS — `ExtractCandidatosPorVagaAsync`)

**Pré-requisito:** `VagaTable` = `VRSVAGAS`.

**Saída:** `candidato_vaga.json`.

```sql
SELECT v.CODCOLIGADA,
       v.CODVAGA,
       v.NOME AS NOMEVAGA,
       c.CODPESSOA,
       c.APROVADO,
       c.STATUSTRIAGEM,
       c.CODSELECAO,
       c.CHAPA,
       p.NOME AS NOMEPESSOA,
       ISNULL(NULLIF(RTRIM(p.EMAIL), ''), NULLIF(RTRIM(p.EMAILPESSOAL), '')) AS EMAIL,
       p.TELEFONE1,
       p.TELEFONE2,
       p.CIDADE,
       p.ESTADO
FROM {VagaTableFull} v
INNER JOIN {VRSSELECOESVAGASCANDIDATOS} c
  ON c.CODVAGA = v.CODVAGA AND c.CODCOLIGADA = v.CODCOLIGADA
INNER JOIN {PessoaTableFull} p
  ON p.CODIGO = c.CODPESSOA
WHERE (v.DATAABERTURA IS NULL OR TRY_CAST(v.DATAABERTURA AS DATE) <= @hoje)
  AND (v.DATAFECHAMENTO IS NULL OR TRY_CAST(v.DATAFECHAMENTO AS DATE) >= @hoje)
  AND (CAST(v.ATIVO AS VARCHAR(10)) IN ('1', 'S', 's', 'Y', 'y'));
```

---

## 6. Perfil do candidato (`ExtractCandidatoPerfilAsync`)

**Entrada conceitual:** conjunto de `CODPESSOA` obtidos de `candidato_vaga.json` (gerado na seção anterior).

**Saída:** `candidato_perfil.json` (montagem textual + estruturas aninhadas no JSON).

Lista de CODPESSOA é interpolada como literais `'123','456'` (com escape de `'`).

### 6.1 Formação acadêmica

```sql
SELECT CODPESSOA, OUTROCURSO, CODCURSO, NOMEENTIDADE, ANOINICIO, ANOTERMINO
FROM {VFORMACAOACAD}
WHERE CODPESSOA IN ({lista_cod_pessoa})
```

### 6.2 Atuação profissional / experiência

```sql
SELECT CODPESSOA, NOMEINSTITUICAO, CODATUACAOPROF
FROM {SCVATUACAOPROFISSIONAL}
WHERE CODPESSOA IN ({lista_cod_pessoa})
```

### 6.3 Competências

```sql
SELECT CODPESSOA, CODCOMPETENCIA, OBSERVACAO
FROM {VCOMPETENCIAPESSOA}
WHERE CODPESSOA IN ({lista_cod_pessoa})
```

### 6.4 Certificações

```sql
SELECT CODPESSOA, CODCERTIFICACAO
FROM {VCERTIFICACAOPESSOA}
WHERE CODPESSOA IN ({lista_cod_pessoa})
```

---

## 7. Currículo anexo (binário — `ExtractCurriculosCvAsync`)

Primeiro resolve CPF/nome por pessoa:

```sql
SELECT CODIGO, CPF, NOME
FROM {PessoaTableFull}
WHERE CODIGO IN ({lista_cod_pessoa})
```

Depois lê blobs (streaming no código):

```sql
SELECT ID, CODPESSOA, DESCRICAO, ARQUIVO
FROM {VCURRICULOANEXO}
WHERE CODPESSOA IN ({lista_cod_pessoa})
  AND ARQUIVO IS NOT NULL
```

**Nota:** `ARQUIVO` é tratado como `byte[]` ou stream; para API REST costuma-se preferir endpoint dedicado por anexo ou base64/metadata separado.

---

## 8. Snapshot gestor × posição (`TryExtractGestorHierarquiaPosicaoSnapshotAsync`)

**Saída:** `gestor_hierarquia_posicao.json`  
**Timeout:** 480 s  

Objetivo: por funcionário na posição ativa (`VHIERARQUIAPOSICAO.STATUS = 1`), obter gestor pela **hierarquia superior** (OUTER APPLY com ocupante da posição do nó superior).

```sql
SELECT DISTINCT
       emp.CODCOLIGADA      AS CodColigadaFunc,
       emp.CHAPAFUNCIONARIO AS ChapaFunc,
       boss.CODCOLFUNCIONARIO AS CodColigadaGestor,
       boss.CHAPAFUNCIONARIO   AS ChapaGestor
FROM (
         SELECT VHIERARQUIAPOSICAO.CODCOLIGADA,
                VPOSICAO_EMP.CHAPAFUNCIONARIO,
                VHIERARQUIA.IDHIERARQUIASUPERIOR
         FROM {VHIERARQUIAPOSICAO} AS VHIERARQUIAPOSICAO
                  INNER JOIN {VHIERARQUIA} AS VHIERARQUIA
                             ON VHIERARQUIAPOSICAO.CODCOLIGADA = VHIERARQUIA.CODCOLIGADA
                                 AND VHIERARQUIAPOSICAO.IDHIERARQUIA = VHIERARQUIA.IDHIERARQUIA
                  INNER JOIN {VPOSICAO} AS VPOSICAO_EMP
                             ON VPOSICAO_EMP.CODCOLIGADA = VHIERARQUIAPOSICAO.CODCOLIGADA
                                 AND VPOSICAO_EMP.IDPOSICAO = VHIERARQUIAPOSICAO.CODPOSICAO
                  LEFT JOIN {PFUNC} AS PFUNC_EMP
                            ON PFUNC_EMP.CODCOLIGADA = VPOSICAO_EMP.CODCOLFUNCIONARIO
                                AND PFUNC_EMP.CHAPA = VPOSICAO_EMP.CHAPAFUNCIONARIO
         WHERE VHIERARQUIAPOSICAO.STATUS = 1
           AND (PFUNC_EMP.CODSITUACAO IS NULL OR PFUNC_EMP.CODSITUACAO NOT IN ('C', 'D'))
     ) AS emp
         OUTER APPLY (
    SELECT TOP (1)
           VPOSICAO_BOSS.CODCOLFUNCIONARIO,
           VPOSICAO_BOSS.CHAPAFUNCIONARIO
    FROM {VHIERARQUIA} AS VH_SUP
             INNER JOIN {VHIERARQUIAPOSICAO} AS VHP_SUP
                        ON VHP_SUP.CODCOLIGADA = VH_SUP.CODCOLIGADA
                            AND VHP_SUP.IDHIERARQUIA = VH_SUP.IDHIERARQUIA
             INNER JOIN {VPOSICAO} AS VPOSICAO_BOSS
                        ON VPOSICAO_BOSS.CODCOLIGADA = VHP_SUP.CODCOLIGADA
                            AND VPOSICAO_BOSS.IDPOSICAO = VHP_SUP.CODPOSICAO
             INNER JOIN {PFUNC} AS PFUNC_BOSS
                        ON PFUNC_BOSS.CODCOLIGADA = VPOSICAO_BOSS.CODCOLFUNCIONARIO
                            AND PFUNC_BOSS.CHAPA = VPOSICAO_BOSS.CHAPAFUNCIONARIO
    WHERE VH_SUP.CODCOLIGADA = emp.CODCOLIGADA
      AND VH_SUP.IDHIERARQUIA = emp.IDHIERARQUIASUPERIOR
      AND VHP_SUP.STATUS = 1
) AS boss
```

(`PFUNC` = `FuncionarioTable` configurável.)

---

## 9. Snapshot organograma por posição (`TryExtractFuncionarioHierarquiaOrganogramaSnapshotAsync`)

**Saída:** `funcionario_hierarquia_organograma.json`  
**Timeout:** 480 s  

Objetivo: nó `IDHIERARQUIA` do RM para o ocupante atual da posição (mapeamento para `Hierarquias.IdHierarquiaRm` no Portal).

```sql
SELECT DISTINCT
       VHIERARQUIAPOSICAO.CODCOLIGADA AS CodColigadaFunc,
       VPOSICAO_EMP.CHAPAFUNCIONARIO AS ChapaFunc,
       VHIERARQUIAPOSICAO.IDHIERARQUIA AS IdHierarquiaRm
FROM {VHIERARQUIAPOSICAO} AS VHIERARQUIAPOSICAO
         INNER JOIN {VHIERARQUIA} AS VHIERARQUIA
                    ON VHIERARQUIAPOSICAO.CODCOLIGADA = VHIERARQUIA.CODCOLIGADA
                        AND VHIERARQUIAPOSICAO.IDHIERARQUIA = VHIERARQUIA.IDHIERARQUIA
         INNER JOIN {VPOSICAO} AS VPOSICAO_EMP
                    ON VPOSICAO_EMP.CODCOLIGADA = VHIERARQUIAPOSICAO.CODCOLIGADA
                        AND VPOSICAO_EMP.IDPOSICAO = VHIERARQUIAPOSICAO.CODPOSICAO
         LEFT JOIN {PFUNC} AS PFUNC_EMP
                   ON PFUNC_EMP.CODCOLIGADA = VPOSICAO_EMP.CODCOLFUNCIONARIO
                       AND PFUNC_EMP.CHAPA = VPOSICAO_EMP.CHAPAFUNCIONARIO
WHERE VHIERARQUIAPOSICAO.STATUS = 1
  AND (PFUNC_EMP.CODSITUACAO IS NULL OR PFUNC_EMP.CODSITUACAO NOT IN ('C', 'D'))
```

---

## 10. O que já é API HTTP (fora deste worker)

No **Portal RH** existe fluxo Owner **“Gestores RM”** que chama URL configurável (consulta tipo dataset) por **CODCOLIGADA + CHAPA** — não usa SQL direto no integrador, mas replica **semanticamente** a mesma visão que alimentou o projeto. Ao desenhar APIs TOTVS, vale alinhar esse contrato com as seções **8** e **9**.

---

## 11. Sugestões de granularidade para os futuros endpoints

1. **API de catálogos:** áreas, seções, funções, cargos, filiais, hierarquia, usuários — equivalente aos dumps não incrementais ou com `modifiedSince` se disponível oficialmente.
2. **API de transações RH:** funcionários, pessoas, vagas VRS, requisições (`VREQ*`), histórico salarial — com paginação e, idealmente, o mesmo campo de controle temporal que `RECMODIFIEDON`.
3. **API de recrutamento VRS:** vagas abertas, candidatos, perfil consolidado por `CODPESSOA`, download de CV.
4. **API de organograma / posição:** export dos dois snapshots (gestor direto RM + ID hierarquia do ocupante).

---

## 12. Manutenção deste documento

- **Última revisão:** alinhada ao código em `Liotecnica.Integration.RM/RmDataExtractor.cs`.
- Ao alterar queries no código, atualizar esta página para o consultor TOTVS receber sempre a versão correta.
