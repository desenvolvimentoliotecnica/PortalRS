# Relatório de Atividades - 18/05/2026

## Visão geral do dia

O trabalho do dia foi concentrado em melhorar a experiência de recrutamento, principalmente em três frentes: estabilidade do portal do candidato, evolução da análise de compatibilidade com IA e ajustes para que o match entre candidato e vaga fique mais confiável e explicável para o RH.

Também foram feitos ajustes importantes em ambiente de homologação, especialmente relacionados ao download de documentos, leitura de currículos, exibição correta das informações da vaga e uso da localização da empresa no cálculo de compatibilidade.

## Portal do candidato e documentos

No início do dia, corrigimos problemas ligados aos documentos enviados pelos candidatos. O portal passou a tratar melhor casos em que havia um documento registrado, mas o arquivo físico não estava disponível no ambiente de homologação.

Na prática, isso evita que o usuário clique em um download que não funcionaria. Quando o arquivo não existe no disco, o sistema deixa de oferecer uma ação que causaria erro, tornando a experiência mais clara.

Também foi ajustado o carregamento do perfil completo do candidato para evitar falhas internas quando muitas informações eram buscadas ao mesmo tempo. Com isso, a tela fica mais estável e confiável.

Outro avanço foi garantir que, ao enviar um currículo, o texto do arquivo seja extraído e salvo. Isso é importante porque esse conteúdo passa a alimentar melhor as análises de compatibilidade com as vagas.

## Melhorias na análise de match

Uma parte grande do dia foi dedicada à aba de match entre candidatos e vagas.

Antes, havia uma separação menos intuitiva entre a lista de candidatos e a análise de match. Essa experiência foi simplificada: agora o RH trabalha em uma única aba, chamada **Candidatos & Match**, onde consegue ver os candidatos e calcular a compatibilidade individualmente.

O cálculo deixou de acontecer em massa automaticamente ao abrir a aba. Isso melhora a performance e evita esperas desnecessárias. Agora o RH calcula o match quando precisa analisar um candidato específico.

Também foram feitos ajustes visuais para deixar a tela mais limpa:

- os percentuais aparecem nos botões de ação;
- a coluna de match ficou menos poluída;
- a divergência entre os cálculos aparece apenas quando é relevante;
- o termo **Breakdown** foi trocado por **Compatibilidade**, que é mais amigável para o usuário de negócio;
- o botão de reprocessamento foi renomeado para **Atualizar currículos**, ficando mais claro para o RH.

## Compatibilidade e Análise IA lado a lado

Foi implementada a exibição comparativa entre dois olhares sobre o candidato:

- **Compatibilidade**, que é a análise estruturada por critérios da vaga;
- **Análise IA**, que é a leitura interpretativa feita pela inteligência artificial.

Essa comparação ajuda o RH a entender quando os dois caminhos concordam e quando há diferença relevante entre eles. Quando a diferença é grande, o sistema sinaliza isso para chamar atenção.

Isso é importante porque evita que o usuário olhe apenas um número isolado. Agora fica mais fácil explicar por que um candidato parece bom em uma análise, mas não tão forte em outra.

## Uso de IA conforme configuração do cliente

O matching por IA foi ajustado para respeitar a configuração do tenant. Na prática, isso permite que cada ambiente utilize a IA configurada para aquele cliente, em vez de depender de uma configuração fixa.

Também foram aumentados alguns tempos de espera no front para reduzir erros por demora na resposta da IA. Isso melhora a estabilidade percebida pelo usuário, principalmente quando a análise demora um pouco mais.

Além disso, a geração dos dados usados pela busca semântica foi ajustada para usar o provedor configurado no tenant. Isso melhora a coerência entre o que o cliente configurou e o que o sistema efetivamente usa.

## Correções de homologação

Durante o dia, houve uma correção para resolver uma falha de publicação da API em homologação. Era um problema interno de referência no código que impedia o build em ambiente de deploy.

Depois da correção, o pacote pôde seguir normalmente para publicação.

Também foram feitos pequenos ajustes de interface para evitar que textos quebrassem de forma estranha e para melhorar os rótulos usados nas telas do RH.

## Informações da vaga no hub

O hub da vaga foi ajustado para mostrar melhor as informações do centro de custo. Em vez de aparecer apenas um traço ou uma informação vazia, a tela passou a mostrar o código e a descrição do centro de custo, por exemplo:

`01.11.023.002 : GESTAO SISTEMAS`

Também foi investigado por que o campo **Local** da vaga não aparecia corretamente no resumo. A conclusão foi que a vaga tinha cidade e UF, mas o sistema também precisava conseguir herdar esses dados da empresa ligada ao centro de custo quando necessário.

Foi feito ajuste para que o resumo da vaga consiga exibir a localidade usando esse relacionamento.

## Localização e geocodificação

Ao analisar por que a localidade do candidato não ajudava a passar o match mínimo, identificamos que o sistema precisa de coordenadas da empresa e do candidato para calcular distância.

Mesmo com cidade e UF preenchidas, a empresa ainda estava sem latitude e longitude. Sem essas coordenadas, o sistema considera a localidade apenas parcialmente, o que reduz o score final.

Para resolver isso, foi criada uma ação para geocodificar empresas sob demanda. Ou seja, na tela de empresas, o usuário pode pedir para o sistema buscar latitude e longitude a partir do endereço.

Como em homologação o primeiro provedor de geocodificação não respondeu, adicionamos alternativas para aumentar a chance de sucesso. Agora o sistema tenta mais de uma fonte para transformar endereço em coordenadas.

Isso é importante porque a localidade tem impacto direto na nota final de compatibilidade. No caso analisado, o candidato estava com 65% e precisava atingir 70%. Melhorar a localidade pode ajudar a alcançar ou ultrapassar esse mínimo.

## Caso de teste do candidato Leonardo Mendes

Também foi feita uma análise funcional do caso de teste do candidato Leonardo Mendes para a vaga de Analista de Infraestrutura.

O score evoluiu de aproximadamente 57% para 65% depois de ajustes no currículo, especialmente com melhoria em formação, comunicação e aderência às atividades esperadas.

Foi identificado que o candidato ainda não passava porque o mínimo da vaga era 70%. A explicação principal foi que o gargalo não estava mais apenas no currículo, mas também na parte semântica da análise e na localidade sem coordenadas.

Esse caso ajudou a validar a explicabilidade do match: conseguimos mostrar quais critérios estavam cobertos, quais pesos impactavam o resultado e por que o candidato ainda ficava abaixo do mínimo configurado.

## Principais ganhos para apresentar ao PO

O RH ganhou uma experiência mais clara para analisar candidatos e match em uma única tela.

A análise de IA ficou mais transparente, com comparação entre a compatibilidade estruturada e a interpretação da IA.

O sistema ficou mais estável no portal do candidato, especialmente em documentos e currículo.

O match passou a depender menos de comportamento automático pesado e mais de ações controladas pelo usuário.

A localidade da vaga e da empresa começou a ser tratada de forma mais consistente, preparando o caminho para melhorar o score por distância.

Foram resolvidos problemas de homologação que bloqueavam publicação e testes.

## Pontos de atenção

Para a localidade impactar o match corretamente, não basta ter cidade e UF. É necessário ter latitude e longitude da empresa e também do candidato.

Se a geocodificação automática não funcionar em homologação, pode ser necessário liberar acesso externo para os serviços usados ou preencher as coordenadas manualmente.

Depois de alterar currículo ou dados usados pela IA, é necessário atualizar os currículos e recalcular o match.

Algumas melhorias feitas dependem de deploy da API e do front para aparecerem no ambiente de homologação.

## Resumo para conversa com o PO

Hoje focamos em deixar o fluxo de recrutamento mais confiável e mais fácil de explicar para o RH. Melhoramos o portal do candidato, corrigimos problemas com documentos e garantimos que o texto do currículo seja salvo para alimentar as análises.

Na parte de match, juntamos a experiência de candidatos e IA em uma tela única, simplificamos a visualização dos resultados e passamos a mostrar a compatibilidade estruturada junto da análise feita pela IA.

Também investigamos um caso real de validação, em que o candidato subiu para 65% mas ainda não passou porque a vaga exige 70%. A análise mostrou que o próximo ganho relevante depende principalmente da localidade e de coordenadas corretas.

Por fim, ajustamos o cadastro de empresas e o resumo da vaga para usar melhor cidade, UF e geocodificação, permitindo que a localização da empresa passe a contribuir de forma mais correta no cálculo de match.
