# Tabelas do TOTVS RM identificadas para o processo de integração

> ⚠️ **Documento absorvido.** O conteúdo deste arquivo foi consolidado e atualizado em
> [`lucasCORPORERM_MAPA.md`](../lucasCORPORERM_MAPA.md) (raiz do `Voltage.RenderRH/`),
> que é agora o **mapa canônico** de todas as tabelas do CORPORERM usadas pelo sistema.
>
> Este arquivo é mantido apenas como histórico. Para informações atualizadas (incluindo
> tabelas adicionadas no refator de 2026-04-26: VHIERARQUIA, VREQDESLIGAMENTO, PFHSTSAL,
> XPESSOAFISICA, etc.), consulte o mapa novo.

Com base no schema extraído (CORPORERM_HMG) e na documentação TOTVS RM / Labore, segue o mapeamento dos **cadastros** do menu (Departamentos, Áreas, Categorias, Cargos, Unidades, Funcionários, Pessoa) e do **pré-cadastro**.

---

## Menu CADASTROS (correspondência com tabelas)

| Item do menu | Tabela principal no RM | Observação |
|--------------|------------------------|------------|
| **Áreas** | **BAREA** (dbo) | Tabela de áreas. Alternativa: **SAREA**, **ETABAREA**, **VAREASRH** (view). |
| **Departamentos** | **PSECAO** (dbo) | No RM Labore a “Seção” costuma ser o equivalente a departamento. **Tem estrutura pai/filho:** **CODIGO** (código da seção) e **CODIGOPAI** (código da seção pai; null = raiz). Alternativas: **SZLABDEPARTAMENTO** (lab), **IALOCACAODEPARTAMENTO**. |
| **Cargos** | **PCARGO** (dbo) | Tabela de cargos (ex.: Diretoria, Gerência, Coordenação – níveis organizacionais). Complementares: PCARGOCOMPL, PCLASSCARGO, PENCARGO. |
| **Funções (cargo/nome do cargo)** | **PFUNCAO** (dbo) | Tabela de **funções** (nome do cargo): ex. ANALISTA DE SISTEMA, COORDENADOR DE SISTEMA. Tem CODIGO, NOME (varchar 100), DESCRICAO, INATIVA, CARGO (ref. PCARGO), CBO, etc. Use esta tabela quando o cadastro de “cargo” for o nome da função. |
| **Categorias** | **LCATEGORIA** ou **HCATEGORIA** (dbo) | Depende do módulo (Labore vs outros). **SCODCATEGORIA**, **SZTIPOCATEGORIA** também aparecem. |
| **Unidades / Estabelecimentos** | **GFILIAL** (dbo) | Cadastro de **filiais/estabelecimentos** da empresa (NOME, endereço, telefone, CONTATO). Recomendado para Unit no Portal. Alternativa: **LUNIDADE** (unidades; pode estar vazia em alguns ambientes). |
| **Funcionários** | **EFUNCIONARIO** (dbo) | Cadastro de funcionários. **SEMPRESAFUNCIONARIO** (empresa-funcionário). Documentação TOTVS também cita **PFUNC** em alguns contextos. |
| **Pessoa** | **PPESSOA** (dbo) | Tabela-mestre de pessoas; funcionário herda de PPESSOA. Outras: **SPESSOA**, **XPESSOA**, **XPESSOAFISICA**. |

---

## Tabela de funcionários com status Ativo/Desligado

No schema do CORPORERM_HMG, a tabela **EFUNCIONARIO** (dbo) retornou **0 registros** na extração. A tabela que contém dados de funcionário **com indicador ativo/desligado** é:

| Tabela | Uso | Coluna de status |
|--------|-----|------------------|
| **SEMPRESAFUNCIONARIO** (dbo) | Cadastro empresa–funcionário (Soft House / integração). Contém NOME, CHAPA, EMAIL, CARGO, CPF, **ATIVO**, CODPESSOA, endereço, etc. | **ATIVO** (varchar(1)) – indica se o funcionário está ativo ou desligado (ex.: 'S'/'N' ou '1'/'0'). |

**Colunas principais de SEMPRESAFUNCIONARIO:**  
IDEMPRESA, IDFUNCIONARIO, NOME, TELEFONE, CHAPA, EMAIL, CARGO, CPF, **ATIVO**, FUNCAO, CODPESSOA, RUA, NUMERO, BAIRRO, ESTADO, CEP, DTNASCIMENTO, CARTIDENTIDADE, RECCREATEDBY, RECCREATEDON, RECMODIFIEDBY, RECMODIFIEDON, entre outras.

- **EFUNCIONARIO**: tabela base do Labore; no ambiente extraído está vazia (pode ser legada ou de outro módulo).
- **VFUNCIONARIO**: view (prefixo V) com poucas colunas (CODCOLIGADA, CHAPA, CODAREARH, REC*); não possui coluna ATIVO.
- **Recomendação para integração:** usar **SEMPRESAFUNCIONARIO** como fonte de funcionários quando EFUNCIONARIO estiver vazia; mapear ATIVO para Status (ativo/inativo) no portal.

---

## Mapeamento RM → Portal (integração)

Na integração com o RHPortal, usamos o seguinte mapeamento de conceitos:

| No RM (tabela) | No Portal (entidade / API) |
|----------------|----------------------------|
| **Departamento** (PSECAO) | **Área** (`api/areas`) |
| **Cargo/Função** (PCARGO ou **PFUNCAO**) | **Categoria** (`api/requisito-categorias`) |
| **Estabelecimento/Filial** (GFILIAL ou LUNIDADE) | **Unit** (`api/units`) |
| **Pessoa** (PPESSOA) | **Pessoa** (`api/pessoas`) |
| **Funcionário** (EFUNCIONARIO) | **Funcionario** (`api/funcionarios`) |

Ou seja: **Cargo** no RM = **Categoria** no portal. O worker lê os JSONs (departamento, cargo, unidade, pessoa, funcionario) e envia para as APIs correspondentes.

---

## Estrutura pai/filho em Departamento (PSECAO)

Na tabela **PSECAO** a hierarquia é representada por:

| Coluna     | Uso |
|------------|-----|
| **CODIGO** | Código da seção (ex.: "01", "01.01", "01.01.001"). |
| **CODIGOPAI** | Código da seção pai. **Null** = seção raiz; preenchido = seção filha (ex.: "01" ou "01.01"). |
| **DESCRICAO** | Nome/descrição da seção. |

Exemplo no `departamento.json`: primeiro registro tem `CODIGOPAI: null` (raiz); outros têm `CODIGOPAI: "01"`, `"01.01"`, `"01.01.001"` etc., formando a árvore de departamentos.

---

## Tabelas e views de VAGAS (vagas em aberto / recrutamento)

No schema do CORPORERM_HMG existem **várias tabelas** relacionadas a vagas e requisição de pessoal. O `vaga.json` atual está vazio porque a tabela configurada (**VVAGA**) pode não ter dados no ambiente ou a origem das vagas pode ser outra tabela.

### Tabelas de vagas identificadas

| Tabela | Uso | Colunas principais | Como identificar “em aberto” |
|--------|-----|--------------------|------------------------------|
| **VVAGA** (dbo) | Cadastro de vagas (nome, horário, salário, datas). **Atualmente configurada em RmSchema.VagaTable.** | CODCOLIGADA, CODVAGA, NOME, HORARIO, SALARIO, ESCOLARIDADE, EXPEXIGIDA, EXPDESEJADA, OBSERVACAO, **DATAABERTURA**, **DATAFECHAMENTO**, DATAINIDIVULGACAO, DATAFIMDIVULGACAO, CODFILIAL, CODPERFILCAND, PUBLICOALVO | `DATAABERTURA <= hoje AND (DATAFECHAMENTO IS NULL OR DATAFECHAMENTO >= hoje)` |
| **VRSVAGAS** (dbo) | Vagas do módulo **VRS (Recrutamento e Seleção)**. Função, complemento, remuneração, experiências. | CODCOLIGADA, CODFUNCAO, CODVAGA, NOME, **DATAABERTURA**, **DATAFECHAMENTO**, COMPLEMENTO, CODGRAUINSTRUCAO, REMUNERACAO, EXPERIENCIASEXIGIDAS, EXPERIENCIASDESEJADAS, **ATIVO**, TIPOANDAMENTOETAPA | `ATIVO = 'S' (ou 1) AND DATAABERTURA <= hoje AND (DATAFECHAMENTO IS NULL OR DATAFECHAMENTO >= hoje)` |
| **SVAGAS** (dbo) | Vagas (possivelmente estágio/convenio – IDCONVENIO). Informação da vaga, requisitos, cargo, departamento, status. | IDVAGA, IDEMPRESA, IDCONVENIO, INFORMACAOVAGA, REQUISITOSVAGA, LOCALTRABALHO, NRVAGAS, NRVAGASDEFICIENTE, CARGO, DEPARTAMENTO, **STATUS**, TIPOVAGA, VLRBOLSA, DTLIMITEDIVULGACAO, REC* | Filtrar por **STATUS** (valores dependem do domínio no banco; ex.: 'A' aberta, 'F' fechada). DTLIMITEDIVULGACAO para prazo de divulgação. |
| **VREQUISICAOPESSOAL** (dbo) | **Requisição de pessoal** (pedido de abertura de vaga). Liga seção, função, posto, vaga. | CODCOLIGADA, IDREQUISICAO, CODSECAO, CODFUNCAO, CODPOSTOTRABALHO, **CODVAGA**, IDPUBLICOALVO, CODHORARIO, CODRECEBIMENTO, TIPOADMISSAO, CODCCUSTO, CODTIPO, CODSECAOVAGA, REC* | Requisições aprovadas/abertas podem ser cruzadas com **VVAGA** ou **VRSVAGAS** via CODVAGA. |
| **VRSSELECOESVAGAS** (dbo) | **Processo de seleção** por vaga (abertura/fechamento, status, triagem). | CODCOLIGADA, CODSELECAO, CODVAGA, CODTRIAGEM, **DATAABERTURA**, **DATAFECHAMENTO**, **CODSTATUS**, CODFILIAL, CODSECAO, CODPERFILVAGA, UTILIZAREQUISICAO, REC* | Vagas em processo aberto: `DATAABERTURA <= hoje AND (DATAFECHAMENTO IS NULL OR DATAFECHAMENTO >= hoje) AND CODSTATUS` conforme domínio (ex.: aberta). |
| **SPSCONTROLEVAGAS** (dbo) | **Controle de quadro** por área (total de vagas x preenchidas). | CODCOLIGADA, IDPS, IDAREAINTERESSE, **NUMEROVAGASAREA**, **VAGASPREENCHIDAS**, REC* | Vagas em aberto na área = `NUMEROVAGASAREA - VAGASPREENCHIDAS`. Não descreve a vaga em si, só o número. |
| **SZHPDREQUISICAO** (dbo) | Requisição (protocolo). Pode ligar ao fluxo de requisição de pessoal. | CODCOLIGADA, ID, IDREQUISICAO, PROTOCOLO, REC* | Uso auxiliar; cruzar IDREQUISICAO com **VREQUISICAOPESSOAL** se o processo usar requisição. |

### Tabelas auxiliares (candidatos, etapas, perguntas)

- **SVAGASCANDIDATOS** – Candidatos por vaga (IDVAGA, RA, STATUS, PARECER).
- **VRSSELECOESPESSOASVAGAS** – Pessoas nas vagas de seleção (CODSELECAO, CODVAGA, CODPESSOA, ABANDONO).
- **VRSSELECOESVAGASCANDIDATOS** – Candidatos por seleção/vaga (CODSELECAO, CODVAGA, CODPESSOA, CHAPA, APROVADO, STATUSTRIAGEM, CODCOLREQUISICAO, IDREQ).
- **VRSVAGASCOMPL**, **VRSVAGASFILIAIS**, **VRSVAGASPERFILPROF** – Dados complementares e filiais das vagas VRS.
- **VVAGAPESSOA** – Relação vaga–pessoa.

### Recomendações para integração (vagas em aberto)

1. **Se o ambiente usa o módulo VRS (Recrutamento e Seleção):** usar **VRSVAGAS** como tabela principal de vagas e filtrar por **ATIVO** e por **DATAABERTURA** / **DATAFECHAMENTO** para “em aberto”.
2. **Se o ambiente usa apenas cadastro simples de vagas:** usar **VVAGA** (já configurada) e filtrar por **DATAABERTURA** e **DATAFECHAMENTO**; validar no banco se VVAGA tem dados (`SELECT TOP 1 * FROM dbo.VVAGA`).
3. **Se as vagas vêm de requisição de pessoal:** considerar **VREQUISICAOPESSOAL** e cruzar com **VVAGA** ou **VRSVAGAS** via **CODVAGA** para listar apenas vagas efetivamente abertas.
4. **Para “quantidade de vagas em aberto por área”** (sem detalhe da vaga): usar **SPSCONTROLEVAGAS** e calcular `NUMEROVAGASAREA - VAGASPREENCHIDAS`.

No **appsettings.json** (RmSchema):

- Para listar vagas em aberto vindas do cadastro simples: manter **VagaTable**: `VVAGA`.
- Para listar vagas do módulo Recrutamento e Seleção: usar **VagaTable**: `VRSVAGAS` e, na extração ou na API, filtrar por **ATIVO** e datas.

---

## Candidatos por vaga (sincronizar candidatos às vagas)

Para **identificar e sincronizar candidatos** às vagas já integradas (ex.: as 72 vagas de **VRSVAGAS**), use as tabelas de vaga–pessoa abaixo. O Portal espera **Candidato** com `VagaId`, `Nome`, `Email`, `Fone`, `Cidade`, `Uf`; a pessoa vem de **PPESSOA** (join por `CODPESSOA`).

### Tabelas de candidatos/inscrições por vaga

| Tabela | Uso | Chave vaga | Chave pessoa | Colunas úteis | Observação |
|--------|-----|------------|--------------|---------------|------------|
| **VRSSELECOESVAGASCANDIDATOS** | Candidatos por **seleção/vaga** (módulo VRS). | **CODVAGA** | **CODPESSOA** | APROVADO, STATUSTRIAGEM, CODCOLREQUISICAO, IDREQ, CHAPA | **Recomendada** quando as vagas vêm de **VRSVAGAS** (mesmo CODVAGA). |
| **VRSSELECOESPESSOASVAGAS** | Pessoas inscritas na vaga de seleção (VRS). | **CODVAGA** | **CODPESSOA** | ABANDONO | Inscrições; ABANDONO = desistência. Pode ser usada em conjunto ou como fonte alternativa. |
| **VVAGAPESSOA** | Relação vaga–pessoa (cadastro **VVAGA**). | **CODVAGA** | **CODPESSOA** | CODMEIODIVULGACAO, ORIGEM, DATAINCLUSAO | Use se as vagas forem de **VVAGA** (não VRS). |
| **SVAGASCANDIDATOS** | Candidatos por vaga (módulo **SVAGAS**). | **IDVAGA** | **RA** (registro) | STATUS, PARECER | Outro modelo; vaga identificada por **IDVAGA** (não CODVAGA). |
| **SCANDIDATOPROCSEL** | Candidato em processo de seleção (outro módulo). | (ver schema) | (ver schema) | Muitas colunas | Validar no ambiente se é usado para as mesmas vagas. |

### Dados da pessoa (PPESSOA)

Para montar o candidato no Portal, faça **JOIN** com **PPESSOA** onde `PPESSOA.CODIGO = CODPESSOA`:

| PPESSOA (coluna) | Portal (Candidato) |
|------------------|---------------------|
| NOME | Nome |
| EMAIL ou EMAILPESSOAL | Email (obrigatório; usar fallback se um for nulo) |
| TELEFONE1 / TELEFONE2 | Fone |
| CIDADE | Cidade |
| ESTADO | Uf |

**Importante:** o Portal exige `Email` no candidato. Se em PPESSOA não houver EMAIL/EMAILPESSOAL, é possível usar um valor placeholder por ambiente (ex.: `noreply@empresa.com`) ou **não sincronizar** esse registro e registrar em log.

### Como identificar se há candidatos para as vagas (VRS)

Consulta sugerida no RM para **listar/contar candidatos por vaga** (vagas em aberto VRS):

```sql
-- Candidatos por vaga (VRS): contagem por CODVAGA
SELECT v.CODVAGA, v.NOME AS NOMEVAGA, COUNT(c.CODPESSOA) AS QTD_CANDIDATOS
FROM dbo.VRSVAGAS v
LEFT JOIN dbo.VRSSELECOESVAGASCANDIDATOS c ON c.CODVAGA = v.CODVAGA AND c.CODCOLIGADA = v.CODCOLIGADA
WHERE CAST(v.ATIVO AS VARCHAR(10)) IN ('1', 'S', 's')
  AND v.DATAABERTURA <= GETDATE()
  AND (v.DATAFECHAMENTO IS NULL OR v.DATAFECHAMENTO >= GETDATE())
GROUP BY v.CODCOLIGADA, v.CODVAGA, v.NOME
ORDER BY QTD_CANDIDATOS DESC;
```

Para **listar candidatos com dados da pessoa** (para futura sincronização):

```sql
-- Candidatos com nome/e-mail para as vagas em aberto VRS
SELECT v.CODVAGA, v.NOME AS NOMEVAGA, c.CODPESSOA, p.NOME, ISNULL(p.EMAIL, p.EMAILPESSOAL) AS EMAIL, p.TELEFONE1, p.CIDADE, p.ESTADO, c.APROVADO, c.STATUSTRIAGEM
FROM dbo.VRSVAGAS v
INNER JOIN dbo.VRSSELECOESVAGASCANDIDATOS c ON c.CODVAGA = v.CODVAGA AND c.CODCOLIGADA = v.CODCOLIGADA
INNER JOIN dbo.PPESSOA p ON p.CODIGO = c.CODPESSOA
WHERE CAST(v.ATIVO AS VARCHAR(10)) IN ('1', 'S', 's')
  AND v.DATAABERTURA <= GETDATE()
  AND (v.DATAFECHAMENTO IS NULL OR v.DATAFECHAMENTO >= GETDATE())
ORDER BY v.CODVAGA, p.NOME;
```

Assim é possível **confirmar se existem candidatos** para as vagas já sincronizadas e, em seguida, implementar a extração (ex.: `candidato_vaga.json`) e o serviço de sync (RM → Portal) usando **VRSSELECOESVAGASCANDIDATOS** + **PPESSOA**, mapeando **CODVAGA** para o `VagaId` do Portal (via `Codigo` da vaga) e criando/atualizando **Candidato** pela API `api/candidatos`.

### Mapeamento RM → Portal (candidatos)

| No RM | No Portal |
|-------|-----------|
| CODVAGA (VRSVAGAS / VRSSELECOESVAGASCANDIDATOS) | VagaId (Guid da vaga com mesmo Codigo no Portal) |
| PPESSOA.NOME | Candidato.Nome |
| PPESSOA.EMAIL ou EMAILPESSOAL | Candidato.Email |
| PPESSOA.TELEFONE1 | Candidato.Fone |
| PPESSOA.CIDADE, ESTADO | Candidato.Cidade, Uf |
| (CODPESSOA + CODVAGA) | Chave única para upsert (evitar duplicar candidato na mesma vaga) |

---

## Dados de CV no RM (formação, experiência, treinamentos, anexo)

Para enriquecer o candidato no Portal com **CV em texto** (CvText) ou com **atribuições, funções, experiência e treinamentos**, use as tabelas/views abaixo. O Portal aceita **CvText** (texto livre) no create/update de candidato; experiências e formação podem ser enviadas como texto nesse campo até haver API específica.

### Tabelas por tipo de dado

| Uso | Tabela / View | Chave pessoa | Colunas principais | Observação |
|-----|----------------|--------------|--------------------|------------|
| **Formação acadêmica** | **VFORMACAOACAD** (dbo) | **CODPESSOA** | CODCURSO, OUTROCURSO, NOMEENTIDADE, MESINICIO, ANOINICIO, MESTERMINO, ANOTERMINO, ANDAMENTO | Curso, instituição, período. |
| **Formação (módulo SCV)** | **SCVFORMACAOACADEMICA** (dbo) | **CODPESSOA** | NOMECURSO, NOMEINSTITUICAO, ANOINICIO, ANOCONCLUSAO, STATUSCURSO | Se o ambiente usar currículo acadêmico (SCV). |
| **Experiência / atuação profissional** | **SCVATUACAOPROFISSIONAL** (dbo) | **CODPESSOA** | CODATUACAOPROF, NOMEINSTITUICAO, SIGLAINSTITUICAO | Atuação profissional (instituição, código). |
| **Competências** | **VCOMPETENCIAPESSOA** (dbo) | **CODPESSOA** | CODCOMPETENCIA, CODGRADUACAO, OBSERVACAO | Competências da pessoa. |
| **Certificações** | **VCERTIFICACAOPESSOA** (dbo) | **CODPESSOA** | CODCERTIFICACAO | Cruzar com tabela de certificações para obter nome. |
| **Treinamentos / cursos** | **VCURSOSPESSOAIS** (dbo) | **CHAPA** (não CODPESSOA) | CODCURSO, DTINICURSO, DTFIMCURSO, APROVEITAMENTO, OBSERVACOES | Por funcionário (CHAPA). Para candidato, obter CODPESSOA via SEMPRESAFUNCIONARIO (CHAPA → CODPESSOA) se for ex-funcionário. |
| **CV anexo (arquivo)** | **VCURRICULOANEXO** (dbo) | **CODPESSOA** | DESCRICAO, DATAANEXO, ARQUIVO (binário) | Anexo de currículo. O binário não é trivial enviar ao Portal; usar **DESCRICAO** no CvText ou Obs. |
| **Currículo usuário** | **VUSUARIOCURRICULO** (dbo) | (ver schema) | Possível texto ou resumo de currículo. | Validar no ambiente. |

### Funções / atribuições (histórico de cargo/função)

- **VHISTFUNCAO** (dbo): histórico de **revisão da função** (CODFUNCAO, DESCRICAO, DATAALTERACAO), não vínculo pessoa–função. Para “atribuições do candidato” (cargos que ocupou), usar **SCVATUACAOPROFISSIONAL** (atuação profissional) ou tabelas de alocação/movimentação de pessoal (ex.: **EALOCACAO**, **PFUNC**) se o candidato for ou foi funcionário.

### Rastreio: tabelas de experiência dos candidatos no RM

A integração já usa **SCVATUACAOPROFISSIONAL** (dbo) para experiência/atuação profissional (ver `RmDataExtractor.ExtractCandidatoPerfilAsync`). Resumo do rastreio no schema CORPORERM_HMG:

| Tabela | Chave pessoa | Colunas principais | Uso na integração |
|--------|--------------|--------------------|--------------------|
| **SCVATUACAOPROFISSIONAL** (dbo) | **CODPESSOA** | CODCOLIGADA, CODPROF, CODCV, **CODATUACAOPROF**, CODINSTITUICAO, **NOMEINSTITUICAO**, SIGLAINSTITUICAO, REC* | **Usada.** Consulta `CODPESSOA, NOMEINSTITUICAO, CODATUACAOPROF` para montar o array Experiencias no candidato_perfil.json. Se no seu ambiente o `candidato_perfil.json` não tiver nenhum item em "Experiencias", pode ser que esta tabela esteja vazia para os CODPESSOA dos candidatos (ex.: currículo não preenchido no módulo SCV). |
| **SCVATVATUACAOPROFISSIONAL** (dbo) | (ver schema) | CODATUACAOPROF, … | Possível view ou tabela relacionada; validar no banco se contém dados de experiência por pessoa. |
| **SCANDIDATOPROCSEL** (dbo) | Não tem CODPESSOA | IDPROCSEL, NUMEROINSCPROCSEL, NOME, CPFALUNO, ESCOLAORIGEM, GRAUINSTRUCAO, CODOCUPACAO, … | Candidato em **processo seletivo** (outro módulo, ex.: acadêmico). Não é a mesma lista de CODPESSOA das vagas VRS. Não usar como fonte de experiência para integração RM → Portal de vagas. |

**Recomendações:**

1. **Validar no banco** se **SCVATUACAOPROFISSIONAL** tem linhas para os CODPESSOA que aparecem em `candidato_vaga.json`:  
   `SELECT CODPESSOA, COUNT(*) FROM dbo.SCVATUACAOPROFISSIONAL WHERE CODPESSOA IN (...) GROUP BY CODPESSOA`
2. Se estiver vazia, confirmar com o time funcional onde a experiência profissional dos candidatos é cadastrada no RM (módulo SCV, outro cadastro, ou não utilizado).
3. A integração já está preparada: assim que houver dados em **SCVATUACAOPROFISSIONAL** para esses CODPESSOAs, o `ExtractCandidatoPerfilAsync` passará a preencher "Experiencias" no `candidato_perfil.json` e o sync enviará ao Portal.

---

### Como usar na integração

1. **CvText (recomendado):** Montar um texto único por **CODPESSOA** concatenando:
   - Formação: linhas de **VFORMACAOACAD** (ou **SCVFORMACAOACADEMICA** se existir) → ex.: "Formação: Curso X - Instituição Y (2020-2024)."
   - Experiência: linhas de **SCVATUACAOPROFISSIONAL** → ex.: "Experiência: Instituição Z - Atuação W."
   - Competências: linhas de **VCOMPETENCIAPESSOA** (OBSERVACAO ou descrição de CODCOMPETENCIA).
   - Certificações: linhas de **VCERTIFICACAOPESSOA** (código ou nome da certificação).
   - Treinamentos: se houver **VCURSOSPESSOAIS** por CODPESSOA (via CHAPA), incluir curso e período.
   - Opcional: **VCURRICULOANEXO.DESCRICAO** como bloco “Anexo: …”.
2. Na sincronização RM → Portal, ao criar/atualizar o candidato, enviar esse texto no campo **CvText** (e opcionalmente um resumo em **Obs**).
3. **Currículo em arquivo ou base64:** o Portal **já atende currículo em arquivo** (multipart). **Base64** pode ser suportado com um endpoint adicional.

### Currículo em arquivo (Portal já atende)

| Entidade | Endpoint | Formato | Uso na integração RM |
|----------|----------|---------|----------------------|
| **Talento** | `POST api/talentos/import-pdf` | **multipart/form-data** (Arquivo = PDF) | Após criar/atualizar Talento por email, ler **VCURRICULOANEXO.ARQUIVO** (binário) por CODPESSOA, montar um `Stream`/`byte[]` e enviar como multipart para este endpoint. O Portal grava em **TalentoDocumento** e pode processar (extração de texto, GPT). |
| **Candidato** | `POST api/candidatos/{id}/documentos` | **multipart/form-data** (Arquivo, Tipo, Descricao) | Após sincronizar Candidato, ler **VCURRICULOANEXO** por CODPESSOA, enviar o binário como multipart com `Tipo = Curriculo`. O Portal grava em **CandidatoDocumento**. |

Ou seja: **se tivéssemos o currículo** no RM (**VCURRICULOANEXO** com coluna **ARQUIVO** preenchida), a integração pode enviá-lo em **arquivo** (multipart) para o Portal; não é necessário base64 para isso. O worker RM lê o blob do RM, monta a requisição HTTP multipart e chama o endpoint acima.

### Currículo em base64 (opcional no Portal)

Hoje o Portal **não** expõe endpoint que aceite currículo em **base64** no body JSON (ex.: `{ "curriculoBase64": "...", "nomeArquivo": "cv.pdf" }`). Se for desejável evitar montar multipart no worker (ex.: enviar tudo em um único JSON), pode-se acrescentar na API do Portal um endpoint (ou um campo no PUT/POST de talento/candidato) que aceite **base64**, decodifique e grave como documento. Assim o currículo do RM poderia ser lido, convertido para base64 e enviado em JSON.

---

## Pré-cadastro

Para **pré-cadastro** (cadastro inicial antes da admissão / portal de candidatos), as tabelas mais prováveis no banco são:

| Uso | Tabela | Observação |
|-----|--------|------------|
| **Pré-cadastro / Portal** | **SZPORTALCADASTRO** (dbo) | Nome sugere cadastro via portal. |
| **Pré-cadastro prestador** | **SZPORTALPRESTCADASTRO** (dbo) | Cadastro de prestadores via portal. |
| **Recuperação de senha** | **SZPORTALPRESTCADASTRORECSENHA** (dbo) | Suporte ao fluxo de senha do portal. |

Recomendação: consultar **schema_colunas.json** para **SZPORTALCADASTRO** e **SZPORTALPRESTCADASTRO** e validar com o time funcional se são as tabelas usadas no fluxo de pré-cadastro do seu ambiente.

---

## Outras tabelas identificadas no schema (CORPORERM_HMG)

Além das tabelas já mapeadas acima, o schema contém **milhares** de tabelas. Abaixo, agrupamentos adicionais que podem ser úteis para integração ou análise.

### Módulo SCV (currículo / atuação profissional – CODPESSOA)

Todas com **CODPESSOA** no schema_colunas; úteis para enriquecer perfil de candidato ou pesquisador:

| Tabela | Uso provável |
|--------|----------------|
| **SCVFORMACAOACADEMICA** | Formação acadêmica (módulo SCV). Já referenciada no doc. |
| **SCVATUACAOPROFISSIONAL** | Atuação/experiência profissional. **Usada na integração.** |
| **SCVATVATUACAOPROFISSIONAL** | Tipo/valor atuação profissional (relacionada). |
| **SCVVINCULOATUACAOPROFISSIONAL** | Vínculo da atuação profissional. |
| **SCVAREAATUACAO** | Área de atuação por pessoa. |
| **SCVAREACONHECIMENTO** | Área de conhecimento. |
| **SCVAREACONHECFORMACAD** | Área de conhecimento × formação acadêmica. |
| **SCVORIENTACAO** | Orientação (ex.: acadêmica). |
| **SCVEQUIPEPESQUISA** | Equipe de pesquisa. |
| **SCVPROJETOPESQUISA** | Projeto de pesquisa. |
| **SCVPROFESSOR** | Professor (módulo SCV). |
| **SCVPRODUCAOTECNICA** | Produção técnica. |
| **SCVPRODUCAOCULTURAL** | Produção cultural. |
| **SCVPRODBIBLIOGRAFICA** | Produção bibliográfica. |
| **SCVPREMIO** | Prêmios. |
| **SCVEVENTO** | Eventos (ex.: participação). |
| **SCVCITACAO** | Citações. |
| **SCVIDIOMA** | Idiomas. |
| **SCVBANCA** | Bancas (ex.: qualificação). |
| **SCVPALAVRACHAVE** | Palavras-chave. |
| **SCVSETORATV** | Setor de atividade. |

### Views V* (formação, competência, certificação, treinamento, candidato)

| Tabela | Uso |
|--------|-----|
| **VFORMACAOACAD** | Formação acadêmica. **Usada na integração.** |
| **VFORMACAOADIC**, **VFORMACAOADICCOMPL** | Formação adicional. |
| **VCOMPETENCIAPESSOA** | Competências por pessoa. **Usada na integração.** |
| **VCERTIFICACAOPESSOA** | Certificações por pessoa. **Usada na integração.** |
| **VCURRICULOANEXO** | Anexo de currículo. **Usada na integração.** |
| **VCURSOSPESSOAIS** | Cursos/treinamentos (CHAPA). **Usada na integração.** |
| **VUSUARIOCURRICULO** | Currículo do usuário (texto/resumo). Validar colunas. |
| **VCANDIDATOS**, **VCANDIDATOCOLIGADA**, **VCANDIDATOHISTCONSENT** | Candidatos (views). |
| **VPLANOTREINAMENTO**, **VREQTREINAMENTO**, **VTREINAMENTO*** | Plano e requisição de treinamento. |
| **VHISTFUNCAO** | Histórico de função (revisão da função). Já referenciada. |

### Módulo VRS (Recrutamento e Seleção)

Além de **VRSVAGAS** e **VRSSELECOESVAGASCANDIDATOS** (já documentadas):

| Tabela | Uso |
|--------|-----|
| **VRSSELECOES** | Processos de seleção. |
| **VRSSELECOESPESSOASVAGAS** | Pessoas por vaga de seleção (inscrições). |
| **VRSSELECOESVAGAS** | Seleções por vaga. |
| **VRSSELECOESVAGASREQCANDIDATURA** | Requisitos de candidatura por seleção/vaga. |
| **VRSTRIAGEM**, **VRSTRIAGEMREQUISITOS** | Triagem e requisitos de triagem. |
| **VRSCURSOSACADEMICOSTRIAGEM**, **VRSCOMPETENCIASTRIAGEM** | Critérios de triagem (curso, competência). |
| **VRSQUESTIONARIOCAPTACAO**, **VRSPERGUNTASCAPTACAO**, **VRSOPCOESRESPOSTASCAPTACAO** | Questionário e perguntas de captação. |
| **VRSVAGASCOMPL**, **VRSVAGASFILIAIS**, **VRSVAGASPERFILPROF** | Dados complementares das vagas VRS. |

### Portal (SZPORTAL*)

| Tabela | Uso |
|--------|-----|
| **SZPORTALCADASTRO** | Cadastro via portal. Já referenciada. |
| **SZPORTALPRESTCADASTRO** | Cadastro de prestador via portal. |
| **SZPORTALPRESTCADASTRORECSENHA** | Recuperação de senha (prestador). |
| **SZPORTALAGENDAMENTO**, **SZPORTALARQUIVO**, **SZPORTALCONVENIO** | Agendamento, arquivo, convênio (portal). |
| **SZPORTALLOGIN**, **SZPORTALLOGINBLOQUEIO** | Login e bloqueio. |
| **SZPORTALNOTIFICACAO** | Notificações. |
| **SZPORTALPRESTLOGIN**, **SZPORTALPRESTSESSAO**, **SZPORTALSESSAO** | Sessão prestador/portal. |

### Histórico e exclusão (VHIST*)

| Tabela | Uso |
|--------|-----|
| **VHISTFUNCAO** | Histórico de alteração de função. |
| **VHISTEXCCANDETAPA** | Exclusão de candidato por etapa (processo seletivo). |
| **VHISTVAGASFUNCAO**, **VHISTVAGASLOTACAO**, **VHISTVAGASSECAO** | Histórico de vagas por função/lotação/seção. |

### Candidato / processo seletivo (outros módulos)

| Tabela | Observação |
|--------|------------|
| **SCANDIDATOPROCSEL** | Candidato em processo seletivo (ex.: acadêmico). Sem CODPESSOA; outro modelo. |
| **SOPCAOCANDIDATO**, **UOPCAOCANDIDATO** | Opção de candidato. |
| **SPSARQUIVOSCANDIDATO**, **SPSRESPONSAVELCANDIDATO** | Arquivos e responsável do candidato (módulo SPS). |
| **SPSPERFILPROFISSIONAL**, **SPSPROFISSIONAL** | Perfil e profissional (SPS). |
| **UCANDIDATOPROCSEL** | Candidato processo seletivo (módulo U). |

### Área de atuação (diversos)

| Tabela | Chave | Uso |
|--------|-------|-----|
| **PAREAATUACAO** | (ver schema) | Área de atuação (cadastro P). |
| **SCVAREAATUACAO** | **CODPESSOA** | Área de atuação por pessoa (SCV). |
| **VAREASATUACAO** | (view) | View de áreas de atuação. |
| **NEMPREGOLOCALIDADEATUACAO** | (ver schema) | Localidade de atuação (emprego). |

Para listar **todas** as tabelas do banco: use `schema_tabelas.json` (≈ 8.400 tabelas). Para colunas e presença de **CODPESSOA**: use `schema_colunas.json`.

---

## Referências

- Schema extraído: `schema_tabelas.json` e `schema_colunas.json` nesta pasta.
- TOTVS RM / Labore: cadastros de funcionário, centros de custo, seções, funções (cargos).
- Estrutura comum: **PPESSOA** como mestre; **EFUNCIONARIO**/PFUNC com CODPESSOA referenciando PPESSOA; **PCARGO**; **BAREA** para áreas; **PSECAO** para seções/departamentos.

---

## Próximo passo no appsettings (RmSchema)

Após validar os nomes no seu banco, ajuste em **Liotecnica.Integration.RM** → `appsettings.json` (seção **RmSchema**), por exemplo:

- **Área:** `BAREA` (ou a tabela que for padrão no seu RM).
- **Departamento/Seção:** `PSECAO`.
- **Cargo (nível):** `PCARGO`.
- **Cargo (nome da função, ex. ANALISTA DE SISTEMA):** `PFUNCAO` – use em **RmSchema.CargoTable** se o cadastro desejado for o nome do cargo/função.
- **Vaga:** use **VVAGA** (cadastro simples) ou **VRSVAGAS** (módulo Recrutamento e Seleção). Ver seção **Tabelas e views de VAGAS** acima para colunas e como identificar vagas em aberto (DATAABERTURA, DATAFECHAMENTO, ATIVO, STATUS). Para mais tabelas/views, consulte schema_tabelas.json por VAGA ou REQUISICAO (ex.: VREQUISICAOPESSOAL, VRSSELECOESPESSOASVAGAS). Se ainda não tiver dados, valide (pode existir view/tabela de vagas/requisição, ex. **VREQUISICAOPESSOAL**, **VRSSELECOESPESSOASVAGAS**). Consulte `schema_tabelas.json` por “VAGA” ou “REQUISICAO”.

Depois rode novamente o worker para extrair os dados dessas tabelas para os JSONs em **Liotecnica.Integration.RM.Schema.Tables**.
