# Requisições de vaga com origem no RM

## O que mudou

O Portal passa a suportar, por configuração de tenant, o modo em que requisições de vaga não são criadas nem aprovadas internamente. Nesse modo, as requisições vêm aprovadas do RM, são sincronizadas para o Portal como `SolicitacaoVaga` rastreável e materializam uma `Vaga` em rascunho, pronta para distribuição pela Especialista de RH para uma Analista de RH.

A flag de controle é `TenantConfiguracao.RequisicoesVagaOrigemRm`.

## Comportamento por flag

Flag desligada:

- O fluxo legado permanece ativo.
- Gestores podem criar, editar e enviar requisições no Portal.
- Aprovações internas do Portal continuam disponíveis.

Flag ligada:

- Ações de criar, editar, copiar, reenviar e aprovar requisições de vaga ficam ocultas na tela de solicitações.
- O backend também bloqueia essas ações para evitar uso por chamada direta de API.
- A listagem de solicitações continua visível para rastreabilidade.
- A Especialista de RH continua podendo distribuir a vaga/requisição para uma Analista de RH.
- A sincronização RM importa apenas requisições cujo `CODSTATUS` esteja mapeado para `Aprovada` ou `Concluida`.

## Pontos técnicos

- Configuração e DTOs: `RHPortal.Api/RHPortal.Api/Application/TenantConfiguracao/TenantConfiguracaoService.cs`
- Entidade: `RHPortal.Api/RHPortal.Api/Domain/Entities/TenantConfiguracao.cs`
- Migration: `RHPortal.Api/RHPortal.Api/Migrations/20260529173321_AddRequisicoesVagaOrigemRmFlag.cs`
- Importação RM: `RHPortal.Api/RHPortal.Api/Application/SolicitacoesVaga/SolicitacaoVagaRmImportService.cs`
- Endpoint manual: `POST /api/rm/solicitacao-vaga/importar-aprovadas`
- Sync agendado: `RmSolicitacaoStatusSyncHostedService` chama a importação antes do sync de status quando a flag está ligada.
- UI de configuração: `LioTecnica.Web.Next/src/features/admin/tenant-configuracao/TenantConfiguracaoScreen.tsx`
- UI de solicitações: `LioTecnica.Web.Next/src/features/gestao/solicitacoes/SolicitacoesScreen.tsx`
- UAT Playwright: `LioTecnica.Web.Next/tests/e2e/requisicoes-rm-origem-flag.spec.ts`

## Idempotência da importação

A importação usa o vínculo RM:

```text
TIPO_REQUISICAO|CODCOLREQUISICAO|IDREQ
```

Esse valor é gravado em `SolicitacaoVaga.RmRequisicaoCodigo`. Em execuções repetidas, o serviço atualiza a solicitação já existente e não cria vaga duplicada se `VagaId` já estiver preenchido.

## Reversão operacional

Para voltar imediatamente ao fluxo legado sem deploy:

1. Acessar `Admin > Configurações > Recrutamento`.
2. Desligar `Requisições de vaga vêm aprovadas do RM`.
3. Salvar.

Com a flag desligada, o Portal volta a exibir criação/edição/aprovação interna de requisições.

## Reversão por Git

A implementação deve ser commitada em blocos pequenos:

1. Flag/migration/configuração.
2. Serviço backend de importação RM.
3. UI de ocultação e ajuste de origem RM.
4. UAT Playwright e documentação.

Se precisar reverter após push/PR, usar `git revert` em ordem inversa dos commits. Não usar `git reset --hard` nem reescrever histórico de branch compartilhada.

## Reversão de banco

A migration adiciona uma coluna com `ADD COLUMN IF NOT EXISTS` e default `false`. Depois de aplicada em produção, não remover a migration do histórico.

Se algum dia for necessário remover a coluna, criar uma nova migration específica de remoção. Para rollback funcional, preferir desligar a flag.

## Teste UAT

O teste Playwright focado valida:

- ativação da flag via API de configuração;
- ocultação do botão `Nova posição`;
- manutenção da listagem/rastreabilidade;
- disponibilidade da ação de distribuição para Analista RH;
- endpoint de importação RM respondendo com a flag ativa;
- geração de relatório HTML, screenshots e vídeo em `LioTecnica.Web.Next/tests/uat-automatizados/`.

Comando:

```powershell
cd LioTecnica.Web.Next
$env:PLAYWRIGHT_UAT_VIDEO='1'
pnpm exec playwright test tests/e2e/requisicoes-rm-origem-flag.spec.ts --headed
```
