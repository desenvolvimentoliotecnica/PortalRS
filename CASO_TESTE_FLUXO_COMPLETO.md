# Caso de Teste — Fluxo Admissão: Solicitação de Vaga → Integração TOTVS HCM

**Versão:** 1.1  
**Data:** 2026-04-20  
**Objetivo:** Validar o fluxo end-to-end de abertura de vaga por headcount, recrutamento, pré-admissão e integração.

---

## Cenário

> Um gestor solicita uma **nova vaga como aumento de headcount**. O admin captura e aprova a solicitação. O RH define o headcount, completa e publica a vaga. O RH adiciona o candidato, aprova e gera o link de pré-admissão. O colaborador preenche seus dados. O RH valida, aprova e envia para o TOTVS HCM.

---

## Perfis necessários

| Perfil | Papel no teste |
|--------|---------------|
| **Gestor** | Cria e submete a solicitação de vaga |
| **Administrador** | Assume e aprova a solicitação |
| **RH (Recrutamento & Seleção)** | Define headcount, publica vaga, gerencia candidato, valida e aprova pré-admissão, envia integração |
| **Colaborador** | Preenche o formulário de pré-admissão via portal |

---

## Pré-condições

- [ ] Todos os usuários de teste cadastrados e com acesso ao sistema
- [ ] Tenant de QA disponível com seed de dados básicos (departamentos, áreas, cargos)
- [ ] E-mail do colaborador de teste acessível (para receber o link de pré-admissão)

---

## Passo 1 — Acessa como usuário Gestor e cria nova vaga

**Perfil:** Gestor

**Case de Sucesso:**
1. A vaga deve ser criada e gerada uma pendência de aprovação para o gestor direto (diretoria)
2. Na tela de Painel de RH / Quadro de Vagas deve ser aumentado um quadro de provisionamento pendente

**Observação:** Tipo de solicitação: Nova Vaga. Preencher título, área, unidade, quantidade de posições e motivo da requisição.

---

## Passo 2 — Acessa com o usuário Administrador e aprova a solicitação

**Perfil:** Administrador

**Case de Sucesso:**
1. Assume a tarefa como usuário Administrador e aprova a solicitação de vaga

**Observação:** O admin deve localizar a solicitação na fila de pendências e clicar em Assumir → Aprovar.

---

## Passo 3 — Acessa com o usuário do RH e define o Headcount

**Perfil:** RH

**Case de Sucesso:**
1. Assume a tarefa com o usuário do RH e preenche os dados da vaga (Headcount)
2. Sistema registra a decisão de headcount e avança o status da solicitação

**Observação:** Nesta etapa o headcount deve ser definido pelo usuário do RH: o que acontece (se provisória ou se cria nova estrutura — Aumento Definitivo).

---

## Passo 4 — Acessa com o usuário do RH e publica a vaga

**Perfil:** RH

**Case de Sucesso:**
1. A vaga é publicada e passa para o status **Aberta**
2. Canais de divulgação configurados ficam ativos (Site de Carreiras, LinkedIn etc.)

**Observação:** RH deve completar os campos obrigatórios da vaga (salário, modalidade, requisitos, benefícios) antes de publicar.

---

## Passo 5 — Acessa com o usuário do RH, adiciona o colaborador e gera o link

**Perfil:** RH

**Case de Sucesso:**
1. Candidato adicionado e vinculado à vaga com status **Novo**
2. Candidato aprovado no processo seletivo (status: **Aprovado**)
3. Link de pré-admissão gerado e enviado por e-mail ao colaborador

**Observação:** O RH deve adicionar o candidato manualmente, aprová-lo e em seguida criar a pré-admissão e gerar o link de acesso.

---

## Passo 6 — Acessa com o link do colaborador e registra os dados

**Perfil:** Colaborador (via portal)

**Case de Sucesso:**
1. Colaborador acessa o portal com o CPF
2. Preenche dados pessoais, endereço, dados bancários e contato de emergência
3. Realiza upload dos documentos solicitados
4. Finaliza o preenchimento — status muda para **Preenchido**

**Observação:** Podemos focar em duas etapas: (A) processo digitado normalmente pelo colaborador, e (B) processo com dados pré-preenchidos pelo RH.

---

## Passo 7 — Acessa com o usuário do RH e revisa a pré-admissão

**Perfil:** RH

**Case de Sucesso:**
1. RH valida os documentos enviados individualmente
2. RH revisa e aprova os dados da pré-admissão — status muda para **Aprovada**
3. Pré-admissão enviada para integração — status muda para **Integrada**
4. Matrícula gerada com sucesso no TOTVS HCM

**Observação:** Verificar se as validações automáticas passam (CPF, CEP, banco). Conferir no Painel de Integração se o resultado retornou Sucesso.

---

## Passo 8 — Acessa com o usuário do RH: valida documentos do colaborador

**Perfil:** RH

**Case de Sucesso:**
1. RH abre cada documento enviado pelo colaborador
2. Valida individualmente cada documento (RG, CPF, Comprovante de Residência, Dados Bancários)
3. Documentos marcados como **Validado** pelo RH

**Observação:** Validar se o sistema permite rejeitar um documento individualmente e solicitar novo envio ao colaborador.

---

## Passo 9 — Acessa com o usuário do RH: aprova a pré-admissão

**Perfil:** RH

**Case de Sucesso:**
1. RH revisa todos os dados pessoais, endereço e dados bancários
2. Validações automáticas passam: CPF válido, CEP válido, Banco/Conta válidos
3. RH clica em **Aprovar Pré-Admissão**
4. Status muda para **Aprovada**

**Observação:** Se alguma validação falhar (ex: CPF inválido), o sistema deve exibir mensagem de erro específica e bloquear a aprovação.

---

## Passo 10 — Acessa com o usuário do RH: preenche campos de integração e envia

**Perfil:** RH

**Case de Sucesso:**
1. RH acessa a pré-admissão aprovada e preenche os campos obrigatórios de integração:
   - Código do estabelecimento
   - Cargo / Função
   - Data de admissão
   - Salário
   - Tipo de contratação
2. RH envia para integração (TOTVS HCM)
3. Status muda para **Em Integração**

**Observação:** Verificar se campos obrigatórios de integração estão todos preenchidos antes de habilitar o botão de envio.

---

## Passo 11 — Acessa o Painel de Integração e verifica o resultado

**Perfil:** RH / Administrador

**Case de Sucesso:**
1. No Painel de Integração, a pré-admissão aparece com resultado **Sucesso**
2. Status muda para **Integrada**
3. Matrícula gerada e exibida no registro do colaborador no TOTVS HCM

**Observação:** `IntegracaoResultado = Sucesso`, campo `MatriculaRH` preenchido. Validar também o payload enviado (campos fp1440 + fp1500).

---

## Passo 12 — Cenário de Falha: integração retorna erro, reprocessar pelo Painel

**Perfil:** RH / Administrador

**Case de Sucesso:**
1. Painel de Integração exibe a pré-admissão com status **Falha**
2. RH identifica o motivo do erro na mensagem de retorno
3. RH corrige o dado incorreto (se necessário) e clica em **Reprocessar**
4. Novo envio é realizado e resultado **Sucesso** retorna

**Observação:** Registros com falha há mais de 2 dias aparecem na aba Reconciliação. Falha definitiva (tentativas esgotadas) requer intervenção manual.

---

## Resumo de Status

| Passos | Entidade | Status Final Esperado |
|--------|----------|-----------------------|
| 1–2 | SolicitacaoVaga | Aprovada |
| 3–4 | Vaga | **Aberta** |
| 5 | Candidato / PreAdmissao | Candidato Aprovado · PreAdmissao Enviada |
| 6 | PreAdmissao | **Preenchida** |
| 7–9 | PreAdmissao | **Aprovada** |
| 10–11 | PreAdmissao | **Integrada** · Matrícula gerada no TOTVS HCM |
| 12 | PreAdmissao | Falha → Reprocessada → **Integrada** |

---

## Dados de Teste Sugeridos

```
Gestor:          gestor.qa@empresa.com
Administrador:   admin.qa@empresa.com
RH:              rh.qa@empresa.com
Colaborador:     joao.teste.qa@gmail.com  |  CPF: 000.000.000-00
Cargo:           Analista de Marketing Júnior
Área:            Marketing
Salário:         R$ 3.000,00 – R$ 5.000,00
Data Admissão:   01/05/2026
```
