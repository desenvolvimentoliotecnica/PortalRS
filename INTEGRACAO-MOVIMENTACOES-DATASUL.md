# Integração Movimentações de Pessoal — Portal RH → Datasul

Promoções, transferências, reclassificações e mudanças de área/unidade.

## Autenticação
```http
POST /api/auth/login
{ "email": "...", "password": "...", "tenantId": "..." }
```
Use `Authorization: Bearer {token}` em todas as chamadas.

---

## 1. Buscar pendentes
```http
GET /api/integracao-totvs/painel?tipo=4
```
Itens com `integracaoResultado: null` ainda não processados.

## 2. Detalhes do registro
```http
GET /api/integracao-totvs/4/{id}
```

Campos relevantes para o Datasul:

| Campo | Descrição |
|---|---|
| `funcionarioId` | ID do funcionário no Portal |
| `dataEfetiva` | Data da movimentação (`YYYY-MM-DD`) |
| `motivoMovimentacao` | Tipo (ver tabela abaixo) |
| `cargoAtualNome` / `novoCargoNome` | Cargo antes e depois |
| `areaAtualNome` / `novaAreaNome` | Área antes e depois |
| `novaUnidadeNome` | Unidade após (se transferiu) |
| `unidadeLotacaoNome` | Unidade de lotação (`cod_unid_lotac`) |
| `centroCustoNome` | Centro de custo |
| `novoSalario` | Novo salário base (R$) |
| `novaRemuneracao` | Nova remuneração total (R$) |
| `horarioProposto` | Horário de trabalho |

**Tipos de movimentação (`motivoMovimentacao`)**

| Valor | Nome |
|---|---|
| `Merito` | Mérito |
| `Promocao` | Promoção |
| `ReclassificacaoCargo` | Reclassificação de Cargo |
| `TransferenciaCC` | Transferência de CC |
| `PromocaoTransferenciaBase` | Promoção + Transferência |
| `Outros` | Outros |

## 3. Buscar códigos Datasul do funcionário
```http
GET /api/funcionarios/{funcionarioId}
```
Campos: `cdnFuncionario`, `cdnEmpresa`, `cdnEstab`

## 4. Reportar resultado
```http
POST /api/integracao-totvs/4/{id}/resultado
{ "resultado": 1, "mensagem": "Protocolo 00789" }
```
`1` = Sucesso → `Concluida` · `2` = Falha → mantém `EmIntegracao`

---

> Procedure Datasul: `apisftransferencia.p`  
> Swagger: `http://localhost:5056/swagger`
