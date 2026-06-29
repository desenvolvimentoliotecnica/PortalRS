# Relatório de Atividades - 22/05/2026

## Visão geral do dia

O trabalho de 22/05 foi concentrado em evoluir o fluxo de recrutamento depois da etapa de match entre candidato e vaga. O foco principal foi transformar a análise de candidatos em um processo mais operacional para o RH: com melhor leitura da vaga, controle mais claro de candidatos aprovados, avanço pelo Kanban e preparação para proposta.

Também houve uma frente importante de liberação de acesso. A funcionalidade de **Propostas** foi ajustada para aparecer corretamente nos menus e para ser usada pelo perfil de Analista de RH, sem depender de permissões administrativas mais amplas.

Na prática, o dia avançou o módulo de recrutamento do ponto de "encontrar candidatos compatíveis" para "conduzir o candidato até a proposta", reduzindo atritos para analistas, especialistas e gestores acompanharem o andamento.

## UAT e orientação pós-match

Foi criado e atualizado um material de apoio para orientar os próximos passos após o match de candidatos com uma vaga.

Esse documento ajuda o time a validar o fluxo com mais clareza: o que observar depois que o candidato aparece como compatível, quais ações precisam estar disponíveis e quais pontos ainda merecem atenção em testes de uso real.

Essa frente é importante porque evita que a validação fique restrita à parte técnica do ranking. O foco passa a ser a jornada completa do RH: analisar candidato, aprovar, acompanhar no funil e avançar para as etapas seguintes.

## Melhorias na leitura e edição de vagas

A tela de edição de vagas recebeu ajuste visual para melhorar a legibilidade, especialmente aumentando a fonte em pontos relevantes do formulário.

Também foram feitos aprimoramentos na leitura das vagas e no Hub, facilitando a navegação e a compreensão dos dados que o RH precisa consultar ao avaliar candidatos e acompanhar o processo.

O ganho para o usuário é uma tela menos cansativa, com informações mais fáceis de identificar, especialmente em rotinas de uso contínuo por analistas de RH.

## Controle de aprovação de candidatos

Foi corrigido um ponto importante no controle de aprovação dos candidatos dentro da vaga.

O objetivo foi deixar mais consistente quando um candidato pode ser marcado como aprovado, evitando que o fluxo avance de forma confusa ou fora da etapa correta. Essa melhoria reforça a governança do processo seletivo e reduz o risco de movimentações indevidas.

Para o RH, isso significa mais confiança ao operar a vaga: aprovar candidato deixa de ser uma ação isolada e passa a respeitar melhor o estado do processo.

## Evolução do Kanban de candidaturas

O Kanban de candidaturas foi uma das principais frentes do dia.

Foram feitas melhorias para deixar o fluxo mais completo e mais conectado às ações reais do recrutamento. A tela passou a trabalhar melhor detalhes do candidato, movimentações entre etapas, notificações e atualização de informações relacionadas à vaga.

Também houve ajustes em serviços e indicadores para que o acompanhamento do funil fique mais coerente. Isso ajuda o RH a enxergar melhor onde cada candidato está, quais ações já foram tomadas e quais próximos passos precisam acontecer.

Em termos de negócio, o Kanban fica mais próximo de uma ferramenta de operação diária, não apenas uma visualização de status.

## Integração da proposta ao fluxo de recrutamento

Foi integrada a etapa de **Proposta** ao fluxo do Kanban de candidaturas.

Com essa evolução, o processo deixa de parar na aprovação do candidato e passa a contemplar o momento em que o RH prepara e acompanha a proposta. Isso aproxima o sistema do fluxo real de contratação: encontrar candidato, analisar, aprovar, conduzir etapas e formalizar a oferta.

Também foram normalizados dados no modal de propostas, para reduzir inconsistências de preenchimento e melhorar a experiência de quem precisa registrar ou consultar uma proposta.

## Liberação de acesso a Propostas

A funcionalidade de **Propostas** foi ajustada no controle de menus, permissões e módulos do sistema.

Antes, o acesso podia não estar suficientemente claro ou liberado para o perfil correto. Foram feitos ajustes para que o item faça parte da navegação e possa ser administrado corretamente pela configuração de permissões.

No fim do dia, também foi corrigido o acesso para permitir que o perfil de **Analista de RH** trabalhe com propostas. Isso é importante porque a etapa de proposta é uma atribuição natural da área de recrutamento, e não deveria exigir perfil administrativo.

## Ganhos para o usuário/RH

O RH passa a ter mais clareza sobre o que fazer depois do match de candidatos.

O Kanban de candidaturas fica mais útil para operação diária, com melhor controle das etapas e dos candidatos.

A etapa de proposta passa a fazer parte do fluxo de recrutamento, aproximando o sistema do processo real de contratação.

Analistas de RH ganham acesso mais adequado para atuar em propostas, sem necessidade de permissões excessivas.

A leitura das telas de vaga e candidatura fica mais confortável, reduzindo esforço operacional.

## Pontos de atenção

As permissões de Propostas podem exigir novo login para que o usuário receba os menus e acessos atualizados.

O fluxo de proposta deve ser validado em UAT com pelo menos um caso completo: candidato aprovado, avanço pelo Kanban e registro/consulta da proposta.

Como houve evolução em várias telas do recrutamento, é importante testar a jornada completa, não apenas cada tela isoladamente.

Se houver perfis de RH com acesso parcial, vale conferir se todos conseguem visualizar exatamente as funcionalidades esperadas para seu papel.

## Resumo para conversa com o PO

No dia 22/05, avançamos o recrutamento principalmente no pós-match. O sistema ficou mais preparado para o RH conduzir o candidato dentro do Kanban, controlar aprovações e seguir até a etapa de proposta.

Também melhoramos a usabilidade das telas de vaga e candidatura e ajustamos o controle de acesso para que o Analista de RH consiga trabalhar com propostas sem precisar de permissões administrativas.

O principal ganho é transformar o módulo em uma ferramenta mais completa para a operação real do recrutamento: da identificação do candidato compatível até o encaminhamento da proposta.
