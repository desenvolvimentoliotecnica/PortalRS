# UAT - Pre-admissao e solicitacao de documentos ao candidato

## Objetivo

Validar o fluxo atual em que a Analista de RH inicia a pre-admissao de um candidato aprovado/contratado, solicita a documentacao padrao configurada no admin, envia o link de acesso ao candidato e acompanha os documentos enviados pelo portal de admissao.

Este UAT cobre o caminho operacional atual:

```text
Candidato aceitou proposta -> RH inicia admissao -> Sistema cria/reutiliza pre-admissao
-> Sistema carrega documentacao padrao -> RH gera link -> Candidato envia documentos
-> RH acompanha e valida
```

## Dados de exemplo para validacao

Use um candidato real de teste ou crie um candidato com dados semelhantes:

```text
Vaga: Analista de Infraestrutura SR UAT
Candidato: Leonardo Mendes
E-mail: leonardomendes2017@gmail.com
CPF para teste: 123.456.789-09
Tipo de contratacao: CLT
```

Observacao:

```text
Use um CPF valido para o ambiente de teste quando quiser finalizar o fluxo completo.
Se usar CPF ficticio, valide apenas a navegacao, geracao de link e tentativa de login.
```

## Pre-condicoes

Antes de iniciar este UAT, confirme:

- [ ] A vaga existe e esta acessivel para a Analista de RH.
- [ ] O candidato existe na vaga.
- [ ] A proposta foi aceita ou a candidatura esta em etapa **Proposta** ou **Contratado**.
- [ ] A documentacao padrao foi configurada no admin.
- [ ] O candidato possui e-mail ou celular preenchido.
- [ ] A Analista de RH tem permissao para acessar Recrutamento e Pre-Admissao.

## UAT 1 - Conferir documentacao padrao no Admin

Objetivo: garantir que a lista de documentos que sera solicitada na pre-admissao esta configurada.

Passo a passo:

1. Acesse o sistema como Admin ou usuario com permissao de administracao.
2. No menu lateral, clique em **Administracao**.
3. Clique em **Documentacao Padrao**.
4. Revise a lista de documentos exibida.
5. Para o fluxo CLT, configure pelo menos:

```text
RG: Obrigatorio
CPF: Obrigatorio
Comprovante de Residencia: Obrigatorio
Carteira de Trabalho (CTPS): Obrigatorio
Titulo de Eleitor: Obrigatorio
PIS/PASEP: Obrigatorio
Foto 3x4: Opcional
Escolaridade: Opcional
Comprovante Bancario: Obrigatorio
```

6. Clique em **Salvar global**.

Resultado esperado:

- [ ] Sistema exibe mensagem de sucesso.
- [ ] A configuracao permanece salva apos atualizar a pagina.
- [ ] Documentos marcados como **Nao sera pedido** nao devem aparecer para o candidato depois.

## UAT 2 - Abrir a vaga e localizar o candidato

Objetivo: iniciar o fluxo a partir do contexto da vaga/candidato.

Passo a passo:

1. Acesse o sistema como Analista de RH.
2. No menu lateral, clique em **Recrutamento e Selecao**.
3. Clique em **Vagas**.
4. Na lista de vagas, use a busca e pesquise:

```text
Analista de Infraestrutura SR UAT
```

5. Clique na vaga para abrir o Hub da Vaga.
6. No Hub, clique na aba **Candidatos & Match** ou **Candidatos**.
7. Localize o candidato:

```text
Leonardo Mendes
```

Resultado esperado:

- [ ] O candidato aparece vinculado a vaga correta.
- [ ] A candidatura aparece em etapa **Proposta** ou **Contratado**, conforme o fluxo ja executado.
- [ ] A tela oferece a acao **Aprovar candidato** no menu de acoes do candidato.

## UAT 3 - Iniciar pre-admissao e solicitar documentacao

Objetivo: a Analista inicia a pre-admissao a partir do candidato e o sistema carrega a documentacao padrao.

Passo a passo:

1. Na linha/card do candidato, abra o menu de acoes clicando no botao de reticencias (**...**).
2. Clique em **Aprovar candidato**.
3. No modal **Aprovar Candidato**, selecione o tipo de contratacao.
4. Para este teste, selecione:

```text
CLT
```

5. Confira a descricao dos documentos esperados no modal.
6. Escolha o canal de envio:

```text
Enviar via E-mail
```

ou, se quiser validar WhatsApp:

```text
Enviar via WhatsApp + E-mail
```

7. Informe o CPF do candidato quando o modal solicitar.
8. Clique no botao de envio do canal escolhido.

Resultado esperado:

- [ ] Sistema chama o fluxo de criacao/reuso de pre-admissao.
- [ ] Sistema gera a pre-admissao para o candidato.
- [ ] Sistema gera o link publico de admissao.
- [ ] Sistema informa se o e-mail e/ou WhatsApp foi enviado.
- [ ] Se o link for exibido, a Analista consegue copiar o link.

Observacao tecnica esperada:

```text
POST /api/pre-admissao/iniciar-manual
POST /api/pre-admissao/{id}/gerar-link
```

## UAT 4 - Conferir a pre-admissao criada

Objetivo: confirmar que o registro aparece na area de Pre-Admissao com documentos solicitados.

Passo a passo:

1. No menu lateral, clique em **Admissao**.
2. Clique em **Pre-Admissao**.
3. Pesquise pelo nome do candidato:

```text
Leonardo Mendes
```

4. Abra o registro da pre-admissao.
5. Confira o status inicial.
6. Confira a secao **Solicitar Documentos** ou **Documentos Solicitados**.

Resultado esperado:

- [ ] A pre-admissao aparece na lista.
- [ ] O status esta como **Enviado**, **Preenchimento Pendente** ou equivalente.
- [ ] A lista de documentos solicitados corresponde ao padrao configurado no Admin.
- [ ] Documentos obrigatorios aparecem marcados como obrigatorios.
- [ ] Documentos opcionais aparecem como opcionais.

Exemplo esperado:

```text
RG - Obrigatorio
CPF - Obrigatorio
Comprovante de Residencia - Obrigatorio
CTPS - Obrigatorio
Comprovante Bancario - Obrigatorio
Escolaridade - Opcional
```

## UAT 5 - Acessar o portal de admissao como candidato

Objetivo: validar que o candidato consegue acessar o portal pelo link enviado.

Passo a passo:

1. Abra o e-mail recebido pelo candidato.
2. Clique no botao/link de pre-admissao.
3. Confirme que o navegador abriu uma URL semelhante a:

```text
http://10.0.0.80:3000/app/DocumentoAdmissao?tenantId=...&preAdmissaoId=...
```

4. Na tela **Portal de Admissao**, informe o CPF do candidato.
5. Clique em **Acessar Portal**.

Resultado esperado:

- [ ] O link abre sem erro 404.
- [ ] O portal solicita CPF.
- [ ] CPF correto permite acesso.
- [ ] CPF incorreto bloqueia o acesso com mensagem clara.
- [ ] A tela mostra o nome do candidato.

## UAT 6 - Enviar documentos pelo portal de admissao

Objetivo: validar que o candidato consegue enviar os documentos solicitados.

Passo a passo:

1. No portal de admissao, avance ate a etapa de documentos.
2. Confira a lista exibida.
3. Para cada documento obrigatorio, clique no card correspondente.
4. Selecione um arquivo de teste em PDF, JPG ou PNG.
5. Para documentos com frente e verso, envie ambos os lados quando solicitado.
6. Aguarde a confirmacao de upload.
7. Repita para pelo menos estes documentos:

```text
RG
CPF
Comprovante de Residencia
Comprovante Bancario
```

8. Avance para as proximas etapas do portal.
9. Preencha os dados pessoais minimos solicitados.
10. Na etapa final, clique em **Enviar dados** ou **Finalizar**.

Resultado esperado:

- [ ] Cada documento enviado fica marcado como enviado.
- [ ] O sistema aceita PDF, JPG ou PNG.
- [ ] Quando houver validacao por IA, o sistema pode sugerir preenchimento de dados.
- [ ] O portal salva progresso parcial.
- [ ] Ao finalizar, o portal exibe mensagem de sucesso.

Exemplo de mensagem esperada:

```text
Seus documentos e dados foram enviados com sucesso. O RH entrara em contato em breve.
```

## UAT 7 - Analista acompanha documentos recebidos

Objetivo: validar que o RH consegue ver o que o candidato enviou.

Passo a passo:

1. Volte ao sistema como Analista de RH.
2. Acesse **Admissao**.
3. Clique em **Pre-Admissao**.
4. Abra o registro do candidato.
5. Localize a secao **Documentos Recebidos** ou a aba **Arquivos Enviados**.
6. Confira os documentos enviados pelo candidato.
7. Para cada documento, clique em abrir/baixar quando disponivel.

Resultado esperado:

- [ ] Documentos enviados aparecem no registro da pre-admissao.
- [ ] Nome do arquivo aparece corretamente.
- [ ] Tipo de documento aparece corretamente.
- [ ] Data/hora de envio aparece ou pode ser inferida.
- [ ] RH consegue abrir ou baixar o documento.
- [ ] Documentos faltantes continuam visiveis como pendentes.

## UAT 8 - Validar, aprovar ou rejeitar documentos

Objetivo: validar a analise dos documentos pelo RH.

Passo a passo:

1. No registro da pre-admissao, localize um documento recebido.
2. Clique em **Aprovar** no documento.
3. Escolha outro documento para teste de rejeicao.
4. Clique em **Rejeitar**.
5. Informe uma observacao, por exemplo:

```text
Imagem ilegivel. Favor reenviar com melhor qualidade.
```

6. Confirme a rejeicao.

Resultado esperado:

- [ ] Documento aprovado muda para status aprovado/validado.
- [ ] Documento rejeitado exige observacao do RH.
- [ ] Observacao de rejeicao fica registrada.
- [ ] Candidato deve conseguir reenviar o documento rejeitado se o portal ainda estiver acessivel.

## UAT 9 - Conferir status da pre-admissao apos envio do candidato

Objetivo: confirmar que a pre-admissao fica pronta para revisao do RH.

Passo a passo:

1. Acesse **Admissao > Pre-Admissao**.
2. Localize o candidato.
3. Confira o status.
4. Abra o detalhe.
5. Confira dados pessoais, dados bancarios e documentos.

Resultado esperado:

- [ ] Status muda para **Preenchido**, **Aguardando conclusao RH** ou equivalente.
- [ ] Registro indica que foi preenchido pelo candidato.
- [ ] RH consegue editar/complementar dados se necessario.
- [ ] RH consegue seguir para aprovacao ou envio ao TOTVS quando os dados estiverem completos.

## UAT 10 - Validar o que acontece com documentos faltantes

Objetivo: confirmar comportamento quando o candidato nao envia todos os obrigatorios.

Passo a passo:

1. Gere uma nova pre-admissao de teste ou reutilize uma ainda aberta.
2. Acesse o portal como candidato.
3. Envie apenas parte dos documentos obrigatorios.
4. Tente finalizar o portal.
5. Volte para a tela do RH e abra a pre-admissao.

Resultado esperado:

- [ ] O portal deve orientar o candidato sobre documentos obrigatorios faltantes, se houver bloqueio.
- [ ] Se o portal permitir envio parcial, o RH deve visualizar claramente quais documentos faltam.
- [ ] A pre-admissao nao deve seguir para integracao final sem revisao dos dados obrigatorios.

## Criterios de aceite do UAT

O UAT deve ser considerado aprovado quando:

- [ ] A documentacao padrao configurada no Admin e usada na pre-admissao.
- [ ] A Analista consegue iniciar pre-admissao a partir do candidato aprovado/contratado.
- [ ] O sistema cria ou reutiliza uma pre-admissao para o candidato.
- [ ] O sistema gera link de admissao para o candidato.
- [ ] O candidato acessa o portal com CPF.
- [ ] O candidato envia documentos solicitados.
- [ ] O RH visualiza os documentos enviados.
- [ ] O RH consegue aprovar ou rejeitar documentos.
- [ ] O status da pre-admissao permite acompanhamento ate revisao/aprovacao.

## Pontos de atencao para validacao

- O aceite da proposta ainda nao dispara automaticamente a pre-admissao.
- A Analista precisa acionar manualmente o fluxo de admissao.
- A aba **Documentos** do **Portal de Vagas / Meu Perfil** e generica do candidato; ela nao substitui o portal especifico de admissao.
- O checklist de documentos de admissao vem de `Documentacao Padrao`, nao dos documentos livres do perfil.
- O link correto para envio de documentos de admissao e o de **DocumentoAdmissao**.

## Resumo pratico

Fluxo esperado para a Analista:

```text
1. Confirmar proposta aceita.
2. Abrir Hub da Vaga.
3. Localizar candidato.
4. Acionar **Aprovar candidato**.
5. Selecionar CLT ou PJ.
6. Gerar/enviar link ao candidato.
7. Acompanhar em Admissao > Pre-Admissao.
8. Validar documentos enviados.
9. Completar dados faltantes.
10. Seguir para aprovacao/integracao TOTVS.
```
