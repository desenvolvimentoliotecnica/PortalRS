# Tasks

Quadro operacional curto para acompanhamento entre IAs/IDEs.

Status:
- `[ ]` pendente
- `[~]` em andamento
- `[x]` concluído
- `[!]` bloqueado

---

## Em andamento

- _(nenhuma)_

## Próximas

- [ ] **Painel de Solicitações** — aguardando decisão do arquiteto (B1 transversal / B2 Admin / B3 dividir por pacote)
- [ ] Épicos de cada pacote (ver `backlog.md` → seção "Épicos estratégicos"). Iniciar por R&S conforme visão §6.3
- [ ] Cobertura de testes para `TenantPackageService` + cenários de composição pacote↔módulo em `TenantModuleServiceTests`
- [ ] UI Owner: expor gestão de pacotes junto com a seção de módulos em `TenantDetailScreen.tsx`

## Concluídas (sessão atual)

- [x] **Tarefa 2 — Camada de entitlement em dois níveis**: `PackageCatalog` + `TenantPackage` + `TenantPackageService` + endpoints Owner + migration `AddTenantPackages`. `TenantModuleService` integrado (regras de composição). Build e 425/425 testes verdes. Fix auxiliar: removido diretório fantasma de Inbox que quebrava glob de resx e adicionado `global.json` pinando SDK 8.0.420
- [x] **Tarefa 1 — Cadastros órfãos resolvidos** (7 de 8): Pessoas, Áreas mantidos em Core; Bloqueio de Pessoa subordinado a Pessoas; Humor e Resumo Atividades → Feedback/GP; Agenda e Entrada → R&S. Painel de Solicitações pendente com 3 opções apresentadas ao arquiteto
- [x] Capturar visão arquitetural TO-BE do sistema em entrevista estruturada e consolidar em `knowledge-base/visao-arquitetural.md` (princípios, modelo em camadas, taxonomia de pacotes/módulos/core, conceitos de domínio novos, gap vs sistema atual, backlog estratégico)
- [x] Ajustar visão para tratar Portal MVC como **refatoração/migração para Next.js**, não descontinuação simples
- [x] Preparar handoff para Claude Code com documento dedicado e contexto de retomada (`knowledge-base/handoff-claude-code-2026-04-17.md`)
- [x] Cruzar blocos/abas da sidebar com módulos opcionais e mapear impacto de desativação por tenant
- [x] Auditar coerência módulo x sidebar e registrar gaps de mapeamento de permissões no Knowledge Base
- [x] Documentar todos os blocos da sidebar do tenant para Knowledge Base (`knowledge-base/sidebar-blocos-e-abas.md`)
- [x] Ajustar modais de logs para visualização horizontal ampliada (largura maior e menos quebra de linha)
- [x] Corrigir responsividade dos modais de logs (quebra de texto/colunas para evitar arraste horizontal)
- [x] Diagnosticar erro persistente de logs no Owner após patch e confirmar causa operacional (API antiga em memória)
- [x] Reiniciar API com build atualizado e validar endpoints de logs do Owner com token (`200` em `transactions/summary/operational-logs`)
- [x] Consolidar documentação completa para handoff (agent, documentação, habilidades, tasks, backlog, diário e changelog)
- [x] Corrigir erro "Erro ao carregar logs" no Owner criando proxies de logs no `OwnerController` (`/config/logs/*` e `/config/operational-logs/*`)
- [x] Mapear stack, estrutura e comandos de teste do projeto
- [x] Validar suite completa da API (425 testes)
- [x] Validar blocos alterados (`Modules`, `Logging`, `Vagas`) com 100% verde
- [x] Ajustar `AwsSettingsServiceTests` para escopo atual de `OwnerAwsSettings`
- [x] Reduzir falhas totais da suite de 15 para 7
- [x] Corrigir regressões em `FuncionarioService` (validação de e-mail duplicado em create/update)
- [x] Alinhar `PreAdmissaoWorkflowTests` ao fluxo atual (submit idempotente + aprovação com campos TOTVS)
- [x] Alinhar `SolicitacaoVagaServiceTests` ao workflow por etapas de aprovação
- [x] Zerar falhas da suite `RHPortal.Api.Tests` (425/425)
- [x] Gerar evidência de estabilização em `test-evidence/2026-04-17_estabilizacao_suite_api.md`
- [x] Subir dependências para bateria (`API`, `AI`, `Web MVC`) e executar `__scripts__/test-battery.sh`
- [x] Corrigir portabilidade do parser do script (`grep -P` -> extração compatível com macOS)
- [x] Registrar evidência da bateria em `test-evidence/2026-04-17_test-battery.md`
- [x] Resolver 5 falhas da bateria (rotas `Dashboard` + regra de aceitação `200|403` para endpoints com permissão específica)
- [x] Reexecutar bateria com resultado final sem falhas (59 total, 50 pass, 0 fail, 9 skip)
