# Relatório de Atividades - 20/05/2026

## Visão geral do dia

O trabalho de 20/05 foi concentrado em amadurecer o fluxo de recrutamento ponta a ponta, desde a experiência do candidato no portal de vagas até a operação diária do analista de RH no Kanban de candidaturas.

O principal avanço foi transformar a tela de candidaturas em um espaço mais completo de análise: o RH passou a ver score de match mais confiável, detalhes do candidato em modal, perfil público, documentos, dados de compatibilidade e uma ação para enviar comunicação ao candidato com anexos.

Também houve melhorias importantes no portal do candidato, na organização das telas de recrutamento e na governança de permissões para a funcionalidade de **Documentação Padrão**.

## Portal de vagas e documentos do candidato

O portal de vagas foi melhorado para tornar o gerenciamento de documentos mais claro e seguro para o candidato.

Foram feitos ajustes na visualização dos cards de documentos, no alinhamento das ações, na abertura correta dos links de arquivos e no fluxo de remoção. A remoção passou a ter confirmação explícita e tratamento mais robusto quando a API não retorna corpo JSON, evitando erros visuais desnecessários para o usuário.

Também foi aprimorado o feedback de upload de documentos. Com isso, o candidato recebe uma resposta mais clara sobre o que aconteceu ao anexar arquivos, reduzindo dúvida operacional e retrabalho no atendimento.

## Mensagens do RH no portal do candidato

O portal standalone do candidato passou a exibir mensagens enviadas pelo RH.

Esse ponto é importante porque conecta melhor a operação interna do recrutamento com a experiência externa do candidato. Quando o RH precisa orientar, solicitar complemento ou comunicar uma ação, o candidato passa a ter um local centralizado para consultar essas mensagens dentro do próprio portal.

Esse fluxo reforça a rastreabilidade do processo seletivo e diminui a dependência de contatos paralelos fora do sistema.

## Match no Kanban de candidaturas

A tela de candidaturas em Kanban recebeu várias correções ligadas ao score de match.

O chip de match no card do candidato passou a exibir o score correto, alinhado ao valor mostrado no modal de detalhes. Antes, havia diferença entre o score resumido no card e o score apresentado ao abrir o detalhamento, o que gerava insegurança para o analista.

Também foram feitas melhorias de leitura no modal de match: fontes maiores, mais espaço, melhor aproveitamento da largura e melhor indentação das listas com bullets. Isso deixa os critérios cobertos e faltantes mais fáceis de analisar, principalmente quando os textos são longos.

## Modal detalhado do candidato no Kanban

Foi criado um modal detalhado ao clicar no card do candidato no Kanban.

Esse modal reúne informações importantes para a decisão do RH, como resumo do candidato, dados de match, perfil público do portal e documentos. A ideia é reduzir a necessidade de navegar por várias telas para entender se o candidato tem ou não os requisitos necessários para seguir no processo.

O modal também passou a ter altura fixa de `85vh`, evitando saltos visuais ao trocar de aba. Isso melhora a estabilidade da interface e deixa a análise mais confortável.

## Envio de email e notificação ao candidato

Dentro do novo modal detalhado, foi incluída a possibilidade de o analista de RH enviar email e notificação ao candidato.

O analista pode preencher assunto e corpo da mensagem e anexar arquivos reais. Do lado técnico, o fluxo passou a suportar anexos na fila de email, no envio SMTP e na persistência da mensagem, garantindo que o envio não seja apenas uma simulação visual.

Esse recurso dá ao RH uma ação prática dentro da própria análise do candidato: além de consultar informações, o analista consegue acionar o candidato com orientação formal e documentos anexos quando necessário.

## Escopo por analista de RH

Foi reforçada uma premissa importante para a operação: o analista de RH deve visualizar apenas candidaturas e vagas relacionadas ao seu escopo.

O Kanban de candidaturas passou a filtrar candidatos por vagas atribuídas ao analista responsável. Isso evita que um usuário veja candidatos de vagas de outros responsáveis, incluindo dados que podem vir de RM ou de seeds de exemplo.

Também foi criado um filtro de vagas mais coerente para o Kanban: o dropdown passou a mostrar apenas vagas presentes nas candidaturas retornadas ou vagas atribuídas ao analista logado. A mesma regra foi aplicada nas telas de **Processo Seletivo** e **Candidatos**, para manter consistência entre os pontos de busca e filtro.

## Organização das telas de recrutamento

A tela legada de **Triagem** foi descontinuada para reduzir confusão operacional.

O fluxo principal de acompanhamento de candidaturas passa a ser o Kanban em **Recrutamento > Candidaturas**. Links antigos e atalhos foram redirecionados para a tela nova, evitando que o usuário se divida entre experiências parecidas com regras diferentes.

Essa decisão ajuda a consolidar o processo em uma tela principal, com menos ambiguidade entre Kanban, Triagem e Pipeline.

## Documentação Padrão e permissões

A funcionalidade de **Documentação Padrão** foi integrada ao controle de acessos.

Foi criada uma permissão dedicada, `documentacao-padrao.manage`, para que o item possa ser liberado de forma específica para perfis como Analista de RH. Antes, a tela estava vinculada a uma permissão administrativa mais genérica, o que dificultava disponibilizar apenas essa funcionalidade sem abrir permissões maiores.

Também foram atualizados manifesto de permissões, navegação, catálogo de módulos, controller e recursos de localização para que o item apareça com nome correto e possa ser gerenciado na tela de acessos.

## Principais ganhos para apresentar ao PO

O RH agora tem uma visão mais completa do candidato diretamente no Kanban de candidaturas.

O score de match ficou mais confiável e consistente entre card e modal.

O modal de match ficou mais legível para análise real dos critérios cobertos e faltantes.

O analista consegue consultar perfil, documentos e compatibilidade sem sair do contexto da candidatura.

O RH pode enviar email e notificação ao candidato com anexos reais a partir do próprio fluxo de análise.

O Kanban e os filtros de vagas respeitam melhor o escopo do analista responsável.

A tela antiga de Triagem foi descontinuada, reduzindo confusão entre rotas parecidas.

A Documentação Padrão passou a ter permissão própria para liberação controlada por perfil.

## Pontos de atenção

Alterações de permissão podem exigir novo login para que a sessão carregue as permissões atualizadas.

As melhorias de email com anexos dependem da configuração correta de SMTP e do processamento da fila de emails em produção.

Como houve mudança de banco para suportar anexos de email, o deploy precisa garantir aplicação das migrations da API.

A consolidação do uso do Kanban deve ser comunicada ao time para evitar que usuários continuem procurando a tela antiga de Triagem.

## Resumo para conversa com o PO

No dia 20/05, evoluímos fortemente o fluxo de recrutamento. O Kanban de candidaturas passou a ser a tela central para o analista avaliar candidatos, com score de match consistente, modal detalhado, perfil público, documentos e envio de comunicação ao candidato com anexos.

Também corrigimos pontos importantes da experiência do candidato no portal de vagas, especialmente no gerenciamento de documentos e no recebimento de mensagens do RH.

Além disso, organizamos o acesso às telas: a Triagem antiga foi descontinuada, os filtros de vagas passaram a respeitar o escopo do analista e a Documentação Padrão ganhou permissão própria para ser liberada de forma controlada por perfil.
