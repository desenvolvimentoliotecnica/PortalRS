# Paridade formulário Requisição de Pessoal (Portal) × RM — checklist

Legendas: ✅ feito neste codebase | 🔲 pendente | ⚠️ parcial

## Identificação e estrutura (janela “Identificação”)

- ✅ Empresa, **Filial**, **Seção** (rótulos alinhados ao vocabulário RM; dados: empresa / unidade / centro de custo).
- ✅ **Função** (lista PFUNCAO da equipe do requisitante).
- ✅ **Cargo** (`JobPositionId`) — obrigatório quando **Aumento de quadro**.
- ✅ **Faixa salarial** — obrigatória no portal antes de salvar (**mín. e máx.**), alinhada ao envio ao RM.
- ✅ Lotação removida do fluxo de nova requisição (`unidadeLotacaoId: null`).
- ✅ **Aumento de quadro (`TipoSolicitacao = 2`)** no `SolicitacaoForm`: tipo + **Justificativa** + **Cargo** + **JSON requisitos**; API expõe `RequisitosDetalhadosJson`.

## Fluxo envio ao RM (integração já modelada)

- ✅ **`SolicitacaoVargaRmIntegracaoService`**: quando a solicitação está apta (**Aprovada** ou estados de reprocessamento), chama **`IRmRequisicaoCreateClient`** e grava `RmRequisicaoCodigo`, `RmCodStatus`, mensagens/tentativas.
- ✅ **`RmRequisicaoPayloadBuilder.BuildResumoJson`**: inclui **`FaixaSalarialMin` / `FaixaSalarialMax`** no payload de resumo transmitido ao client (audit trail + entrada para cliente real/stub).
- ✅ **`EnsureCanBuild`**: exige **faixa min e max** válidas antes de qualquer envio ao RM.
- ✅ **`SolicitacaoVagaRmCodStatusSyncService`**: sincronização de **`CODSTATUS`** com o RM quando já existe código de requisição.
- ⚠️ **Cliente RM “real” (HTTP/API TOTVS)**: na configuração padrão o app usa **`RmRequisicaoCreate:Mode` = stub ou disabled**; o fluxo ponta-a-ponta existe no código, mas a **implementação produtiva** do client (substituir stub) é o passo que falta para gravação de verdade no RM além de dev/staging.

## Frontend — UX

- ✅ Aba Identificação: `LB` (Filial / Seção / Função…).
- ✅ Aba Horário — turnos + legado.

## Como usar este arquivo

Marcar itens quando forem implementados e referenciar PR/commit.

## Ver também

- **`docs/gestores-hierarquia-e-aprovacao-requisicao-vaga.md`** — decisão futura: tela Admin “gestores” vs organograma RM vs `GestorDiretoId` no workflow de requisição de vaga.
