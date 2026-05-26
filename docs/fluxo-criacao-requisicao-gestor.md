# Fluxo - Criacao de requisicao pelo gestor

## Objetivo da apresentacao

Demonstrar o fluxo ponta a ponta em que o gestor cria uma requisicao de vaga no Portal RH, o sistema encaminha para triagem/aprovacao, registra a fila de integracao RM e permite acompanhamento ate a criacao da requisicao no TOTVS RM.

## Mensagem principal

O Portal RH centraliza a abertura da requisicao, padroniza os dados obrigatorios, controla aprovacoes e cria uma trilha rastreavel para integracao com o RM.

## Atores envolvidos

- **Gestor solicitante**: cria a requisicao e informa a necessidade de headcount.
- **RH / Triagem**: valida dados, devolve ajustes quando necessario e encaminha para aprovacao.
- **Aprovadores**: aprovam conforme o fluxo configurado.
- **Worker de integracao RM**: processa a fila e cria a requisicao no RM.
- **Administrador**: acompanha configuracoes, falhas e status da integracao.

## Fluxo resumido

```text
Gestor cria requisicao
-> Sistema salva como rascunho
-> Sistema submete automaticamente
-> Aumento de quadro vai para triagem RH
-> RH revisa e encaminha para aprovacoes
-> Aprovadores concluem o fluxo
-> Sistema marca requisicao como aprovada
-> Sistema enfileira criacao RM
-> Worker cria requisicao no RM
-> Portal grava vinculo RM, tentativas e resultado
-> RH acompanha requisicao ate processo seletivo
```

## Slide 1 - Contexto do processo

**Titulo sugerido:** Criacao de requisicao pelo gestor

**Mensagem:**
O gestor inicia a necessidade de contratacao no Portal RH, informando dados estruturados da vaga, justificativa, headcount, turno, faixa salarial e motivo da requisicao.

**Pontos para destacar:**
- A requisicao nasce no Portal RH.
- O processo evita abertura informal por e-mail ou planilha.
- Todos os dados ficam auditaveis desde a origem.

## Slide 2 - Criacao da requisicao

**Ator:** Gestor solicitante

**Acao no sistema:**
O gestor acessa a tela de solicitacoes, preenche os dados da requisicao e salva.

**Dados principais informados:**
- Titulo da vaga.
- Tipo da solicitacao.
- Cargo / funcao RM.
- Unidade / filial.
- Centro de custo.
- Motivo da requisicao.
- Quantidade de posicoes.
- Tipo de contrato.
- Turno ou escala.
- Faixa salarial.
- Justificativa.
- Decisao de headcount.

**Estado tecnico:**
Ao criar, o sistema grava a solicitacao em `SolicitacoesVaga` com status inicial **Rascunho**.

## Slide 3 - Submissao automatica

**Mensagem:**
Apos criar a solicitacao, o proprio sistema submete o registro automaticamente para o fluxo correto.

**Comportamento esperado:**
- A solicitacao nao fica parada em rascunho.
- O sistema valida dados obrigatorios.
- O status muda conforme o tipo de requisicao.

**Regras principais:**
- Se for **Aumento de Quadro**, segue para **Pendente Triagem**.
- Se for outro tipo de fluxo, segue para **Pendente Aprovacao**.
- Se houver motivo de desligamento, o sistema pode criar uma solicitacao de desligamento vinculada.

## Slide 4 - Triagem RH para aumento de quadro

**Ator:** RH / Triagem

**Mensagem:**
No fluxo de aumento de quadro, o RH atua antes da cadeia de aprovacao para revisar consistencia, dados de headcount e aderencia da requisicao.

**Possiveis acoes do RH:**
- Iniciar triagem.
- Devolver ao gestor com observacao.
- Encaminhar para aprovacoes.
- Reprovar quando a solicitacao nao procede.

**Estados envolvidos:**
- **PendenteTriagem**
- **EmTriagem**
- **DevolvidaTriagemGestor**
- **PendenteAprovacao**

## Slide 5 - Aprovacoes

**Mensagem:**
Depois da triagem, o sistema usa o workflow configurado para definir quem aprova e em qual ordem.

**O que o workflow pode conter:**
- Gestor direto.
- Gestor do gestor.
- Responsavel de unidade.
- Fila de perfil.
- Funcionario fixo.
- Revisao RH.
- Etapas automaticas de processo.

**Resultado esperado:**
Quando todas as etapas sao concluidas, a solicitacao chega ao status **Aprovada**.

## Slide 6 - Criacao de vaga vinculada

**Mensagem:**
Durante o fluxo, o Portal RH pode materializar uma vaga vinculada a requisicao para permitir acompanhamento posterior no recrutamento.

**Quando acontece:**
- Em etapas automaticas configuradas como **Criar Vaga Rascunho**.
- Em aprovacoes que exigem preparar a vaga antes do processo seletivo.
- Em fluxos de substituicao ou decisao de headcount.

**Resultado:**
A solicitacao passa a ter `VagaId`, permitindo conectar requisicao, vaga, candidatos e funil.

## Slide 7 - Enfileiramento para integracao RM

**Mensagem:**
Para requisicoes de **Aumento de Quadro**, o Portal RH registra que a criacao no RM deve ser processada pelo worker.

**Campos de controle:**
- `RmCriacaoSolicitadaEmUtc`: indica que a criacao RM foi solicitada.
- `IntegracaoResultado`: resultado atual da integracao.
- `IntegracaoMensagem`: mensagem de status ou erro.
- `TentativasIntegracao`: quantidade de tentativas realizadas.
- `UltimaTentativaUtc`: data da ultima tentativa.

**Estado visual esperado:**
Na tela de integracao, o item aparece como **Na fila** enquanto ainda nao houve sucesso ou falha definitiva.

## Slide 8 - Processamento pelo worker RM

**Ator:** Worker de integracao

**Mensagem:**
O worker executa em segundo plano, por tenant, procurando requisicoes pendentes de criacao no RM.

**Criterios para entrar na fila do worker:**
- Tipo da solicitacao: **Aumento de Quadro**.
- `RmCriacaoSolicitadaEmUtc` preenchido.
- Sem `RmRequisicaoCodigo`.
- Nao reprovada.
- Nao cancelada.
- Sem falha definitiva.

**Resultado possivel:**
- Sucesso: cria ou confirma requisicao no RM.
- Falha: registra erro e permite nova tentativa.
- Falha definitiva: encerra retries apos limite configurado.

## Slide 9 - Criacao da requisicao no RM

**Mensagem:**
Quando o worker processa a fila, ele monta o payload da requisicao e envia ao RM.

**Validacoes antes do envio:**
- Cargo definido.
- Unidade / filial definida.
- Motivo parametrizado.
- Quantidade maior que zero.
- Titulo preenchido.
- Faixa salarial minima e maxima informadas.
- Faixa salarial valida.

**Modos de integracao:**
- **stub**: simula criacao em ambiente de desenvolvimento.
- **rest**: chama endpoint REST do RM.
- **disabled**: integracao desabilitada, retorna falha explicita.

## Slide 10 - Retorno e vinculo RM

**Mensagem:**
Ao receber sucesso do RM, o Portal RH grava o vinculo da requisicao para permitir rastreabilidade.

**Campos gravados no Portal RH:**
- `RmRequisicaoCodigo`
- `RmCodColRequisicao`
- `RmIdReq`
- `RmCodStatus`
- `RmUltimaSincronizacaoUtc`
- `IntegracaoResultado = Sucesso`
- `IntegracaoMensagem = Requisicao criada no RM`
- `IntegradaEmUtc`

**Beneficio:**
O time consegue saber qual requisicao do portal corresponde a qual requisicao no RM.

## Slide 11 - Acompanhamento no Portal RH

**Tela principal de acompanhamento da fila:**

```text
/app/integracao-totvs
Aba: Requisicoes/Solicitacoes RM
```

**O que a tela mostra:**
- Solicitante.
- Solicitacao.
- Status no Portal.
- Vinculo RM.
- Tentativas.
- Ultima tentativa.
- Resultado.
- Mensagem.

**Situacoes comuns:**
- **Na fila**: aguardando worker.
- **Sucesso**: criada no RM.
- **Falha**: aguardando retry.
- **Falha definitiva**: exige acao manual.

## Slide 12 - Conferencia no RM

**Tela administrativa de consulta ao RM:**

```text
/app/admin/requisicoes-rm
```

**Uso da tela:**
Consultar a lista consolidada do CORPORERM para confirmar se a requisicao existe no RM.

**Diferenca importante:**
- `Integracao TOTVS > Requisicoes/Solicitacoes RM`: mostra a fila e o status local do Portal RH.
- `Admin > Requisicoes RM`: mostra o que ja esta no RM.

## Slide 13 - Pontos de controle e auditoria

**Trilhas registradas:**
- Historico de status da solicitacao.
- Etapas de aprovacao.
- Tentativas de integracao RM.
- Mensagem tecnica de erro ou sucesso.
- Codigo retornado pelo RM.

**Tabela de tentativas:**

```text
SolicitacoesVagaIntegracaoTentativas
```

**Tabela principal da requisicao:**

```text
SolicitacoesVaga
```

## Slide 14 - Fluxo visual para apresentacao

```text
[Gestor]
  Cria requisicao
     |
     v
[Portal RH]
  Salva rascunho e submete automaticamente
     |
     v
[Triagem RH]
  Revisa aumento de quadro
     |
     v
[Workflow de aprovacao]
  Aprovadores validam a requisicao
     |
     v
[Portal RH]
  Requisicao aprovada e enfileirada para RM
     |
     v
[Worker RM]
  Processa fila e envia payload
     |
     v
[TOTVS RM]
  Cria requisicao
     |
     v
[Portal RH]
  Grava vinculo, resultado e tentativas
```

## Slide 15 - Mensagem final

**Mensagem sugerida:**
Com esse fluxo, a empresa ganha padronizacao na abertura de requisicoes, governanca de aprovacao, rastreabilidade de integracao e visibilidade operacional entre Portal RH e TOTVS RM.

**Beneficios para destacar:**
- Menos retrabalho manual.
- Menos risco de requisicoes sem dados obrigatorios.
- Aprovacoes rastreaveis.
- Integracao RM com tentativa, erro e sucesso auditaveis.
- Visibilidade para RH e administradores.

## Consulta SQL de apoio

Para demonstrar a fila local do worker:

```sql
SELECT
  s."Id",
  s."Titulo",
  s."TipoSolicitacao",
  s."Status" AS "StatusPortal",
  s."RmCriacaoSolicitadaEmUtc",
  s."RmRequisicaoCodigo",
  s."RmCodColRequisicao",
  s."RmIdReq",
  s."RmCodStatus",
  s."IntegracaoResultado",
  s."IntegracaoMensagem",
  s."TentativasIntegracao",
  s."UltimaTentativaUtc",
  s."IntegradaEmUtc",
  s."CreatedAtUtc",
  s."UpdatedAtUtc"
FROM "SolicitacoesVaga" s
WHERE s."RmCriacaoSolicitadaEmUtc" IS NOT NULL
ORDER BY
  s."RmCriacaoSolicitadaEmUtc" DESC NULLS LAST,
  s."CreatedAtUtc" DESC;
```

Para demonstrar tentativas:

```sql
SELECT
  t."Id",
  t."SolicitacaoVagaId",
  s."Titulo",
  t."TentativaEmUtc",
  t."Sucesso",
  t."CodigoRmRetornado",
  t."CodigoTecnico",
  t."MensagemErro",
  t."PayloadResumo"
FROM "SolicitacoesVagaIntegracaoTentativas" t
JOIN "SolicitacoesVaga" s ON s."Id" = t."SolicitacaoVagaId"
ORDER BY t."TentativaEmUtc" DESC
LIMIT 100;
```

