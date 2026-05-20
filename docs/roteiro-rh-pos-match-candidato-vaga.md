# Roteiro RH - Do candidato aplicado ao avanço no processo seletivo

## Objetivo deste roteiro

Este documento descreve o que o analista de RH deve fazer depois que um candidato já está vinculado a uma vaga e o sistema já permite visualizar:

- [ ] os dados do candidato;
- [ ] os documentos/currículo;
- [ ] a compatibilidade com a vaga;
- [ ] a análise da IA;
- [ ] o status do candidato no processo.

A ideia é transformar a análise em uma decisão prática dentro do processo de recrutamento e seleção.

## Exemplo usado neste roteiro

Use este exemplo apenas como referência para entender a navegação:

- [ ] **Vaga:** Analista de Infraestrutura SR UAT 20260515
- [ ] **Centro de custo:** `01.11.023.002 : GESTAO SISTEMAS`
- [ ] **Candidato:** Leonardo Mendes
- [ ] **Match mínimo da vaga:** 70%
- [ ] **Score exemplo:** 65%
- [ ] **Situação:** candidato aderente em vários pontos, mas ainda abaixo do mínimo configurado.

## Visão geral do fluxo

O fluxo esperado do RH é:

- [ ] **1.** Abrir a vaga.
- [ ] **2.** Acessar a aba **Candidatos & Match**.
- [ ] **3.** Ver os dados do candidato.
- [ ] **4.** Calcular ou revisar o match.
- [ ] **5.** Comparar **Compatibilidade** e **Análise IA**.
- [ ] **6.** Decidir se o candidato segue ou não.
- [ ] **7.** Mover o candidato no funil de candidaturas.
- [ ] **8.** Conduzir etapas como triagem, entrevista, teste, proposta e contratação.
- [ ] **9.** Quando aprovado de verdade, iniciar pré-admissão.

Fluxo resumido:

```text
Aplicada → Em triagem → Entrevista → Teste → Proposta → Contratado
```

Fluxos alternativos:

```text
Recusado
Desistiu
```

## 1. Acessar a vaga

### Caminho

Menu principal:

```text
Vagas → abrir a vaga desejada
```

Ou pela URL interna:

```text
/vagas/hub?id=<id-da-vaga>
```

### O que você deve ver

No topo do hub da vaga, o RH deve conseguir visualizar informações como:

- [ ] título da vaga;
- [ ] status da vaga, por exemplo **Aberta**;
- [ ] recrutador responsável;
- [ ] gestor requisitante;
- [ ] centro de custo;
- [ ] modalidade;
- [ ] senioridade;
- [ ] tipo de contratação;
- [ ] quantidade de vagas;
- [ ] local;
- [ ] match mínimo configurado.

Exemplo esperado:

```text
ANALISTA DE INFRAESTRUTURA SR UAT 20260515
Status: Aberta
Centro de custo: 01.11.023.002 : GESTAO SISTEMAS
Match mínimo: 70%
Local: Embu das Artes, SP
```

### Conferências importantes

Antes de analisar candidatos, confira:

- [ ] se a vaga está com status correto;
- [ ] se o match mínimo faz sentido para a vaga;
- [ ] se há descrição de cargo vinculada;
- [ ] se o centro de custo e local estão preenchidos;
- [ ] se a vaga está publicada ou pronta para receber candidatos.

Se o local aparecer vazio ou a localidade do match aparecer como **sem coordenadas**, pode faltar latitude/longitude da empresa ou do candidato.

## 2. Abrir a aba Candidatos & Match

### Caminho

Dentro do hub da vaga:

```text
Aba Candidatos & Match
```

### O que você deve ver

Essa aba concentra a análise operacional do candidato para aquela vaga.

O RH deve ver uma lista com os candidatos vinculados à vaga, contendo informações como:

- [ ] nome do candidato;
- [ ] e-mail;
- [ ] telefone/celular;
- [ ] status;
- [ ] data de cadastro/aplicação;
- [ ] botão para editar ou abrir dados do candidato;
- [ ] botão para calcular match;
- [ ] botões para ver **Compatibilidade** e **Análise IA**, quando disponíveis;
- [ ] indicação de divergência entre os scores, quando houver.

Exemplo:

```text
Candidato: Leonardo Mendes
E-mail: leonardo@email.com
Status: Aplicada
Ações: Calcular match | Compatibilidade | Análise IA | Mais ações
```

## 3. Conferir os dados do candidato

### Ação

Na linha do candidato, clique para abrir ou editar o cadastro do candidato.

Normalmente a ação aparece como:

```text
Editar
```

ou no menu de ações do candidato.

### O que conferir

Verifique se o cadastro tem dados mínimos para o processo:

- [ ] nome completo;
- [ ] e-mail;
- [ ] celular;
- [ ] cidade/UF;
- [ ] currículo anexado;
- [ ] texto do currículo extraído;
- [ ] documentos complementares, quando houver.

### O que precisa estar correto

Para seguir bem no processo, o candidato deve ter:

- [ ] **e-mail** preenchido;
- [ ] **celular** preenchido;
- [ ] currículo atualizado;
- [ ] dados coerentes com o candidato real;
- [ ] se possível, endereço/localidade para ajudar no cálculo de distância.

### Exemplo de alerta

Se o RH tentar aprovar o candidato e estiver faltando e-mail ou celular, o sistema deve pedir para preencher esses dados antes.

Isso evita iniciar admissão ou comunicação sem canal de contato válido.

## 4. Calcular o match

### Ação

Na aba **Candidatos & Match**, localize o candidato e clique:

```text
Calcular match
```

### O que acontece

O sistema calcula a compatibilidade do candidato com a vaga.

Esse cálculo considera critérios como:

- [ ] competência;
- [ ] experiência;
- [ ] formação;
- [ ] localidade;
- [ ] requisitos obrigatórios;
- [ ] aderência semântica do currículo com a descrição da vaga.

### O que você deve ver

Depois do cálculo, o botão passa a mostrar a pontuação ou fica disponível a análise detalhada.

Exemplo:

```text
Score final: 65%
Abaixo do mínimo
```

Se a vaga exige 70%, um candidato com 65% ainda não passa automaticamente.

### Como interpretar

O score final deve ser lido como apoio à decisão, não como decisão automática.

Exemplo:

```text
Match mínimo da vaga: 70%
Score do candidato: 65%
Conclusão: candidato está próximo, mas abaixo do corte configurado.
```

Nesse caso, o RH pode:

- [ ] manter em triagem para avaliação humana;
- [ ] revisar se o currículo está correto;
- [ ] conferir se falta localidade/coordenadas;
- [ ] avançar mesmo assim, se o perfil fizer sentido;
- [ ] recusar, se a lacuna for relevante.

## 5. Abrir Compatibilidade

### Ação

Na linha do candidato, clique em:

```text
Compatibilidade
```

### O que você deve ver

A tela de compatibilidade mostra uma explicação por critérios.

Ela deve indicar:

- [ ] peso de cada critério;
- [ ] score por critério;
- [ ] contribuição daquele critério no resultado final;
- [ ] itens cobertos;
- [ ] itens faltantes;
- [ ] requisitos obrigatórios faltando, quando existirem;
- [ ] distância/localidade, quando houver coordenadas.

Exemplo:

```text
Competência
Peso 40 × 73% = 29.2 pts

Experiência
Peso 30 × 85% = 25.5 pts

Formação
Peso 15 × 100% = 15 pts

Localidade
Peso 15 × 50% = 7.5 pts
sem coordenadas (parcial)
```

### Como usar essa informação

Use essa tela para responder perguntas como:

- [ ] O candidato tem a formação exigida?
- [ ] A experiência mínima aparece no currículo?
- [ ] As atividades principais da vaga estão cobertas?
- [ ] Falta algum requisito obrigatório?
- [ ] O score está baixo por currículo ou por localidade?

### Exemplo de leitura para o PO/RH

```text
O candidato atende formação e experiência, mas ainda fica abaixo do mínimo porque a parte semântica e a localidade reduzem o score final.
```

## 6. Abrir Análise IA

### Ação

Na linha do candidato, clique em:

```text
Análise IA
```

### O que você deve ver

A análise IA apresenta uma leitura mais interpretativa.

Ela pode trazer:

- [ ] porcentagem calculada pela IA;
- [ ] justificativa textual;
- [ ] pontos fortes;
- [ ] riscos;
- [ ] aderência geral;
- [ ] explicação sobre por que o candidato combina ou não com a vaga.

### Como interpretar

A **Análise IA** deve ser usada como complemento.

Ela ajuda a resumir a leitura do currículo, mas não substitui a decisão do RH.

Se a **Compatibilidade** e a **Análise IA** divergirem muito, o RH deve revisar:

- [ ] se o currículo correto foi enviado;
- [ ] se o texto extraído do currículo pertence ao candidato certo;
- [ ] se a descrição da vaga está correta;
- [ ] se os critérios da vaga estão calibrados;
- [ ] se a análise precisa ser recalculada.

## 7. Decidir a triagem

Depois de revisar dados, currículo, compatibilidade e IA, o analista deve tomar uma decisão.

### Possíveis decisões

#### Candidato segue

Use quando:

- [ ] o candidato tem aderência razoável;
- [ ] o match está acima do mínimo;
- [ ] ou o match está próximo e o RH quer avaliar melhor.

Próximo passo:

```text
Mover para Em triagem ou Entrevista
```

#### Candidato fica em análise

Use quando:

- [ ] faltam documentos;
- [ ] falta atualizar currículo;
- [ ] a análise está inconclusiva;
- [ ] o RH quer validar com gestor.

Próximo passo:

```text
Manter em Aplicada ou Em triagem
```

#### Candidato não segue

Use quando:

- [ ] não atende requisitos essenciais;
- [ ] está muito abaixo do mínimo;
- [ ] formação ou experiência não aderem;
- [ ] há impeditivo claro.

Próximo passo:

```text
Mover para Recusado
```

#### Candidato desiste

Use quando:

- [ ] candidato informou que não tem mais interesse;
- [ ] aceitou outra proposta;
- [ ] não respondeu aos contatos;
- [ ] desistiu formalmente.

Próximo passo:

```text
Mover para Desistiu
```

## 8. Usar o Kanban de candidaturas

### Caminho

Menu principal:

```text
Recrutamento → Candidaturas
```

Ou URL:

```text
/recrutamento/candidaturas
```

### O que você deve ver

A tela mostra um kanban com colunas do processo:

```text
Aplicada
Em triagem
Entrevista
Teste
Proposta
Contratado
Recusado
Desistiu
```

Cada card representa uma candidatura.

No card, o RH deve ver:

- [ ] nome do candidato;
- [ ] e-mail;
- [ ] vaga;
- [ ] score de match;
- [ ] mínimo da vaga;
- [ ] indicação se passou ou ficou abaixo;
- [ ] dias na etapa;
- [ ] status de SLA;
- [ ] requisitos obrigatórios OK ou pendentes.

Exemplo de card:

```text
Leonardo Mendes
ANALISTA DE INFRAESTRUTURA SR UAT 20260515
Score: 65%
Mínimo: 70%
Abaixo
Obrig. OK
2d na etapa
```

## 9. Filtrar pela vaga

### Ação

No topo do kanban, use o filtro:

```text
Vaga
```

Selecione a vaga desejada.

Exemplo:

```text
ANALISTA DE INFRAESTRUTURA SR UAT 20260515
```

### Resultado esperado

O kanban passa a mostrar apenas os candidatos daquela vaga.

Isso facilita a condução do processo de uma vaga específica.

## 10. Avançar candidato de etapa

### Ação principal

No kanban:

- [ ] **1.** localize o card do candidato;
- [ ] **2.** arraste o card para a próxima coluna;
- [ ] **3.** informe uma observação, se necessário;
- [ ] **4.** confirme a movimentação.

Exemplo:

```text
Mover Leonardo Mendes de Aplicada para Em triagem.
Observação: Perfil aderente para avaliação inicial do RH.
```

### Resultado esperado

O card deve aparecer na nova coluna.

O sistema deve registrar a mudança de etapa.

### Quando mover para Em triagem

Use quando o RH ainda está validando:

- [ ] currículo;
- [ ] contato;
- [ ] pretensão salarial;
- [ ] disponibilidade;
- [ ] aderência geral;
- [ ] alinhamento com gestor.

### Quando mover para Entrevista

Use quando:

- [ ] o candidato passou pela triagem inicial;
- [ ] há interesse em conversar;
- [ ] dados de contato estão completos;
- [ ] o RH quer seguir para entrevista.

### Quando mover para Teste

Use quando:

- [ ] a vaga exige avaliação técnica;
- [ ] o gestor solicitou teste;
- [ ] o RH quer validar habilidades práticas.

### Quando mover para Proposta

Use quando:

- [ ] entrevistas foram concluídas;
- [ ] candidato foi aprovado tecnicamente;
- [ ] salário/benefícios podem ser formalizados;
- [ ] gestor aprovou a continuidade.

### Quando mover para Contratado

Use quando:

- [ ] proposta foi aceita;
- [ ] documentação avançou;
- [ ] admissão está em andamento ou concluída conforme o processo interno.

## 11. Registrar decisão no card

Além de arrastar, algumas telas exibem o botão:

```text
Decisão
```

Use esse botão quando precisar registrar uma decisão mais explícita sobre o candidato.

Exemplos de decisão:

```text
Aprovado para entrevista
Reprovado por não atender requisito obrigatório
Manter em triagem aguardando retorno do gestor
```

### Boa prática

Sempre que possível, escreva uma observação objetiva.

Exemplo:

```text
Candidato atende experiência e formação. Score ficou abaixo do mínimo por localidade sem coordenadas. RH decidiu seguir para entrevista.
```

## 12. Acompanhar funil

### Caminho

Menu principal:

```text
Recrutamento → Funil
```

Ou URL:

```text
/recrutamento/funil
```

### Para que serve

Essa tela ajuda a acompanhar conversão entre etapas.

O RH/PO pode usar para responder:

- [ ] quantos candidatos aplicaram;
- [ ] quantos foram para triagem;
- [ ] quantos chegaram em entrevista;
- [ ] quantos foram para teste;
- [ ] quantos receberam proposta;
- [ ] quantos foram contratados.

### Exemplo de leitura

```text
10 candidatos aplicados
6 foram para triagem
3 chegaram em entrevista
1 foi para proposta
```

Isso ajuda a avaliar se a vaga está recebendo candidatos aderentes ou se o funil está travando em alguma etapa.

## 13. Criar proposta

### Quando usar

Use quando o candidato já foi aprovado nas etapas de seleção e o RH quer formalizar oferta.

### Caminho

Menu principal:

```text
Recrutamento → Propostas / Cartas de oferta
```

Ou URL:

```text
/recrutamento/propostas-vaga
```

### Ação

Clique em:

```text
Nova proposta
```

### Campos esperados

Preencha:

- [ ] vaga;
- [ ] candidato;
- [ ] moeda;
- [ ] salário oferecido;
- [ ] benefícios;
- [ ] data prevista de início;
- [ ] mensagem personalizada;
- [ ] observação interna do RH.

Exemplo:

```text
Vaga: Analista de Infraestrutura SR UAT 20260515
Candidato: Leonardo Mendes
Moeda: BRL
Salário oferecido: R$ 7.500
Benefícios: VR, VT, assistência médica
Data prevista de início: 01/06/2026
Mensagem: Olá, Leonardo. Temos satisfação em formalizar nossa proposta...
Observação interna: Aprovado pelo gestor após entrevista técnica.
```

### Resultado esperado

A proposta deve ser criada como:

```text
Rascunho
```

Depois, na listagem, clique em:

```text
Enviar
```

O sistema deve gerar um link para aceite digital.

Também deve permitir:

```text
Copiar link
Cancelar
```

## 14. Acompanhar resposta da proposta

Na tela de propostas, acompanhe o status.

Status possíveis:

```text
Rascunho
Enviada
Aceita
Recusada
Cancelada
```

### Se o candidato aceitar

Próximo passo:

```text
Iniciar pré-admissão
```

### Se o candidato recusar

Próximo passo:

```text
Mover candidatura para Recusado ou Desistiu
Registrar observação
Avaliar próximo candidato da vaga
```

## 15. Iniciar pré-admissão

### Quando usar

Use apenas quando o candidato foi aprovado de fato.

Isso normalmente acontece depois de:

- [ ] triagem concluída;
- [ ] entrevista realizada;
- [ ] teste concluído, se houver;
- [ ] proposta aceita ou alinhamento final realizado.

### Caminho pela vaga

No hub da vaga, aba **Candidatos & Match**, use:

```text
Aprovar candidato
```

O sistema abre um modal de aprovação.

### O que o modal deve pedir

O modal pode solicitar:

- [ ] tipo de contratação;
- [ ] canal de envio;
- [ ] CPF, quando for gerar link;
- [ ] opção de abrir pré-admissão manual;
- [ ] opção de enviar link por e-mail/WhatsApp.

Exemplo:

```text
Tipo de contratação: CLT
Canal: WhatsApp + e-mail
```

### Resultado esperado

O sistema cria uma pré-admissão.

Depois disso, o RH pode:

- [ ] abrir a tela de admissão;
- [ ] enviar link para o candidato preencher dados;
- [ ] acompanhar documentos;
- [ ] continuar o processo admissional.

### Caminho direto

URL interna:

```text
/admissao/nova?id=<id-da-pre-admissao>
```

## 16. O que não deve ser feito cedo demais

Não use **Aprovar candidato** logo após ver um match bom, se o candidato ainda não passou pelo processo seletivo.

Esse botão está mais próximo da etapa de admissão.

Antes dele, o caminho recomendado é:

```text
Aplicada → Em triagem → Entrevista → Teste → Proposta
```

Só depois:

```text
Aprovar candidato / Iniciar admissão
```

## 17. Exemplo de roteiro completo com Leonardo Mendes

### Situação inicial

```text
Vaga: Analista de Infraestrutura SR UAT 20260515
Candidato: Leonardo Mendes
Match mínimo: 70%
Score atual: 65%
Status: Aplicada
```

### Passo 1 - RH abre a vaga

Caminho:

```text
Vagas → Analista de Infraestrutura SR UAT 20260515
```

Confere:

```text
Status: Aberta
Centro de custo: 01.11.023.002 : GESTAO SISTEMAS
Local: Embu das Artes, SP
Match mínimo: 70%
```

### Passo 2 - RH abre Candidatos & Match

Confere:

```text
Leonardo Mendes aparece na lista de candidatos.
```

### Passo 3 - RH calcula match

Resultado exemplo:

```text
Score final: 65%
Abaixo do mínimo
```

### Passo 4 - RH abre Compatibilidade

Observa:

```text
Formação: 100%
Experiência: 85%
Competência: 73%
Localidade: 50% sem coordenadas
```

### Passo 5 - RH decide se segue

Mesmo abaixo de 70%, o RH pode decidir seguir para entrevista se o perfil for promissor.

Observação sugerida:

```text
Candidato próximo do mínimo. Atende formação e experiência. Localidade ainda depende de coordenadas. Seguir para triagem/entrevista para validação humana.
```

### Passo 6 - RH move no kanban

Caminho:

```text
Recrutamento → Candidaturas
```

Filtro:

```text
Vaga: Analista de Infraestrutura SR UAT 20260515
```

Ação:

```text
Arrastar Leonardo Mendes de Aplicada para Em triagem
```

Depois, se aprovado na triagem:

```text
Arrastar de Em triagem para Entrevista
```

### Passo 7 - RH registra evolução

Durante a evolução, o RH deve registrar observações como:

```text
Triagem realizada. Candidato demonstra experiência com suporte, redes e infraestrutura. Encaminhar para entrevista técnica.
```

### Passo 8 - Após entrevista/teste

Se aprovado:

```text
Mover para Proposta
Criar proposta
Enviar proposta
```

Se reprovado:

```text
Mover para Recusado
Registrar motivo
```

Se candidato desistir:

```text
Mover para Desistiu
Registrar motivo
```

### Passo 9 - Proposta aceita

Se a proposta for aceita:

```text
Mover para Contratado
Iniciar pré-admissão
```

## 18. Checklist operacional do analista

Antes de avançar para triagem:

- [ ] Candidato está vinculado à vaga.
- [ ] Currículo foi enviado.
- [ ] Dados básicos estão preenchidos.
- [ ] Match foi calculado.
- [ ] Compatibilidade foi revisada.
- [ ] Análise IA foi revisada, se disponível.
- [ ] Score foi comparado com o mínimo da vaga.
- [ ] Requisitos obrigatórios foram conferidos.
- [ ] Localidade foi conferida, se relevante.

Antes de avançar para entrevista:

- [ ] E-mail e celular estão preenchidos.
- [ ] RH validou aderência inicial.
- [ ] Candidato tem disponibilidade/interesse.
- [ ] Observação da triagem foi registrada.

Antes de criar proposta:

- [ ] Entrevista foi concluída.
- [ ] Teste foi concluído, se aplicável.
- [ ] Gestor aprovou.
- [ ] Condições salariais estão alinhadas.
- [ ] Benefícios e data prevista foram definidos.

Antes de iniciar admissão:

- [ ] Proposta foi aceita ou aprovação final foi formalizada.
- [ ] Tipo de contratação está correto.
- [ ] E-mail e celular estão válidos.
- [ ] CPF foi coletado quando necessário.
- [ ] Candidato foi movido para etapa correta.

## 19. Mensagem para alinhar com o PO

Depois que o candidato aplica para a vaga, o sistema já permite ao RH fazer a análise completa do perfil e do match.

O próximo passo de processo é o RH transformar essa análise em uma decisão no funil: manter em triagem, avançar para entrevista, enviar para teste, criar proposta, recusar ou iniciar admissão.

O match ajuda a justificar a decisão, mas a movimentação formal acontece no funil de candidaturas e nas telas de proposta/pré-admissão.

Uma evolução natural do produto seria aproximar ainda mais essas ações da aba **Candidatos & Match**, permitindo que o RH avance etapas diretamente depois de analisar a compatibilidade.
