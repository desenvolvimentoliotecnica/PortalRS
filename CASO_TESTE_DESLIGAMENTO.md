# Caso de Teste — Desligamento → Integração TOTVS HCM

**Versão:** 1.0  
**Data:** 2026-04-20  
**Objetivo:** Validar o fluxo end-to-end de solicitação de desligamento de colaborador com integração ao TOTVS HCM.

---

## Cenário

> Um gestor solicita o desligamento de um colaborador. O admin aprova a solicitação. O RH efetiva o desligamento e envia para o TOTVS HCM. Carta de desligamento é gerada. Sistema confirma a baixa do colaborador no TOTVS HCM.

---

## Perfis necessários

| Perfil | Papel no teste |
|--------|---------------|
| **Gestor** | Cria e submete a solicitação de desligamento |
| **Administrador** | Assume e aprova a solicitação |
| **RH** | Revisa, efetiva o desligamento, gera carta e acompanha integração |

---

## Pré-condições

- [ ] Colaborador alvo do desligamento cadastrado e ativo no sistema
- [ ] Usuários de teste com perfis corretos ativos
- [ ] Data de desligamento deve ser uma data futura válida

---

## Passo 1 — Acessa como usuário Gestor e cria solicitação de desligamento

**Perfil:** Gestor

**Case de Sucesso:**
1. Solicitação de desligamento criada com status **Rascunho**
2. Ao submeter, gerada pendência de aprovação para o superior direto

**Observação:** Preencher: colaborador, tipo de desligamento (Pedido de Demissão, Demissão sem Justa Causa, Demissão com Justa Causa, Aposentadoria etc.), data prevista e motivo detalhado.

---

## Passo 2 — Acessa com o usuário Administrador e aprova o desligamento

**Perfil:** Administrador

**Case de Sucesso:**
1. Admin assume a solicitação na fila de pendências
2. Aprova o desligamento — status muda para **Aprovada**

**Observação:** Admin pode solicitar ajustes ou reprovar com observação justificada. Gestor recebe retorno para corrigir e resubmeter.

---

## Passo 3 — Acessa com o usuário do RH e efetiva o desligamento

**Perfil:** RH

**Case de Sucesso:**
1. RH revisa os dados do desligamento (tipo, data, motivo)
2. RH clica em **Efetivar** — status muda para **Em Integração**
3. Registro aparece no Painel de Integração (tipo: Desligamento)

**Observação:** Verificar se a data de desligamento está correta antes de efetivar. Após efetivar, não é possível reverter sem intervenção manual no TOTVS HCM.

---

## Passo 4 — RH gera carta de desligamento

**Perfil:** RH

**Case de Sucesso:**
1. RH clica em **Gerar Carta de Desligamento**
2. Documento DOCX gerado com os dados do colaborador e tipo de desligamento
3. Link de download disponível por 24h

**Observação:** Verificar se nome do colaborador, data de desligamento e tipo estão corretos no documento gerado.

---

## Passo 5 — Acessa o Painel de Integração e verifica o resultado

**Perfil:** RH / Administrador

**Case de Sucesso:**
1. Painel de Integração exibe o desligamento com resultado **Sucesso**
2. Status muda para **Concluída**
3. Colaborador baixado no TOTVS HCM (data de saída registrada)

**Observação:** Confirmar que o colaborador não aparece mais como ativo no TOTVS HCM após a integração.

---

## Passo 6 — Cenário de Falha: integração do desligamento retorna erro

**Perfil:** RH / Administrador

**Case de Sucesso:**
1. Painel exibe desligamento com status **Falha** e mensagem de erro do TOTVS HCM
2. RH identifica e corrige o dado incorreto e clica em **Reprocessar**
3. Resultado **Sucesso** retorna e status muda para **Concluída**

**Observação:** Falha definitiva requer baixa manual no TOTVS HCM. Documentar ocorrência para auditoria e compliance.

---

## Resumo de Status

| Passos | Entidade | Status Final Esperado |
|--------|----------|-----------------------|
| 1–2 | SolicitacaoDesligamento | **Aprovada** |
| 3 | SolicitacaoDesligamento | **Em Integração** |
| 4 | Carta | Documento DOCX gerado |
| 5 | SolicitacaoDesligamento | **Concluída** · Colaborador baixado no TOTVS HCM |
| 6 | SolicitacaoDesligamento | Falha → Reprocessada → **Concluída** |

---

## Dados de Teste Sugeridos

```
Gestor:              gestor.qa@empresa.com
Administrador:       admin.qa@empresa.com
RH:                  rh.qa@empresa.com
Colaborador:         pedro.teste.qa@empresa.com
Tipo desligamento:   Demissão sem Justa Causa
Data Desligamento:   30/04/2026
Motivo:              Reestruturação do departamento
```
