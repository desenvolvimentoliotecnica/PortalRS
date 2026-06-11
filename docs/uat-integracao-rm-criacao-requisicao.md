# UAT - Criacao de requisicao e integracao com RM

## Objetivo

Validar o fluxo ponta a ponta em que uma requisicao de vaga e criada no Portal RH, passa pelo fluxo de aprovacao, entra na fila de integracao RM, e o worker envia a criacao para o endpoint TOTVS RM.

Este roteiro cobre:

- Configuracao do endpoint RM.
- Criacao de requisicao pelo gestor/RH.
- Aprovacao da requisicao.
- Enfileiramento para RM.
- Processamento pelo worker.
- Conferencia no Portal RH, dashboard e banco.
- Cenarios de sucesso e falha.

## Escopo validado

Tipos de solicitacao esperados para integracao RM:

- **Vaga nova** (`TipoSolicitacao = 0`)
- **Aumento de quadro** (`TipoSolicitacao = 2`)

Tipos fora deste escopo nao devem ser considerados para criacao RM neste UAT.

## Ambiente de teste

Exemplo usado neste roteiro:

- Tenant: `liotecnica`
- Portal: `http://10.0.0.80:3000/app`
- API: `http://10.0.0.80:5000`
- Endpoint RM:

```text
http://172.19.30.37:8051/RMSRestDataServer/rest/RhuReqAumentoQuadroData
```

## Usuarios e perfis para execucao

Antes de iniciar, separe os usuarios abaixo. Substitua os nomes de exemplo pelos usuarios reais do tenant `liotecnica`.

| Papel no UAT | Usuario exemplo | Quando usar | Acessos necessarios |
| --- | --- | --- | --- |
| Administrador do Portal | `owner/admin liotecnica` | Configurar endpoint TOTVS, acompanhar painel de integracao, reprocessar falhas e validar dashboard | **Administração > Integração TOTVS**, **Relatórios > Dashboard Integração RM**, permissao para reprocessar integracao |
| Solicitante / Gestor requisitante | `gestor.requisitante@liotecnica` | Criar a requisicao de vaga nova no Portal | **Solicitações de Vaga** e acesso aos cadastros usados nos combos |
| Aprovador direto | `fabio.barreto@liotecnica` ou aprovador configurado na aba **Aprovação** | Aprovar a etapa atribuida ao superior direto | **Aprovações** e permissao de aprovador da etapa atual |
| Proximo aprovador / RH / Headcount | `rh.aprovador@liotecnica` ou usuario definido no fluxo | Aprovar etapas adicionais, se o fluxo pedir | **Aprovações** e permissao da etapa/fila correspondente |
| Analista de banco / suporte tecnico | `suporte tecnico` | Executar validacoes SQL opcionais e conferir logs/worker | Acesso somente leitura ao banco do tenant e aos logs da API |
| Usuario RM | usuario tecnico RM fornecido pela TOTVS | Credencial salva na configuracao do endpoint | Permissao no RM para criar requisicao pelo endpoint |

Regra de execucao:

- Nao aprove a requisicao usando o mesmo usuario que criou a solicitacao, exceto se essa for uma regra explicitamente permitida no ambiente.
- Em cada etapa de aprovacao, saia do usuario anterior e entre com o usuario indicado na etapa pendente.
- Se a etapa aparecer como fila/perfil, use um usuario que faca parte dessa fila ou perfil.
- Se a tela **Aprovações** mostrar a requisicao para o solicitante, ela deve estar apenas para consulta/edicao quando houver ajuste solicitado; os botoes de aprovacao devem aparecer somente para o aprovador atual.

## Dados de exemplo

Use dados que existam nos cadastros do tenant. Caso algum item nao apareca nos combos, substitua por outro equivalente.

| Campo | Valor exemplo |
| --- | --- |
| Empresa | `01 - LioTecnica` |
| Filial | `01 - Matriz` |
| Secao / Centro de custo | `01.01 - Tecnologia` |
| Funcao RM | `ANALISTA DE INFRAESTRUTURA SR` |
| Cargo | `Analista de Infraestrutura SR` |
| Tipo de solicitacao | `Vaga nova` |
| Motivo | `Expansao da Base` ou motivo com efeito `Aumenta` |
| Quantidade de posicoes | `1` |
| Tipo de contrato | `CLT` |
| Decisao de headcount | `Aumento definitivo` |
| Turno | `Administrativo` ou turno global disponivel |
| Faixa salarial minima | `R$ 5.000,00` |
| Faixa salarial maxima | `R$ 7.000,00` |
| Justificativa | `Necessidade de reforco da equipe de infraestrutura para atendimento dos projetos internos.` |

## Pre-requisitos

Antes de iniciar:

- [ ] Administrador do Portal consegue acessar o tenant `liotecnica`.
- [ ] Solicitante / gestor requisitante consegue acessar o tenant `liotecnica`.
- [ ] Aprovador direto configurado para o solicitante consegue acessar o tenant `liotecnica`.
- [ ] Demais aprovadores/fila do fluxo conseguem acessar o tenant, se existirem.
- [ ] Administrador do Portal possui acesso a **Administração > Integração TOTVS**.
- [ ] Solicitante possui acesso a **Solicitações de Vaga**.
- [ ] Aprovadores possuem acesso a **Aprovações**.
- [ ] Existe endpoint RM, usuario e senha validos.
- [ ] Cadastros obrigatorios existem: empresa, filial/unidade, centro de custo/secao, funcao RM, motivo de requisicao e turno.
- [ ] API/backend esta em execucao com o worker RM habilitado.

## UAT 1 - Configurar endpoint RM

Objetivo: garantir que o Portal RH tem os dados necessarios para enviar requisicoes ao RM.

Usuario logado: **Administrador do Portal** (`owner/admin liotecnica`).

Passo a passo:

1. Acesse `http://10.0.0.80:3000/app`.
2. Faca login como **Administrador do Portal**.
3. No menu lateral, expanda **Administração**.
4. Clique em **Integração TOTVS**.
5. Clique na aba **Requisições/Solicitações RM**.
6. No campo **Endpoint**, informe:

```text
http://172.19.30.37:8051/RMSRestDataServer/rest/RhuReqAumentoQuadroData
```

7. No campo **Usuario**, informe o usuario RM fornecido.
8. No campo **Senha**, informe a senha RM fornecida.
9. Clique em **Salvar configuração**.

Resultado esperado:

- [ ] Sistema exibe mensagem de sucesso.
- [ ] Ao atualizar a pagina, endpoint, usuario e senha permanecem salvos.
- [ ] Nao aparece erro HTTP 415.

Validacao SQL opcional:

```sql
SELECT
  "TenantId",
  "CreateEndpointUrl",
  NULLIF("RestUsername", '') IS NOT NULL AS usuario_configurado,
  NULLIF("RestPasswordEncrypted", '') IS NOT NULL AS senha_configurada
FROM "TenantRmConfiguracoes"
WHERE "TenantId" = 'liotecnica';
```

Resultado esperado:

- `CreateEndpointUrl` preenchido.
- `usuario_configurado = true`.
- `senha_configurada = true`.

## UAT 2 - Criar requisicao de vaga nova

Objetivo: criar uma requisicao que deve entrar no fluxo RM.

Usuario logado: **Solicitante / Gestor requisitante** (`gestor.requisitante@liotecnica`).

Passo a passo:

1. Se estiver logado como Administrador do Portal, faca logout.
2. Faca login como **Solicitante / Gestor requisitante**.
3. No menu lateral, clique em **Solicitações de Vaga**.
4. Clique em **Nova solicitação**.
5. Na aba/dados de identificacao, preencha:
   - **Empresa**: selecione `01 - LioTecnica`.
   - **Filial**: selecione `01 - Matriz`.
   - **Seção**: selecione `01.01 - Tecnologia`.
   - **Função**: busque `ANALISTA DE INFRAESTRUTURA SR` e selecione.
   - **Cargo**: selecione `Analista de Infraestrutura SR`, se o campo aparecer/for obrigatorio.
   - **Tipo de solicitação**: selecione **Vaga nova**.
   - **Motivo**: selecione um motivo com efeito de aumento de headcount, por exemplo **Expansão da Base**.
   - **Quantidade de posições**: informe `1`.
   - **Tipo de contrato**: selecione **CLT**.
   - **Decisão de headcount**: selecione **Aumento definitivo**.
   - **Justificativa**:

```text
Necessidade de reforco da equipe de infraestrutura para atendimento dos projetos internos.
```

6. Informe a faixa salarial:
   - **Proposta faixa salarial - mín.**: `R$ 5.000,00`
   - **Proposta faixa salarial - máx.**: `R$ 7.000,00`
7. Informe o horario:
   - Se houver campo **Turno**, selecione **Administrativo**.
   - Se nao houver turno adequado, informe uma escala valida, por exemplo `5x2 - 08:00 as 17:48`.
8. Na aba **Aprovação**, confira quem ficou como aprovador da etapa atual.
9. Anote o nome do aprovador exibido. Exemplo: `Fabio Barreto Diniz`.
10. Revise os dados.
11. Clique em **Salvar** ou **Criar solicitação**.

Resultado esperado:

- [ ] Sistema cria a requisicao.
- [ ] Sistema submete automaticamente.
- [ ] Para **Vaga nova**, status esperado apos criacao: **Pendente Aprovação**.
- [ ] A requisicao aparece na lista de **Solicitações de Vaga**.

Validacao SQL:

```sql
SELECT
  "Id",
  "Titulo",
  "TipoSolicitacao",
  "Status",
  "RmCriacaoSolicitadaEmUtc",
  "IntegracaoResultado",
  "IntegracaoMensagem",
  "TentativasIntegracao",
  "RmRequisicaoCodigo",
  "CreatedAtUtc"
FROM "SolicitacoesVaga"
WHERE "Titulo" ILIKE '%INFRAESTRUTURA%'
ORDER BY "CreatedAtUtc" DESC
LIMIT 5;
```

Resultado esperado logo apos criacao:

- `TipoSolicitacao = 0`
- Status ainda pode estar em aprovacao.
- `RmCriacaoSolicitadaEmUtc` pode ficar vazio ate a aprovacao/efetivacao final do fluxo.

## UAT 3 - Aprovar a requisicao

Objetivo: concluir a cadeia de aprovacao ate a requisicao ficar aprovada.

Usuario logado: **Aprovador direto** exibido na aba **Aprovação** do UAT 2. Exemplo: `Fabio Barreto Diniz`.

Passo a passo:

1. Se estiver logado como solicitante, faca logout.
2. Faca login como o **Aprovador direto** indicado na requisicao.
3. Acesse **Aprovações**.
4. Localize a requisicao criada no UAT 2.
5. Abra a requisicao.
6. Verifique os dados preenchidos, incluindo a **Justificativa**.
7. Clique em **Aprovar**.
8. Se houver mais de uma etapa/aprovador:
   - Faca logout do aprovador atual.
   - Faca login como o **proximo aprovador** ou usuario que pertence a fila/perfil indicado.
   - Acesse **Aprovações**.
   - Repita o processo de aprovacao ate finalizar todas as etapas.

Validacao negativa obrigatoria:

1. Antes ou depois da aprovacao, entre novamente como **Solicitante / Gestor requisitante**.
2. Acesse **Aprovações** e abra a mesma requisicao, se ela aparecer.
3. Confirme que o solicitante nao consegue aprovar, reprovar ou solicitar ajustes quando a etapa estiver atribuida a outro aprovador.

Resultado esperado:

- [ ] Status final da solicitacao fica **Aprovada**.
- [ ] A requisicao fica apta para efetivacao/reprocessamento RM.
- [ ] O historico mostra as aprovacoes realizadas.
- [ ] O solicitante nao ve botoes de aprovacao para etapa atribuida a outro usuario.

Validacao SQL:

```sql
SELECT
  "Id",
  "Titulo",
  "Status",
  "ApprovedAtUtc",
  "UpdatedAtUtc"
FROM "SolicitacoesVaga"
WHERE "Titulo" ILIKE '%INFRAESTRUTURA%'
ORDER BY "CreatedAtUtc" DESC
LIMIT 5;
```

Resultado esperado:

- `Status = 2` para **Aprovada**.

## UAT 4 - Efetivar ou reprocessar para entrar na fila RM

Objetivo: garantir que a requisicao aprovada receba `RmCriacaoSolicitadaEmUtc` e entre na fila do worker.

Usuario logado: **Administrador do Portal** ou usuario com permissao para efetivar/reprocessar integracao RM. Se essa acao ficar disponivel somente para RH no ambiente, use o usuario **RH / Headcount** responsavel.

Passo a passo:

1. Faca logout do aprovador anterior.
2. Faca login como **Administrador do Portal** ou usuario **RH / Headcount** responsavel pela efetivacao.
3. Na tela **Solicitações de Vaga**, localize a requisicao aprovada.
4. Abra as acoes da requisicao.
5. Procure uma acao relacionada a RM, por exemplo:
   - **Efetivar**
   - **Reprocessar RM**
   - **Enviar para RM**
   - **Voltar para fila RM**
6. Clique na acao disponivel.
7. Confirme a operacao, se o sistema pedir confirmacao.

Resultado esperado:

- [ ] A requisicao passa a ter solicitacao de criacao RM.
- [ ] Campo `RmCriacaoSolicitadaEmUtc` fica preenchido.
- [ ] `IntegracaoResultado` fica vazio enquanto aguarda o worker ou passa para falha/sucesso apos tentativa.
- [ ] `IntegracaoMensagem` indica fila ou resultado da tentativa.

Validacao SQL:

```sql
SELECT
  "Id",
  "Titulo",
  "TipoSolicitacao",
  "Status",
  "RmCriacaoSolicitadaEmUtc",
  "IntegracaoResultado",
  "IntegracaoMensagem",
  "TentativasIntegracao",
  "UltimaTentativaUtc",
  "RmRequisicaoCodigo",
  "RmCodColRequisicao",
  "RmIdReq"
FROM "SolicitacoesVaga"
WHERE "Titulo" ILIKE '%INFRAESTRUTURA%'
ORDER BY "CreatedAtUtc" DESC
LIMIT 5;
```

Resultado esperado antes do worker:

- `RmCriacaoSolicitadaEmUtc IS NOT NULL`
- `RmRequisicaoCodigo IS NULL`
- `TentativasIntegracao = 0`

## UAT 5 - Acompanhar fila no painel de integracao

Objetivo: verificar se a requisicao aparece na tela de integracao.

Usuario logado: **Administrador do Portal** ou usuario com acesso a **Administração > Integração TOTVS**.

Passo a passo:

1. Mantenha login como **Administrador do Portal** ou faca login com usuario equivalente.
2. No menu lateral, abra **Administração**.
3. Clique em **Integração TOTVS**.
4. Clique na aba **Requisições/Solicitações RM**.
5. Selecione o filtro **Todos**.
6. Procure pela requisicao criada.
7. Verifique as colunas:
   - **Solicitante**
   - **Solicitação**
   - **Status Portal**
   - **Vínculo RM**
   - **Tentativas**
   - **Última Tentativa**
   - **Resultado**
   - **Mensagem**

Resultado esperado:

- [ ] Antes do worker processar, item aparece como **Pendente**.
- [ ] A coluna **Tentativas** mostra `0` ou aumenta apos processamento.
- [ ] A coluna **Mensagem** mostra aguardando envio ou erro/sucesso.

## UAT 6 - Processamento pelo worker e sucesso RM

Objetivo: confirmar que o worker enviou a requisicao ao RM e gravou o vinculo.

Usuario logado: **Administrador do Portal** ou usuario com acesso a **Integração TOTVS** e **Dashboard Integração RM**. O worker roda no backend; nao depende de usuario logado.

Passo a passo:

1. Mantenha login como **Administrador do Portal** ou usuario equivalente.
2. Aguarde o intervalo do worker.
3. Atualize a tela **Integração TOTVS > Requisições/Solicitações RM**.
4. Verifique se o item mudou para **Sucesso**.
5. Verifique se a coluna **Vínculo RM** exibe codigo/identificador.
6. Acesse a tela **Dashboard Integração RM** em **Relatórios**.
7. Ajuste o periodo para incluir a data da requisicao.
8. Confira os KPIs.

Resultado esperado em caso de sucesso:

- [ ] `IntegracaoResultado = Sucesso`.
- [ ] `RmRequisicaoCodigo` preenchido.
- [ ] `RmCodColRequisicao` preenchido.
- [ ] `RmIdReq` preenchido.
- [ ] `IntegradaEmUtc` preenchido.
- [ ] Dashboard aumenta **Integrações concluídas**.

Validacao SQL:

```sql
SELECT
  "Id",
  "Titulo",
  "IntegracaoResultado",
  "IntegracaoMensagem",
  "TentativasIntegracao",
  "UltimaTentativaUtc",
  "IntegradaEmUtc",
  "RmRequisicaoCodigo",
  "RmCodColRequisicao",
  "RmIdReq",
  "RmCodStatus"
FROM "SolicitacoesVaga"
WHERE "Titulo" ILIKE '%INFRAESTRUTURA%'
ORDER BY "CreatedAtUtc" DESC
LIMIT 5;
```

Valores esperados:

- `IntegracaoResultado = 1` ou `Sucesso`.
- `TentativasIntegracao >= 1`.
- `RmRequisicaoCodigo` preenchido.

Validacao das tentativas:

```sql
SELECT
  t."TentativaEmUtc",
  s."Titulo",
  t."Sucesso",
  t."CodigoRmRetornado",
  t."CodigoTecnico",
  t."MensagemErro",
  t."PayloadResumo"
FROM "SolicitacaoVagaIntegracaoTentativas" t
JOIN "SolicitacoesVaga" s ON s."Id" = t."SolicitacaoVagaId"
WHERE s."Titulo" ILIKE '%INFRAESTRUTURA%'
ORDER BY t."TentativaEmUtc" DESC;
```

Resultado esperado:

- Existe pelo menos uma tentativa.
- `Sucesso = true`.
- `CodigoRmRetornado` preenchido ou `RmCodColRequisicao`/`RmIdReq` preenchidos na tabela principal.

## UAT 7 - Validar criacao dentro do RM

Objetivo: confirmar fora do Portal que a requisicao foi criada no RM.

Usuario logado: **Usuario RM** ou usuario administrativo com permissao de consulta no TOTVS RM.

Passo a passo:

1. No Portal, ainda como **Administrador do Portal**, copie o valor de:
   - `RmCodColRequisicao`
   - `RmIdReq`
   - ou `RmRequisicaoCodigo`
2. Faca login no RM como **Usuario RM** ou usuario administrativo de consulta.
3. Acesse o RM ou a tela administrativa de consulta RM.
4. Busque a requisicao pelo identificador retornado.
5. Confira os dados principais:
   - Função.
   - Seção.
   - Filial.
   - Quantidade de vagas.
   - Salário.
   - Justificativa.
   - Status inicial.

Resultado esperado:

- [ ] Requisicao existe no RM.
- [ ] Dados batem com a requisicao criada no Portal.
- [ ] Status inicial no RM corresponde ao retorno esperado.

## UAT 8 - Cenario de falha controlada

Objetivo: validar que o Portal registra erro quando o RM rejeita ou endpoint fica indisponivel.

Use este cenario apenas em ambiente de teste.

Usuario logado: **Administrador do Portal** para alterar endpoint e acompanhar integracao. Para criar/aprovar a nova requisicao de falha, use novamente **Solicitante / Gestor requisitante** e **Aprovador direto**.

Passo a passo:

1. Faca login como **Administrador do Portal**.
2. Acesse **Administração > Integração TOTVS > Requisições/Solicitações RM**.
3. Altere temporariamente o endpoint para uma URL invalida, por exemplo:

```text
http://172.19.30.37:8051/RMSRestDataServer/rest/EndpointInvalido
```

4. Salve a configuração.
5. Faca logout.
6. Faca login como **Solicitante / Gestor requisitante**.
7. Crie uma nova requisicao seguindo o UAT 2.
8. Faca logout.
9. Faca login como **Aprovador direto** e aprove a requisicao seguindo o UAT 3.
10. Se houver etapas adicionais, entre com cada **proximo aprovador** ate finalizar.
11. Faca logout.
12. Faca login como **Administrador do Portal** ou usuario **RH / Headcount**.
13. Envie/reprocesse para RM seguindo o UAT 4.
14. Aguarde o worker.
15. Volte ao painel de integracao.

Resultado esperado:

- [ ] Item aparece como **Falha**.
- [ ] `TentativasIntegracao >= 1`.
- [ ] `IntegracaoMensagem` contem HTTP, timeout ou mensagem de erro retornada pelo RM.
- [ ] Registro aparece em `SolicitacaoVagaIntegracaoTentativas`.
- [ ] Dashboard aumenta **Falhas na integração**.

Validacao SQL:

```sql
SELECT
  "Titulo",
  "IntegracaoResultado",
  "IntegracaoMensagem",
  "TentativasIntegracao",
  "UltimaTentativaUtc"
FROM "SolicitacoesVaga"
WHERE "Titulo" ILIKE '%INFRAESTRUTURA%'
ORDER BY "CreatedAtUtc" DESC
LIMIT 5;
```

Depois do teste:

1. Continue logado como **Administrador do Portal**.
2. Volte para **Integração TOTVS**.
3. Reconfigure o endpoint correto:

```text
http://172.19.30.37:8051/RMSRestDataServer/rest/RhuReqAumentoQuadroData
```

4. Salve.

## UAT 9 - Reprocessar apos falha

Objetivo: confirmar que uma requisicao com falha pode voltar para fila e ser reenviada.

Usuario logado: **Administrador do Portal** ou usuario com permissao para reprocessar integracao RM.

Passo a passo:

1. Faca login como **Administrador do Portal** ou usuario equivalente.
2. Garanta que o endpoint correto esta configurado.
3. Na tela **Integração TOTVS > Requisições/Solicitações RM**, localize o item com falha.
4. Use a acao de reprocessamento disponivel no Portal, por exemplo:
   - **Reenviar**
   - **Reprocessar**
   - **Voltar para fila**
5. Confirme a acao.
6. Aguarde o worker.
7. Atualize a tela.

Resultado esperado:

- [ ] O item volta para fila ou recebe nova tentativa.
- [ ] `TentativasIntegracao` aumenta.
- [ ] Se o RM aceitar, o resultado muda para **Sucesso**.
- [ ] O historico de tentativas preserva a falha anterior e registra a tentativa nova.

Validacao SQL:

```sql
SELECT
  t."TentativaEmUtc",
  t."Sucesso",
  t."CodigoTecnico",
  t."MensagemErro",
  t."CodigoRmRetornado"
FROM "SolicitacaoVagaIntegracaoTentativas" t
JOIN "SolicitacoesVaga" s ON s."Id" = t."SolicitacaoVagaId"
WHERE s."Titulo" ILIKE '%INFRAESTRUTURA%'
ORDER BY t."TentativaEmUtc" DESC;
```

## UAT 10 - Validar dashboard de integracao RM

Objetivo: conferir se o dashboard mostra corretamente a saude do fluxo.

Usuario logado: **Administrador do Portal** ou usuario com permissao **Relatórios > Dashboard Integração RM**.

Passo a passo:

1. Faca login como **Administrador do Portal** ou usuario de relatorios.
2. No menu lateral, abra **Relatórios**.
3. Clique em **Dashboard Integração RM**.
4. Selecione um periodo que inclua a requisicao criada.
5. Clique em atualizar, se houver botao.
6. Confira os cards:
   - **Solicitações criadas**
   - **Vagas vinculadas**
   - **Integrações concluídas**
   - **Falhas na integração**
   - **Aprovadas não enfileiradas**
   - **Enfileiradas sem tentativa**
   - **Tempo médio total**

Resultado esperado:

- [ ] Requisicoes criadas aparecem no total.
- [ ] Se a requisicao foi aprovada mas ainda nao foi enviada para RM, aparece em **Aprovadas não enfileiradas**.
- [ ] Se ja tem `RmCriacaoSolicitadaEmUtc` mas `TentativasIntegracao = 0`, aparece em **Enfileiradas sem tentativa**.
- [ ] Se o RM retornou sucesso, aparece em **Integrações concluídas**.
- [ ] Se houve erro, aparece em **Falhas na integração**.

## Checklist final de aceite

Marque como aprovado somente se:

- [ ] Endpoint RM foi salvo sem erro.
- [ ] Requisicao `Vaga nova` foi criada com dados validos.
- [ ] Criacao foi feita com o **Solicitante / Gestor requisitante**.
- [ ] Requisicao passou pela aprovacao.
- [ ] Cada etapa de aprovacao foi executada pelo aprovador/fila correto.
- [ ] Solicitante nao conseguiu aprovar etapa atribuida a outro usuario.
- [ ] Requisicao entrou na fila RM.
- [ ] Worker realizou pelo menos uma tentativa.
- [ ] Portal registrou sucesso ou falha de forma rastreavel.
- [ ] Tabela `SolicitacaoVagaIntegracaoTentativas` possui historico da tentativa.
- [ ] Dashboard reflete os numeros corretamente.
- [ ] RM contem a requisicao criada quando o resultado for sucesso.

## Evidencias recomendadas

Anexe ao UAT:

- Print da configuracao do endpoint salva.
- Print da requisicao criada mostrando o usuario solicitante logado.
- Print da aba **Aprovação** mostrando o aprovador/fila da etapa.
- Print da aprovacao mostrando o usuario aprovador logado.
- Print da validacao negativa em que o solicitante nao ve botoes de aprovacao, se aplicavel.
- Print da aba **Requisições/Solicitações RM**.
- Print do **Dashboard Integração RM**.
- Resultado SQL da requisicao em `SolicitacoesVaga`.
- Resultado SQL das tentativas em `SolicitacaoVagaIntegracaoTentativas`.
- Print ou consulta no RM comprovando a requisicao criada.

## Observacoes importantes

- Requisicoes antigas que ja estavam **Aprovadas** e com `RmCriacaoSolicitadaEmUtc = NULL` nao entram automaticamente na fila apenas com o deploy. Elas precisam ser reprocessadas/efetivadas pelo fluxo do Portal.
- Se a tela ficar zerada, confira o periodo selecionado no dashboard.
- Se nao houver tentativa, o problema esta antes do envio ao RM: fila nao preenchida ou worker nao processando.
- Se houver tentativa com erro, o problema esta no endpoint, credenciais, payload ou regra de negocio do RM.
- Se houver sucesso no Portal e nao aparecer no RM, validar retorno do endpoint e identificadores `RmCodColRequisicao` e `RmIdReq`.
