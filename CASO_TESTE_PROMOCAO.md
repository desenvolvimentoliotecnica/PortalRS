# Caso de Teste — Promoção / Movimentação de Pessoa → Integração TOTVS HCM

**Versão:** 1.0  
**Data:** 2026-04-20  
**Objetivo:** Validar o fluxo end-to-end de solicitação de promoção ou movimentação de colaborador com integração ao TOTVS HCM.

---

## Cenário

> Um gestor solicita a promoção de um colaborador. O admin aprova a solicitação. O RH revisa, efetiva a movimentação e envia para o TOTVS HCM. Carta de promoção é gerada. Sistema confirma atualização do cargo e salário no TOTVS HCM.

---

## Perfis necessários

| Perfil | Papel no teste |
|--------|---------------|
| **Gestor** | Cria e submete a solicitação de promoção |
| **Administrador** | Assume e aprova a solicitação |
| **RH** | Revisa, efetiva a movimentação, gera carta e acompanha integração |

---

## Pré-condições

- [ ] Colaborador alvo da promoção cadastrado e ativo no sistema
- [ ] Novo cargo configurado no sistema (cargo de destino)
- [ ] Usuários de teste com perfis corretos ativos

---

## Passo 1 — Acessa como usuário Gestor e cria solicitação de promoção

**Perfil:** Gestor

**Case de Sucesso:**
1. Solicitação de promoção criada com status **Rascunho**
2. Ao submeter, gerada pendência de aprovação para o superior direto

**Observação:** Preencher: colaborador, novo cargo, nova área (se houver), novo salário, data efetiva e motivo (Mérito, Promoção, Reclassificação de Cargo, Transferência de CC, Promoção + Transferência ou Outros).

---

## Passo 2 — Acessa com o usuário Administrador e aprova a solicitação de promoção

**Perfil:** Administrador

**Case de Sucesso:**
1. Admin assume a solicitação na fila de pendências
2. Aprova a solicitação — status muda para **Aprovada**

**Observação:** Admin pode solicitar ajustes (status: Ajustes Necessários) ou reprovar com observação. Gestor recebe retorno para corrigir e resubmeter.

---

## Passo 3 — Acessa com o usuário do RH e efetiva a movimentação

**Perfil:** RH

**Case de Sucesso:**
1. RH revisa os dados da promoção (cargo anterior, novo cargo, salário atual e novo, data efetiva)
2. RH clica em **Efetivar** — status muda para **Em Integração**
3. Registro aparece no Painel de Integração (tipo: Movimentação)

**Observação:** Após efetivar, o sistema prepara o payload para o TOTVS HCM com os campos: `novoCargoNome`, `novoSalario`, `dataEfetiva`, `motivoMovimentacao`, `unidadeLotacao`, `centroCusto`.

---

## Passo 4 — RH gera carta de promoção

**Perfil:** RH

**Case de Sucesso:**
1. RH clica em **Gerar Carta de Promoção**
2. Documento DOCX gerado com os dados da movimentação
3. Link de download disponível por 24h

**Observação:** Verificar se os dados do colaborador, novo cargo e data estão corretos no documento gerado.

---

## Passo 5 — Acessa o Painel de Integração e verifica o resultado

**Perfil:** RH / Administrador

**Case de Sucesso:**
1. Painel de Integração exibe a movimentação com resultado **Sucesso**
2. Status muda para **Concluída**
3. TOTVS HCM atualiza: cargo, salário e área do colaborador

**Observação:** Validar payload enviado ao TOTVS HCM (procedure `apisftransferencia.p`). Campos: `cdnFuncionario`, `cdnEmpresa`, `cdnEstab`, `dataEfetiva`, `novoSalario`.

---

## Passo 6 — Cenário de Falha: integração da promoção retorna erro

**Perfil:** RH / Administrador

**Case de Sucesso:**
1. Painel exibe movimentação com status **Falha** e mensagem de erro do TOTVS HCM
2. RH identifica e corrige o dado incorreto (ex: código do cargo inválido) e clica em **Reprocessar**
3. Resultado **Sucesso** retorna e status muda para **Concluída**

**Observação:** Falha definitiva requer ajuste manual no TOTVS HCM. Documentar ocorrência para auditoria.

---

## Resumo de Status

| Passos | Entidade | Status Final Esperado |
|--------|----------|-----------------------|
| 1–2 | SolicitacaoPromocao | **Aprovada** |
| 3 | SolicitacaoPromocao | **Em Integração** |
| 4 | Carta | Documento DOCX gerado |
| 5 | SolicitacaoPromocao | **Concluída** · Cargo/salário atualizados no TOTVS HCM |
| 6 | SolicitacaoPromocao | Falha → Reprocessada → **Concluída** |

---

## Dados de Teste Sugeridos

```
Gestor:              gestor.qa@empresa.com
Administrador:       admin.qa@empresa.com
RH:                  rh.qa@empresa.com
Colaborador:         maria.teste.qa@empresa.com
Cargo atual:         Analista de Marketing Júnior
Novo cargo:          Analista de Marketing Pleno
Salário atual:       R$ 3.000,00
Novo salário:        R$ 4.500,00
Motivo:              Promoção
Data Efetiva:        01/05/2026
```
