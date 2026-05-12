# Solicitacao de vaga -> vaga -> fluxo da Analista de RH

Documento de referencia para responder como o Portal transforma uma `SolicitacaoVaga` aprovada em uma `Vaga` utilizavel pelo RH, o que ja entra preenchido e o que ainda depende de acao manual da Analista de RH.

## 1. Resumo executivo

Hoje o produto trabalha em duas camadas:

1. Quando a solicitacao e aprovada, o backend cria automaticamente uma `Vaga` em `Rascunho`.
2. Ao abrir essa vaga rascunho, a Analista de RH encontra parte dos dados herdados da solicitacao e completa o restante antes de publicar a vaga.

Com os ajustes atuais, os prefills de baixo risco passam a acontecer em dois pontos:

- na criacao automatica da vaga minima;
- no prefill da tela de vagas quando a origem e uma solicitacao (`newFromSolicitacao`);
- com fallback seguro na leitura da vaga para rascunhos antigos, quando o campo ainda esta vazio.

## 2. Matriz de mapeamento

| Campo da solicitacao | Campo/aba da vaga | Status | Regra atual |
|---|---|---|---|
| `Titulo` | `titulo` (`Dados`) | ja mapeado | Vaga minima nasce com o mesmo titulo. |
| `JobPositionId` + `JobPositionName` | `cargoId` + `cargoName` (`Dados`) | ja mapeado | Vai para a vaga minima e tambem para o prefill via deep link. |
| `CodFuncaoRm` + `FuncaoNomeRm` | `codFuncaoRm` + `funcaoNomeRm` (`Dados`) | ja mapeado | Mantem rastreabilidade com a funcao do RM. |
| `QtdPosicoes` | `quantidadeVagas` (`Dados`) | ja mapeado | Copiado na criacao da vaga. |
| `Justificativa` | `descricaoInterna` (`Dados`) | ja mapeado | Entra como contexto inicial para o RH. |
| `Urgencia` | `prioridade` + `urgente` (`Dados`) | ja mapeado | Critica/Alta/Media/Baixa sao convertidas para a prioridade da vaga. |
| `IsConfidencial` | `confidencial` (`Dados`) | ja mapeado | Persistido na vaga minima. |
| `TipoContrato` | `tipoContratacao` (`Dados`) | ja mapeado | CLT/Estagio/Aprendiz/Temporario sao convertidos para o enum de vaga. |
| `SolicitanteId` + `SolicitanteNome` | `gestorRequisitanteFuncionarioId` + `gestorRequisitante` (`Dados`) | ja mapeado | Fica registrado quem originou a demanda. |
| `AnalistaRhResponsavelUserId` + `AnalistaRhResponsavelNome` | `recrutadorResponsavelUserId` + `recrutadorResponsavel` (`Dados`) | ja mapeado | Se a solicitacao ja estiver distribuida, a vaga nasce atribuida para a Analista de RH. |
| `CentroCustoId` + `CentroCustoNome` | `centroCustoId` + `centroCustoDescription` (`Dados`) | ja mapeado | Herdado da solicitacao. |
| `UnidadeLotacaoId` + `UnidadeLotacaoNome` | `unidadeLotacaoId` + `unidadeLotacaoDescription` (`Dados`) | ja mapeado | Herdado da solicitacao. |
| `TurnoId` + `TurnoCode` + `TurnoDescription` | `turnoId` + `turnoCode` + `turnoDescription` (`Local/Jornada`) | ja mapeado | Mantem o turno oficial da requisicao. |
| `EscalaTrabalho` | `escalaTrabalhoRaw` (`Local/Jornada`) | ja mapeado | Usado como fallback textual quando a vaga ainda nao tem escala detalhada. |
| `CnhObrigatoria` | `exigeCnh` (`Publicacao/Compliance`) | ja mapeado | Sinaliza exigencia documental basica. |
| `DisponibilidadeViagens` | `disponibilidadeViagens` (`Publicacao/Compliance`) | ja mapeado | Copiado da solicitacao. |
| `FaixaSalarialMin` + `FaixaSalarialMax` | `salarioMinimo` + `salarioMaximo` (`Remuneracao`) | ja mapeado | Passa a ser persistido na vaga minima e usado como fallback para rascunhos antigos. |
| `MotivoRequisicaoId` / `MotivoRequisicao` | `motivoAbertura` (`Dados`) | mapear | Falta definir tabela/crosswalk entre motivo da solicitacao e motivo da vaga. |
| `PrazoDias` | `projetoPrazo` ou campo dedicado | mapear | Reaproveitavel para vagas temporarias/estagio, mas depende de regra de negocio/UX. |
| `RequisitosDetalhadosJson` | `requisitos`, `tagsStack`, `diferenciais`, possivelmente `matchingHabilidades` | mapear | Precisa parser por schema versionado; nao e seguro espalhar esse JSON automaticamente sem normalizacao. |
| `TipoSolicitacao`, `SubstituidoNome`, `MotivoDesligamentoTexto`, `DataDesligamento` | `observacoesProcesso` ou bloco especifico do fluxo | mapear | Dados muito uteis para substituicao, mas ainda sem destino estruturado na vaga. |
| `EmpresaId` + `EmpresaNome` | sem campo direto no formulario atual | manual do RH | Informacao de contexto; hoje nao possui correspondencia explicita na vaga. |
| `UnitId` + `UnitName` | sem campo direto no formulario atual | manual do RH | Nao confundir `Unit` da solicitacao com `UnidadeLotacao` da vaga. |
| `DecisaoRH`, `DecisaoRHPrazoMeses`, `DecisaoRHPrazoDataAlvo` | acompanhamento/headcount, nao preenchimento da vaga | manual do RH | Serve para governanca do headcount, nao como campo operacional da vaga. |
| `ObservacaoAprovador` | contexto de analise | manual do RH | Pode orientar o preenchimento, mas nao deve sobrescrever campos da vaga automaticamente. |

## 3. O que a Analista de RH ainda precisa preencher manualmente

Mesmo com os prefills, a solicitacao entrega so o "esqueleto" da vaga. A Analista de RH ainda precisa revisar e complementar, em especial:

- `modalidade`, `senioridade`, `resumoPitch`, `codigoInterno`, `codigoCbo`, `nomeEngessado`;
- informacoes de diversidade e posicionamento da vaga (`aceitaPcd`, afirmativa, linguagem inclusiva, publico alvo);
- endereco detalhado, politica de trabalho, jornada detalhada e observacoes de deslocamento;
- beneficios, bonus, observacoes de remuneracao e eventual faixa final ajustada;
- escolaridade, formacao, experiencia, idiomas, stack, diferenciais e requisitos estruturados;
- filtros de matching IA;
- etapas do processo seletivo e perguntas de triagem;
- configuracoes de publicacao, descricao publica e politicas LGPD.

## 4. Regras para a vaga sair de rascunho

### 4.1 Para salvar a edicao no formulario

O formulario exige pelo menos:

- `titulo`;
- `status`;
- `cargo`.

### 4.2 Para publicar / abrir a vaga no front

Ao tentar salvar com status `Aberta`, o front exige:

- `tipoContratacao`;
- `modalidade`;
- `quantidadeVagas >= 1`.

### 4.3 Para mudar o status para `Aberta` no backend

O backend ainda valida:

- `HeadcountPendente == 0`;
- `titulo` preenchido;
- `quantidadeVagas >= 1`.

Quando a vaga e aberta, o sistema tambem:

- define `DataAbertura` se ainda estiver vazia;
- garante a rodada ativa do projeto;
- cria o workflow operacional de triagem quando necessario.

## 5. Fluxo operacional esperado

1. Gestor cria a solicitacao de vaga.
2. Workflow de aprovacao e concluido.
3. O sistema cria automaticamente uma `Vaga` em `Rascunho` e vincula `SolicitacaoVaga.VagaId`.
4. Um `Especialista de RH` pode distribuir a solicitacao para uma `Analista de RH`.
5. A `Analista de RH` encontra a demanda em `/app/gestao/aprovacoes` e a vaga em `/app/vagas`.
6. Ao abrir a vaga, os campos herdados da solicitacao ja aparecem preenchidos.
7. A `Analista de RH` completa os campos operacionais e publica a vaga.
8. A partir da publicacao, o funil de recrutamento e selecao segue pela vaga e seus workflows.

## 6. Leitura pratica para perguntas futuras

Se alguem perguntar "o que vem da solicitacao para a vaga?", a resposta curta correta passa a ser:

- o Portal cria automaticamente a vaga minima quando a solicitacao e aprovada;
- titulo, cargo, funcao RM, quantidade, justificativa, prioridade, contrato, centro de custo, unidade de lotacao, turno, escala, recrutador responsavel, gestor requisitante, CNH, viagens e faixa salarial ja podem chegar preenchidos;
- o RH ainda precisa completar os dados de divulgacao, requisitos, matching, etapas, publicacao e compliance para transformar o rascunho em vaga operacional.
