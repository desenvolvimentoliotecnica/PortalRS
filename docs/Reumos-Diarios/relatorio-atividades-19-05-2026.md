# Relatório de Atividades - 19/05/2026

## Visão geral do dia

O trabalho de hoje foi concentrado em melhorar o fluxo operacional do recrutamento depois que o candidato já está vinculado a uma vaga. O principal avanço foi criar um caminho para o RH solicitar que o candidato complete informações pendentes diretamente pelo sistema, sem depender de contato manual fora do portal.

Também foram organizados documentos de apoio para uso do time, incluindo um roteiro detalhado do processo de RH após o match entre candidato e vaga e uma diretriz para manter o padrão dos próximos resumos diários.

## Solicitação de atualização de dados pelo RH

Foi criado um novo fluxo para quando o analista de RH identifica que o candidato tem dados importantes faltando, como e-mail, celular ou telefone.

Antes, se esses dados estivessem incompletos, o RH precisava resolver isso por fora ou ficava sem um caminho claro dentro do sistema. Agora o analista pode usar a própria tela de candidatos da vaga para acionar o candidato e pedir a atualização.

Na prática, dentro da aba **Candidatos & Match**, o RH passa a ter a opção **Avisar candidato** quando o sistema identifica pendências visíveis de contato. Ao clicar, o analista vê uma confirmação com os itens pendentes e envia uma solicitação para o portal do candidato.

## Mensagens do RH no portal do candidato

Do lado do candidato, a seção **Notificações** foi evoluída para também exibir uma área de **Mensagens do RH**.

Essa área funciona como uma caixa de mensagens interna do processo seletivo. Quando o RH solicita a atualização de dados, o candidato vê uma mensagem clara explicando o que precisa completar e recebe um atalho para atualizar o perfil.

O candidato também pode marcar a mensagem como lida ou resolvida. Isso ajuda a dar mais rastreabilidade ao processo e reduz a dependência de conversas por fora do sistema.

## Por que isso é importante para o processo

Esse fluxo resolve um ponto prático do recrutamento: muitas vezes o candidato está interessado na vaga, mas o cadastro está incompleto. Sem e-mail ou celular, por exemplo, o RH não consegue avançar com segurança nem usar canais externos de contato.

A nova solução cria uma alternativa interna. Mesmo que o contato externo esteja ausente ou incorreto, o candidato pode ser avisado dentro do próprio portal, ao acessar sua área.

Isso deixa o processo mais organizado, mais auditável e mais fácil de explicar: o sistema mostra o que está faltando, o RH solicita a correção e o candidato sabe exatamente qual ação precisa tomar.

## Roteiro operacional para o RH

Também foi criado um roteiro completo para orientar o analista depois que o candidato já aparece na vaga e o match está disponível.

Esse material explica, em linguagem operacional, como o RH deve seguir a partir da análise do candidato: abrir a vaga, acessar **Candidatos & Match**, consultar os dados do candidato, revisar a compatibilidade, comparar com a análise da IA, decidir se o candidato segue ou não e conduzir as próximas etapas do processo seletivo.

O roteiro foi ajustado para ficar mais fácil de usar como checklist. As listas foram convertidas em caixas de seleção, inclusive nos passos numerados, para que o material funcione como guia prático de acompanhamento.

## Documentação de apoio ao match

Foi incluído também um documento auxiliar com orientações para ajustar um currículo de teste usado na validação do match com itens DNALIO.

Esse documento ajuda a entender quais informações do currículo impactam a leitura de compatibilidade e mostra exemplos de textos que podem cobrir requisitos que estavam aparecendo como faltantes no teste.

O objetivo não é orientar alteração de currículo real em produção, mas facilitar testes controlados e ajudar a validar se o sistema está reconhecendo corretamente experiências e competências descritas no currículo.

## Padrão para próximos resumos do dia

Foi registrada uma diretriz para que os próximos pedidos de **resumo do dia** sigam o mesmo padrão: documento em Markdown, linguagem natural, foco em valor para o RH/negócio e agrupamento por temas, sem transformar o relatório em uma lista técnica de commits.

Isso deixa mais fácil manter uma comunicação consistente com PO e stakeholders, sempre com um material que pode ser lido rapidamente antes de uma conversa de alinhamento.

## Principais ganhos para apresentar ao PO

O RH agora tem um caminho dentro do sistema para pedir que o candidato complete dados pendentes.

O candidato passa a receber mensagens claras no próprio portal, com orientação sobre o que precisa fazer.

O processo fica menos dependente de e-mail, WhatsApp ou contato manual quando justamente esses dados estão ausentes.

A aba **Candidatos & Match** ganha uma ação prática para transformar a análise em encaminhamento operacional.

O portal do candidato passa a ser mais ativo no acompanhamento do processo, não apenas um local de cadastro.

O time ganhou documentação mais clara para explicar e operar o fluxo pós-match.

## Pontos de atenção

Para o candidato ver a solicitação, ele precisa acessar o portal de vagas com sua sessão de candidato.

O envio complementar por e-mail ou WhatsApp pode ser uma melhoria futura, mas a fonte principal agora é a notificação interna no portal.

O bloqueio para aprovar candidatos sem dados obrigatórios continua fazendo sentido, mas agora existe um caminho mais claro para resolver a pendência.

Como houve mudança de banco de dados, a publicação precisa aplicar a nova atualização da base junto com o deploy da API.

## Resumo para conversa com o PO

Hoje evoluímos o processo de recrutamento para que o RH consiga agir quando encontra um candidato com dados incompletos. Agora, em vez de depender de contato manual fora do sistema, o analista pode enviar uma solicitação pelo próprio portal.

O candidato recebe essa pendência na área de notificações, entende quais dados precisa completar e consegue ir para o perfil para atualizar as informações. Isso melhora a continuidade do processo seletivo e reduz travas causadas por cadastro incompleto.

Também organizamos documentos de apoio para o time: um roteiro completo do que o RH deve fazer após analisar o match do candidato com a vaga, um material auxiliar para testes de currículo e uma diretriz para manter o padrão dos próximos resumos diários.
