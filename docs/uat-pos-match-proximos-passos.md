# UAT - Pos-match do candidato e proximos passos do processo seletivo

## Objetivo

Validar o fluxo operacional depois que a vaga ja foi publicada no portal, o candidato ja se candidatou, enviou o CV e a Analista de RH ja calculou o match do candidato.

O ponto central deste UAT e confirmar que o RH consegue transformar o resultado do match em uma decisao pratica no funil:

```text
Aplicada -> Em triagem -> Entrevista -> Teste -> Proposta -> Contratado
```

Tambem devem ser validados os caminhos alternativos:

```text
Recusado
Desistiu
```

## Cenario inicial ja validado

Antes de iniciar este UAT, considere que os passos abaixo ja aconteceram:

- [ ] Gestor requisitou a vaga.
- [ ] Gestor do requisitante aprovou a requisicao.
- [ ] Especialista de RH visualizou a requisicao e distribuiu para uma Analista de RH.
- [ ] A requisicao virou vaga.
- [ ] A Analista de RH editou a vaga com os dados minimos necessarios para publicacao.
- [ ] A Analista de RH salvou a vaga com status **Aberta**.
- [ ] A vaga apareceu no Portal de Vagas.
- [ ] Candidato visualizou a vaga no portal.
- [ ] Candidato se candidatou.
- [ ] Candidato enviou o CV.
- [ ] Analista de RH visualizou o candidato na vaga.
- [ ] Analista de RH calculou o match do candidato.

## Proximo passo esperado

Depois do match calculado, a Analista de RH nao deve ir direto para admissao.

O proximo passo correto e tomar uma decisao de triagem:

- [ ] seguir com o candidato para triagem/entrevista;
- [ ] manter o candidato em analise;
- [ ] recusar o candidato;
- [ ] registrar desistência, se o candidato nao quiser continuar.

## Fluxo UAT principal - candidato segue no processo

### UAT 1 - Revisar resultado do match

**Dado que** existe uma vaga aberta com candidato aplicado e CV enviado  
**E** o match do candidato ja foi calculado  
**Quando** a Analista de RH abrir a vaga no hub  
**Entao** ela deve conseguir visualizar o candidato vinculado a vaga  
**E** deve conseguir consultar o score de match calculado  
**E** deve conseguir abrir os detalhes/compatibilidade do candidato.

Checklist:

- [ ] Candidato aparece na vaga correta.
- [ ] Candidato aparece com status inicial **Novo** ou **Aplicada**, conforme nomenclatura atual da tela.
- [ ] Antes do calculo, a row exibe a acao **Calcular match**.
- [ ] Depois do calculo, a row exibe o score de compatibilidade, por exemplo **58%**.
- [ ] A acao **Compatibilidade XX%** abre o resumo/detalhamento do match.
- [ ] A acao **Analise IA** abre o modal de IA e permite gerar/visualizar a analise.
- [ ] Match minimo da vaga fica claro para comparacao na aba **Candidatos & Match**.
- [ ] Dados do CV/documentos ficam disponiveis para leitura ou download.
- [ ] Existe acao **Baixar CV** na row do candidato quando ha curriculo enviado.
- [ ] Analise de compatibilidade ou IA fica disponivel depois do calculo.

Resultado esperado:

```text
Analista entende se o candidato esta acima, abaixo ou proximo do minimo esperado.
```

Observacao validada em UAT:

```text
Na tela atual, o candidato pode aparecer como "Novo". Para este fluxo, "Novo" representa a entrada inicial da candidatura antes da triagem operacional.
```

### UAT 2 - Registrar decisao de triagem

**Dado que** a Analista de RH revisou o score e o CV  
**Quando** ela decidir seguir com o candidato  
**Entao** deve mover ou registrar o candidato como **Em triagem**.

Acao esperada:

```text
Recrutamento -> Kanban de Candidaturas
Filtrar pela vaga
Mover candidato de Aplicada para Em triagem
```

Checklist:

- [ ] Kanban exibe a candidatura da vaga.
- [ ] Filtro por vaga funciona.
- [ ] Card do candidato aparece na coluna **Aplicada**.
- [ ] Analista consegue mover o card para **Em triagem**.
- [ ] Sistema salva a nova etapa/status.
- [ ] Card permanece na nova coluna apos atualizar a tela.
- [ ] Historico/observacao da movimentacao fica registrado, se a tela pedir.

Observacao sugerida:

```text
Candidato com aderencia inicial apos analise de CV e match. Seguir para triagem RH.
```

### UAT 3 - Avancar para entrevista RH

**Dado que** o candidato esta em **Em triagem**  
**E** a Analista validou dados basicos, disponibilidade e interesse  
**Quando** a Analista decidir entrevistar o candidato  
**Entao** deve mover a candidatura para **Entrevista**.

Checklist:

- [ ] E-mail do candidato esta preenchido.
- [ ] Celular/telefone esta preenchido.
- [ ] CV foi revisado.
- [ ] Pretensao salarial/disponibilidade foram avaliadas, se aplicavel.
- [ ] Candidato foi movido para **Entrevista**.
- [ ] Observacao da triagem foi registrada.

Observacao sugerida:

```text
Triagem RH concluida. Candidato demonstra aderencia para entrevista inicial.
```

### UAT 4 - Comunicar candidato

**Dado que** o candidato foi selecionado para entrevista  
**Quando** a Analista abrir os detalhes do candidato ou a acao de comunicacao  
**Entao** deve conseguir enviar uma mensagem ao candidato.

Checklist:

- [ ] Analista consegue abrir o detalhe do candidato.
- [ ] Analista consegue visualizar e-mail e telefone.
- [ ] Analista consegue enviar e-mail/mensagem, se a funcionalidade estiver habilitada.
- [ ] Assunto e corpo da mensagem podem ser preenchidos.
- [ ] Anexos podem ser adicionados, se necessario.
- [ ] Sistema registra que a comunicacao foi enviada.

Mensagem exemplo:

```text
Ola, [Nome].

Analisamos sua candidatura para a vaga [Titulo da vaga] e gostaríamos de seguir para uma conversa inicial.
Podemos agendar uma entrevista?
```

## Fluxos seguintes

### UAT 5 - Entrevista aprovada

**Dado que** a entrevista RH foi realizada  
**Quando** o candidato for aprovado para a proxima etapa  
**Entao** a candidatura deve avancar para a etapa adequada.

Possiveis proximas etapas:

- [ ] **Teste**, quando houver avaliacao tecnica/pratica.
- [ ] **Entrevista tecnica**, se o processo usar uma etapa separada.
- [ ] **Proposta**, se a vaga nao exigir teste nem nova entrevista.

Resultado esperado:

```text
Candidato avanca no funil sem perder o vinculo com a vaga e mantendo historico da decisao.
```

### UAT 6 - Candidato reprovado na triagem ou entrevista

**Dado que** a Analista concluiu que o candidato nao deve seguir  
**Quando** ela mover ou registrar a candidatura como **Recusado**  
**Entao** o candidato deve sair do fluxo ativo da vaga.

Checklist:

- [ ] Card pode ser movido para **Recusado**.
- [ ] Sistema permite informar motivo/observacao.
- [ ] Candidato nao aparece mais como pendente em etapas ativas.
- [ ] Vaga continua aberta para outros candidatos.

Observacoes sugeridas:

```text
Nao atende requisito obrigatorio da vaga.
```

```text
Experiencia abaixo do minimo esperado para a senioridade.
```

### UAT 7 - Candidato desistiu

**Dado que** o candidato informou que nao deseja continuar  
**Quando** a Analista mover a candidatura para **Desistiu**  
**Entao** o sistema deve encerrar a participacao daquele candidato nessa vaga.

Checklist:

- [ ] Card pode ser movido para **Desistiu**.
- [ ] Motivo/observacao pode ser registrado.
- [ ] Vaga continua aberta para demais candidatos.

Observacao sugerida:

```text
Candidato informou indisponibilidade/interesse encerrado no processo.
```

## Fluxo de proposta

### UAT 8 - Criar proposta para candidato aprovado

**Dado que** o candidato passou pelas etapas de selecao  
**E** o gestor/RH aprovou a continuidade  
**Quando** a Analista mover o candidato para **Proposta**  
**Entao** deve ser possivel criar ou preparar uma proposta para o candidato.

Checklist:

- [ ] Candidato esta na etapa **Proposta**.
- [ ] Dados salariais da vaga foram revisados.
- [ ] Beneficios foram revisados.
- [ ] Data prevista de inicio foi definida.
- [ ] Proposta pode ser criada como rascunho.
- [ ] Proposta pode ser enviada ou disponibilizada por link, se a funcionalidade estiver habilitada.

Resultado esperado:

```text
Candidato aprovado recebe proposta formal ou segue para formalizacao manual controlada pelo RH.
```

### UAT 9 - Proposta aceita

**Dado que** a proposta foi aceita  
**Quando** a Analista registrar o aceite  
**Entao** o candidato deve avancar para **Contratado** ou para o fluxo de pre-admissao.

Checklist:

- [ ] Candidatura pode ser movida para **Contratado**.
- [ ] Pre-admissao pode ser iniciada, quando aplicavel.
- [ ] Vaga atualiza ocupacao/headcount conforme regra do produto.
- [ ] Historico da vaga/candidato mostra a evolucao.

## Fluxo de pre-admissao

### UAT 10 - Iniciar pre-admissao

**Dado que** o candidato foi aprovado e aceitou a proposta  
**Quando** a Analista acionar a aprovacao final/pre-admissao  
**Entao** o sistema deve criar ou iniciar o processo admissional.

Checklist:

- [ ] Candidato possui e-mail valido.
- [ ] Candidato possui telefone/celular valido.
- [ ] CPF foi informado, se exigido.
- [ ] Tipo de contratacao esta correto.
- [ ] Sistema cria pre-admissao ou abre tela para completar os dados.
- [ ] Link ou orientacao pode ser enviado ao candidato.

Resultado esperado:

```text
O processo deixa de ser apenas recrutamento e passa para admissao/pre-admissao.
```

## Criterios de aceite do UAT

O UAT deve ser considerado aprovado quando:

- [ ] A Analista consegue encontrar o candidato aplicado na vaga.
- [ ] O match calculado fica visivel e interpretavel.
- [ ] A Analista consegue mover o candidato de **Aplicada** para **Em triagem**.
- [ ] A Analista consegue mover o candidato para **Entrevista**.
- [ ] O sistema preserva historico/observacao das movimentacoes, quando aplicavel.
- [ ] A Analista consegue recusar ou marcar desistencia.
- [ ] O candidato aprovado consegue chegar ate **Proposta**.
- [ ] O candidato com proposta aceita consegue chegar a **Contratado** ou **Pre-admissao**.
- [ ] A vaga permanece aberta para outros candidatos enquanto ainda houver headcount disponivel.

## Pontos de atencao para o PO

- O match nao deve aprovar candidato automaticamente.
- O match serve como apoio para triagem e justificativa da decisao.
- O proximo passo apos match e movimentar a candidatura no funil.
- A aprovacao final/pre-admissao nao deve acontecer antes de triagem, entrevista e proposta, salvo excecao operacional definida pelo RH.
- Se a tela de **Candidatos & Match** nao permitir avancar etapa diretamente, o caminho operacional deve ser pelo **Kanban de Candidaturas**.

## Resumo pratico

Se o RH esta travado apos calcular o match, o proximo passo e:

```text
1. Revisar CV + score + compatibilidade.
2. Decidir se segue ou nao.
3. Ir ao Kanban de Candidaturas.
4. Filtrar pela vaga.
5. Mover o candidato de Aplicada para Em triagem ou Entrevista.
6. Registrar observacao.
7. Seguir com entrevista/teste/proposta.
8. Somente depois iniciar contratacao/pre-admissao.
```
