# Manual funcional — Fluxo de desligamento (Analista de RH)

**Versão:** 1.0  
**Data:** 21/06/2026  
**Público:** Analistas de RH, Especialistas de RH e demais perfis com acesso ao módulo de Desligamentos  
**Sistema:** Portal RH (RenderRH) — menu **Gestão → Desligamentos**

---

## 1. Para que serve este manual

Este documento explica **passo a passo**, com os cliques na tela, como conduzir um desligamento no Portal RH — desde a solicitação até a **conclusão no Portal**, com **entrevista de saída** e rastreabilidade interna (sem integração TOTVS na efetivação).

Use-o para treinar novas analistas, padronizar o atendimento e tirar dúvidas do dia a dia.

---

## 2. Antes de começar

### 2.1 O que você precisa ter

| Item | Detalhe |
|------|---------|
| **Acesso ao menu** | Item **Desligamentos** visível em **Gestão** (pacote *Folha de Pagamento* ativo no tenant) |
| **Permissões** | Ver desligamentos + gerenciar entrevista de saída (perfis Analista/Especialista de RH já recebem isso após atualização do ambiente) |
| **Colaborador cadastrado** | Funcionário ativo no Portal, com **e-mail corporativo** (obrigatório para entrevista de saída) |
| **Dados TOTVS no cadastro** | Código de empresa e estabelecimento do funcionário (referência cadastral; a efetivação não integra com o ERP) |

### 2.2 Duas visões na mesma tela — entenda a diferença

Ao abrir **Gestão → Desligamentos**, no canto superior direito há dois botões:

| Aba | O que mostra | Quem opera aqui |
|-----|--------------|-----------------|
| **TOTVS RM** | Desligamentos **já existentes no RM** (espelho/sincronização). Somente consulta e filtros. | RH para conferência com o RM |
| **Datasul** | **Solicitações internas** do Portal (criadas manualmente ou importadas do RM). É aqui que você **aprova, efetiva, envia entrevista e integra**. | Gestor, RH, aprovadores |

> **Regra prática para a Analista de RH:** quase todo o trabalho operacional acontece na aba **Datasul**. A entrevista de saída está ligada à solicitação Datasul, **não** à linha da aba TOTVS RM.

---

## 3. Visão geral do fluxo (Datasul)

```text
1. Solicitação criada (Gestor ou RH)
      ↓
2. Enviada para aprovação (automático na criação ou manual se rascunho)
      ↓
3. Aprovadores concluem o fluxo → status Aprovada
      ↓
4. RH envia entrevista de saída (manual, por e-mail com link)
      ↓
5. Colaborador responde o questionário pelo link (fora do Portal, no celular ou PC)
      ↓
6. RH acompanha respostas na grid / relatório
      ↓
7. RH efetiva → status Concluída (libera headcount e inativa colaborador no Portal)
      ↓
8. (Opcional) RH gera carta de desligamento
```

A **entrevista de saída é obrigatória antes de efetivar**. O RH envia manualmente em **Enviar entrevista de saída**; só após o colaborador responder aparece a ação **Efetivar desligamento**.

---

## 4. Como acessar Desligamentos

1. Faça login no Portal RH.
2. No menu lateral, abra **Gestão**.
3. Clique em **Desligamentos**.
4. Se a tela abrir na aba **TOTVS RM**, clique no botão **Datasul** (ícone de pessoa saindo) no canto superior direito.

Você verá a listagem **Solicitações de desligamento** com colunas: Código RM, Funcionário, Tipo, Data Desligamento, Status, **Entrevista** (se tiver permissão), Aguardando, Data Criação e menu de ações (**⋯**).

---

## 5. Passo a passo — Criar uma solicitação de desligamento

> Gestores costumam iniciar o fluxo; a Analista de RH também pode criar em nome da área.

1. Na aba **Datasul**, clique em **Nova solicitação** (canto superior direito).
2. Abre o modal **Solicitação de Desligamento** com duas abas: **Identificação** e **Desligamento**.

### Aba Identificação

3. Em **Funcionário \***, digite o nome e selecione o colaborador na lista.
4. Confira os campos automáticos: código do colaborador, empresa, estabelecimento e cargo atual.
5. (Opcional) Informe **Histórico de Medidas Disciplinares?** — Sim / Não / Não informado.
6. Clique na aba **Desligamento**.

### Aba Desligamento

7. Selecione **Tipo de Desligamento** (Sem Justa Causa, Pedido de Demissão, Acordo Mútuo, Justa Causa ou Fim de Contrato).
8. Informe **Data de Desligamento \***.
9. Ajuste **Tipo de Aviso Prévio** (Indenizado, Trabalhado ou Dispensado) e **Dias de Aviso Prévio**, se aplicável.
10. Preencha **Justificativa \*** (motivo detalhado — obrigatório).
11. Marque, se couber:
    - Possui estabilidade de emprego
    - Elegível para recontratação
    - Substituir posição após desligamento
12. (Opcional) Preencha **Observações**.
13. Clique em **Criar solicitação**.

**O que acontece:** o sistema salva e **já envia para aprovação** (status passa a **Pendente**). Não é necessário um segundo clique de “Enviar” na criação.

---

## 6. Passo a passo — Acompanhar e aprovar (quando você for aprovadora)

### Ver quem está aguardando

1. Na grid, observe a coluna **Aguardando** — mostra a etapa pendente e com quem está (pessoa ou fila de perfil).
2. Use o filtro de **centro de custo**, **datas** ou **busca por nome** para localizar a solicitação.

### Assumir etapa em fila (quando aparece “Assumir”)

1. Na linha da solicitação, clique no menu **⋯**.
2. Clique em **Assumir** (ou **Assumir** no menu em lote, se houver checkbox).
3. A etapa fica vinculada a você para aprovar.

### Aprovar, reprovar ou pedir ajustes

1. Clique em **⋯** → **Aprovar** (aprovação rápida), **ou**
2. Clique em **⋯** → **Acompanhamento** para ver a cadeia completa de etapas.

Para reprovar ou solicitar ajustes:

3. **⋯** → **Reprovar** ou **Solicitar ajustes**.
4. Informe a observação no campo que aparecer e confirme.

**Resultado esperado:** com todas as etapas aprovadas, o **Status** muda para **Aprovada** (badge verde).

### Se a solicitação voltou para ajustes

1. O gestor (ou RH) edita: **⋯** → **Editar**.
2. Corrige os dados, salva e usa **Enviar para aprovação** (menu **⋯** ou botão no modal).

---

## 7. Passo a passo — Efetivar o desligamento (RH)

Somente perfis **RH** ou **Administrador** veem esta ação quando o status é **Aprovada** **e** a coluna **Entrevista** está **Respondida**.

1. Confirme que a entrevista de saída foi respondida (coluna **Entrevista** = Respondida; ou **⋯** → **Ver respostas**).
2. Revise tipo, data e justificativa ( **⋯** → **Visualizar** ).
3. Clique em **⋯** → **Efetivar desligamento**.
4. Leia a mensagem: *“A solicitação de desligamento será concluída. Deseja continuar?”*
5. Clique em **Efetivar**.

**O que acontece:**

- Status muda para **Concluída** (badge cinza/verde conforme tema).
- O **headcount da vaga** é liberado no Portal.
- O colaborador passa a **Inativo** no cadastro do Portal.
- **Não** há envio ao Painel Integração TOTVS.

> Se **Efetivar desligamento** não aparecer no menu, a entrevista ainda não foi respondida. Envie o questionário e aguarde o preenchimento.

---

## 8. Passo a passo — Configurar o questionário de entrevista de saída

Faça isso **uma vez por tenant** (ou quando quiser alterar as perguntas), antes do primeiro envio.

1. Na tela **Desligamentos** (aba Datasul), clique em **Configurar questionário** (canto superior), **ou**
2. Acesse **Gestão → Desligamentos** e, pelo menu lateral (se disponível), **Questionário de saída** — rota: `/gestao/desligamentos/entrevista-template`.

Na tela **Questionário de entrevista de saída**:

3. Confira ou edite o **Nome do questionário**.
4. Para cada pergunta: texto, tipo (Texto livre, Escala 1–10 ou Múltipla escolha), se é obrigatória e opções (quando for múltipla escolha).
5. Use **Adicionar pergunta** ou o ícone de lixeira para remover.
6. Clique em **Salvar questionário**.

> Se o tenant ainda não tinha template, o sistema pode criar automaticamente um **questionário padrão** com perguntas de satisfação e motivo de saída no primeiro deploy.

---

## 9. Passo a passo — Enviar a entrevista de saída ao colaborador

Disponível para quem tem permissão de **entrevista de saída**, quando o desligamento está **Aprovada** ou **Concluída**.

1. Localize a linha na aba **Datasul**.
2. Confira a coluna **Entrevista**:
   - **Não enviada** (cinza) — pronta para envio
   - **Sem e-mail** (vermelho) — cadastre e-mail do funcionário antes
   - **Sem questionário** (laranja) — configure o template (passo 8)
3. Clique em **⋯** → **Enviar entrevista de saída**.
4. Confirme em **Enviar entrevista**.

**O que acontece:**

- O colaborador recebe um **e-mail** com link para responder (válido por **30 dias**).
- A coluna **Entrevista** passa a **Enviada** (azul).

### Reenviar o link

Se o colaborador não recebeu ou perdeu o e-mail, e a entrevista ainda **não foi respondida** nem **expirou**:

1. **⋯** → **Reenviar link**.

### Ver respostas

Quando o colaborador concluir o formulário:

1. A coluna **Entrevista** mostra **Respondida** (verde).
2. **⋯** → **Ver respostas** — abre modal com perguntas e respostas.

---

## 10. Passo a passo — Relatório consolidado de entrevistas

1. Na tela Desligamentos, clique em **Relatório entrevistas**, **ou**
2. Acesse **Gestão → Entrevistas de saída** — rota: `/gestao/desligamentos/entrevistas-saida`.

Na tela:

3. Veja os indicadores **Enviadas**, **Respondidas** e **Taxa de resposta**.
4. Filtre por **período de envio** (datas) e clique em **Filtrar**.
5. Na tabela, clique em **Ver respostas** para o detalhe de cada colaborador.

---

## 11. Passo a passo — Gerar carta de desligamento

Com status **Aprovada** (antes ou depois de efetivar, conforme política interna):

1. **⋯** → **Gerar carta**.
2. O sistema gera um documento e abre o **link de download** (válido por cerca de 24 horas).
3. Confira nome, data e tipo de desligamento no arquivo antes de enviar ao colaborador.

---

## 12. Integração TOTVS — desligamento

O fluxo de **solicitação de desligamento (aba Datasul)** **não** utiliza mais o Painel Integração TOTVS. A conclusão ocorre apenas no Portal, pelo passo **Efetivar desligamento** (após entrevista respondida).

A aba **TOTVS RM** continua disponível apenas para **consultar** desligamentos espelhados do RM (importação de leitura).

---

## 13. Desligamentos importados do RM (código na coluna “Código RM”)

Algumas linhas na aba **Datasul** chegam **automaticamente** pela integração com requisições de desligamento do TOTVS RM (coluna **Código RM** preenchida).

**Fluxo recomendado para a Analista:**

1. Identifique a linha com **Código RM** (número na primeira coluna).
2. Confira funcionário, data e tipo.
3. Se ainda estiver pendente de aprovação, conduza o fluxo normal (assumir/aprovar).
4. Quando **Aprovada**, **envie a entrevista de saída**, aguarde resposta e **efetive** — o import **não** dispara entrevista sozinho.

---

## 14. Referência rápida — Status da solicitação (aba Datasul)

| Status na tela | Significado | Próximo passo típico |
|----------------|-------------|----------------------|
| **Rascunho** | Criada mas não enviada | Editar → Enviar para aprovação |
| **Pendente** | Aguardando aprovador | Assumir / Aprovar / Reprovar |
| **Aguarda Fila** | Etapa em fila de perfil (ex.: RH) | Assumir → Aprovar |
| **Aprovada** | Liberada para operação RH | Enviar entrevista → aguardar resposta → Efetivar |
| **Concluída** | Desligamento concluído no Portal | Arquivar; carta/relatório se necessário |
| **Reprovada** | Fluxo encerrado negativamente | Comunicar gestor; copiar solicitação se necessário |
| **Ajustes** | Devolvida para correção | Gestor edita e reenvia |
| **Cancelada** | Solicitação cancelada | Nenhuma ação |

---

## 15. Referência rápida — Coluna Entrevista

| Badge | Significado | Ação |
|-------|-------------|------|
| **Não enviada** | Nunca enviada ou expirada sem novo envio | Enviar entrevista de saída |
| **Enviada** | E-mail disparado; aguardando resposta | Reenviar link (se necessário) |
| **Respondida** | Colaborador concluiu o formulário | Ver respostas |
| **Expirada** | Link de 30 dias venceu | Enviar entrevista de saída (novo ciclo) |
| **Sem e-mail** | Funcionário sem e-mail no cadastro | Atualizar cadastro em **Funcionários** |
| **Sem questionário** | Template não configurado | Configurar questionário |

---

## 16. Outras ações úteis no menu ⋯

| Ação | Quando usar |
|------|-------------|
| **Visualizar** | Somente leitura (aprovada, reprovada, integração, concluída) |
| **Editar** | Rascunho ou ajustes solicitados |
| **Copiar solicitação** | Criar nova a partir de uma existente (vira rascunho) |
| **Acompanhamento** | Ver timeline de aprovações |
| **Exportar** | Botão **Exportar** gera CSV da listagem |
| **Cancelar solicitação** | Enquanto pendente ou em ajustes |
| **Excluir** | Apenas **Rascunho** |

---

## 17. Papel do colaborador (entrevista de saída)

O colaborador **não acessa o Portal RH** para responder.

1. Recebe e-mail **“Entrevista de saída — sua opinião é importante”**.
2. Clica no botão **Responder entrevista de saída**.
3. Abre página pública no navegador (funciona no celular).
4. Responde as perguntas e envia **uma única vez** (não pode refazer).
5. Se o link expirou ou já respondeu, a página informa a situação.

---

## 18. Problemas frequentes e o que fazer

| Problema | Causa provável | Solução |
|----------|----------------|---------|
| Menu Desligamentos com cadeado | Pacote Folha inativo no tenant | Solicitar ativação do pacote ao administrador |
| “Configure o questionário…” ao enviar | Template não salvo | Passo 8 — salvar questionário |
| “Sem e-mail corporativo” | Funcionário sem e-mail | Cadastro → Funcionários → editar e-mail |
| Entrevista não sai ao efetivar | Comportamento esperado | Enviar entrevista **antes** de efetivar (passo 9) |
| Não vejo **Efetivar** | Entrevista não respondida, perfil sem RH/Admin ou status ≠ Aprovada | Enviar questionário, aguardar resposta; verificar perfil e status |
| Erro ao efetivar | Entrevista ainda não respondida | Coluna Entrevista = Respondida antes de efetivar |
| Coluna Entrevista não aparece | Sem permissão `entrevista-saida` | Administrador ajusta perfil/menus |

---

## 19. Checklist da Analista de RH (por desligamento)

- [ ] Solicitação **Aprovada** com data e tipo conferidos  
- [ ] Questionário de saída **configurado** (primeira vez ou revisado)  
- [ ] **Entrevista enviada** e coluna mostra Enviada → **Respondida**  
- [ ] Respostas revisadas (modal ou relatório)  
- [ ] **Efetivada** (status **Concluída** no Portal)  
- [ ] **Carta** gerada, se aplicável  
- [ ] Headcount liberado e colaborador **Inativo** no Portal (conferência)

---

## 20. Contatos e escalonamento

- **Dúvidas de permissão ou menu:** Administrador do tenant / TI  
- **Falhas de processo ou permissão:** Administrador do tenant / TI  
- **Melhorias no questionário ou fluxo:** Product Owner de RH  

---

*Documento alinhado ao fluxo implementado em jun/2026 (conclusão 100% Portal, entrevista obrigatória antes de efetivar).*
