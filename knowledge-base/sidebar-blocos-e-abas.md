# Knowledge Base — Sidebar do Tenant

Mapa funcional dos blocos da sidebar do tenant no `LioTecnica.Web.Next`, com objetivo de onboarding e operação.

## Escopo e fonte de verdade

- Estrutura e agrupamento da sidebar:
  - `LioTecnica.Web.Next/src/features/navigation/SidebarNavClient.tsx`
  - `LioTecnica.Web.Next/src/features/navigation/recruitmentNavigation.ts`
- Manifesto de itens/permissões:
  - `LioTecnica.Web.Next/src/features/navigation/permissionManifest.ts`
- Catálogo de módulos comerciais:
  - `RHPortal.Api/RHPortal.Api/Infrastructure/Modules/ModuleCatalog.cs`

## Regras gerais da sidebar

- A sidebar é montada por permissões do usuário (`permissionManifest`).
- Depois os itens são reagrupados em blocos lógicos (`SidebarNavClient`):
  - `Principais`
  - `Recrutamento`
  - `Operacional`
  - `Gestão de Pessoas`
  - `Cadastros Pessoas`
  - `Cadastros Operacionais`
  - `Relatórios`
  - `Feedback`
  - `Admin`
  - `Owner`
- Alguns itens podem aparecer com cadeado (modo "em breve"), mesmo existentes no código.

## Bloco: Principais

### Dashboard (`/dashboard`)
- Painel inicial do tenant com visão executiva e atalhos de operação.
- Ponto de entrada para monitoramento diário.

### Minhas Pendências (`/gestao/aprovacoes`)
- Fila pessoal de aprovações de solicitações de vaga.
- Indica itens aguardando decisão do usuário atual.

### Solicitações (`/gestao/solicitacoes`)
- Lista de solicitações de vaga (nova/substituição), com status e urgência.
- Permite abrir, revisar e avançar no fluxo de aprovação.

## Bloco: Recrutamento

### Quadro de Vagas (`/vagas`)
- Cockpit completo da vaga: criação, edição, status e ações operacionais.
- Centraliza pendências RH, aprovações, importação de vagas e atalhos para matching/candidatos.

### Painel RH (`/painel-rh`)
- Visão por workflow com foco em execução do RH e SLA.
- Consolida itens em andamento, fila do RH e indicadores de produtividade operacional.

### Candidatos (`/candidatos`)
- Gestão da base de candidatos por vaga e por etapa.
- Busca, filtros, status, detalhes de perfil/CV e decisões de avanço.

### Admissão (`/admissao`)
- Gestão da pré-admissão e fechamento da contratação.
- Controla status documental e validações obrigatórias (incluindo cenários TOTVS).

### Matching IA (`/matching`)
- Ranking inteligente de aderência candidato x vaga.
- Oferece score, justificativas e apoio à priorização de shortlist.
- Em alguns cenários pode aparecer bloqueado na sidebar (cadeado).

### Pipeline (`/triagem`)
- Funil visual de triagem por etapas (kanban).
- Permite mover candidato entre fases e registrar evolução no processo.
- Em alguns cenários pode aparecer bloqueado na sidebar (cadeado).

### Processo Seletivo (`/gestao/processo-seletivo`)
- Gestão formal por rodada/projeto, com fases e movimentação controlada.
- Útil para processos seletivos com governança mais rígida.
- Em alguns cenários pode aparecer bloqueado na sidebar (cadeado).

### Painel de Solicitações (`/gestao/painel-solicitacoes`)
- Visão consolidada das solicitações em formato de painel gerencial.
- Complementa a tela de lista de solicitações com acompanhamento agregado.

## Bloco: Operacional

### Agenda (`/agendas`)
- Controle de compromissos e eventos operacionais.
- Suporte ao agendamento de atividades relacionadas ao fluxo RH.

### Entrada (`/entradaemailpasta` / `EntradaEmailPasta`)
- Caixa/fila de entrada operacional integrada ao processo.
- Usada para captura e tratamento de entradas que alimentam etapas internas.

### Batida de Ponto (`/gestao/batida-ponto`)
- Item previsto para operação de jornada.
- Atualmente pode aparecer bloqueado na sidebar.

### Pagamento Extra (`/gestao/comissoes`)
- Item de operação para eventos de pagamento extra/comissões.
- Pode aparecer bloqueado dependendo da liberação do ambiente.

### Desligamentos (`/gestao/desligamentos`)
- Gestão operacional de desligamentos de colaboradores.
- Normalmente utilizado em conjunto com Gestão de Pessoas.

## Bloco: Gestão de Pessoas

### Dashboard Gestão (`/gestao/dashboard`)
- Indicadores de gestão de pessoas no recorte de liderança.
- Visão de saúde e performance do time.

### PDI (`/gestao/planosdesenvolvimento`)
- Gestão de planos de desenvolvimento individual.
- Acompanha definição, execução e evolução de planos.

### Humor (`/gestao/humor`)
- Acompanhamento de sinalizações de clima/humor organizacional.
- Apoia leitura de risco de engajamento.

### Resumo Atividades (`/gestao/resumoatividades`)
- Sumário de atividades de pessoas e gestores.
- Ajuda em acompanhamento de rotina e produtividade.

## Bloco: Cadastros Pessoas

### Pessoas (`/pessoas`)
- Cadastro e consulta de pessoas.
- Base para vinculações de processos e regras internas.

### Funcionários (`/funcionarios`)
- Cadastro de colaboradores ativos e seus dados de operação.
- Entidade central para processos de RH e solicitações.

## Bloco: Cadastros Operacionais

### Empresas (`/empresas`)
- Cadastro de empresas/unidades jurídicas do contexto.
- Estrutura para segmentação administrativa e operacional.

### Departamentos (`/departamentos`)
- Cadastro de departamentos da organização.
- Base para estrutura de equipe e alçadas.

### Áreas (`/areas`)
- Cadastro de áreas organizacionais.
- Usado em vagas, gestão e relatórios.

### Funções (`/categorias`)
- Cadastro de funções (equivalência à estrutura funcional de RH).
- Base para classificação ocupacional interna.

### Cargos (`/cargos`)
- Cadastro de cargos e nível ocupacional.
- Usado em vagas, admissões e trilhas de carreira.

### Unidades (`/unidades`)
- Cadastro de unidades/estabelecimentos.
- Usado para lotação, filtros e escopos de operação.

### Centros de Custo (`/centros-custo`)
- Cadastro financeiro-operacional para alocação de custos.
- Apoia relatórios e governança de orçamento.

### Categorias Salariais (`/categorias-salariais`)
- Cadastro de faixas/categorias salariais.
- Base para consistência de política de remuneração.

### Turnos (`/turnos`)
- Cadastro de turnos/escala de trabalho.
- Referência para jornada e planejamento operacional.

### Unidades de Lotação (`/unidades-lotacao`)
- Estrutura de lotação organizacional.
- Usada em movimentações, admissões e vínculos hierárquicos.

### Bloqueio de Pessoa (`/bloqueiopessoa`)
- Registro de restrições/bloqueios operacionais.
- Evita reentrada indevida em fluxos sensíveis.

## Bloco: Relatórios

### Relatórios (`/relatorios`)
- Central de extração e leitura gerencial.
- Consolida indicadores para tomada de decisão.

## Bloco: Feedback

### Enviar Feedback (`/feedback/enviar`)
- Registro de feedbacks direcionados.
- Ponto de início do fluxo de feedback contínuo.

### Meus Feedbacks (`/feedback/feedbacks`)
- Histórico e acompanhamento dos feedbacks do usuário.
- Permite visão de recebidos/enviados conforme perfil.

### Reuniões 1a1 (`/feedback/reunioes1a1`)
- Gestão de one-on-ones e cadência de acompanhamento.
- Apoia rotina de liderança e desenvolvimento.

### Gamificação (`/feedback/gamificacao`)
- Visão de engajamento por mecânicas de gamificação.
- Incentiva participação e recorrência.

### Celebrações (`/feedback/celebracao`)
- Mural/registro de reconhecimentos e celebrações.
- Foco em cultura e reconhecimento entre pares.

### Observação de liberação
- O bloco Feedback e suas rotas podem aparecer bloqueados (cadeado) em alguns ambientes.
- Isso depende da combinação de permissões e regra visual do sidebar atual.

## Bloco: Admin

### Usuários (`/admin/users`)
- CRUD de usuários do tenant.
- Controle de identidade e acesso básico.

### Perfis (Roles) (`/admin/roles`)
- Gestão de perfis de acesso.
- Define responsabilidades por grupo de usuários.

### Acessos (`/admin/accesses`)
- Gestão de permissões por perfil.
- Ajuste fino de autorização nas funcionalidades.

### Menus (`/admin/menus`)
- Administração de menu e visibilidade.
- Ajustes de navegação e estrutura do tenant.

### Organograma / Hierarquia / Gestores
- Estrutura hierárquica para aprovações e cadeia de gestão.
- Impacta workflows de solicitação e governança.

### Configuração de Aprovações / Aprovadores Alternativos
- Regras de alçada e substituição de aprovadores.
- Reduz gargalos em ausência de responsáveis.

### Config. de E-mail / Templates / E-mails Enviados
- Configuração SMTP/IMAP, templates e histórico de envios.
- Base para notificações transacionais do sistema.

### Entra ID / API Keys / Localização
- Integrações de identidade, chaves técnicas e idioma/localização.
- Suporte de plataforma e governança técnica.

### Logs / Logs Operacionais
- Auditoria transacional e logs técnicos da aplicação.
- Ferramentas de suporte e troubleshooting do tenant.

## Bloco: Owner

### Telas Owner (`/Owner/*`)
- Bloco visível para contexto de super-admin.
- Inclui operações de governança cross-tenant, módulos comerciais e suporte.

## Notas importantes para operação

- A presença de uma aba depende de três fatores combinados:
  - permissão do usuário;
  - módulo habilitado para o tenant;
  - regra visual da sidebar (itens ocultos/bloqueados).
- No estado atual, o módulo desabilitado afeta principalmente menu/UI; o bloqueio HTTP completo por módulo ainda é evolução de fase 2.

## Módulos opcionais no Owner (o que são)

Os módulos opcionais são os que o Owner pode ligar/desligar por tenant:

- `agenda`: agenda operacional e eventos.
- `recrutamento`: fluxo de vagas/solicitações/aprovações/projetos/processo seletivo.
- `candidatos`: base de candidatos e triagem.
- `matching`: matching por IA.
- `portal-vagas`: portal de vagas e entrada associada.
- `admissao`: pré-admissão/admissão.
- `feedback`: feedback, 1:1, gamificação, celebrações.
- `gestao`: dashboards e indicadores de gestão de pessoas.
- `relatorios`: relatórios gerenciais.

## Prioridade recomendada de liberação (Owner)

### Prioridade 1 — Base de operação de recrutamento

- `recrutamento`
- `candidatos`
- `admissao`
- `portal-vagas` (necessário para experiências ligadas a entrada/portal e rotas associadas)

### Prioridade 2 — Ganho de produtividade e qualidade

- `matching` (acelera shortlist)
- `agenda` (organização operacional)

### Prioridade 3 — Gestão e maturidade

- `gestao`
- `feedback`
- `relatorios`

## Matriz — módulo opcional x impacto na visão do tenant (sidebar)

### `agenda`
- Impacta abas: `Agenda` (bloco Operacional).
- Ao desabilitar: a aba some do menu (mantendo permissões do usuário inalteradas no backend atual).

### `recrutamento`
- Impacta abas: `Solicitações`, `Minhas Pendências`, `Quadro de Vagas`, `Processo Seletivo`.
- Também impacta itens técnicos correlatos no fluxo de vagas/aprovação/projetos.
- Ao desabilitar: remove a espinha dorsal do pipeline de requisição de vaga.

### `candidatos`
- Impacta abas: `Candidatos`, `Pipeline` (Triagem).
- Ao desabilitar: time perde gestão de candidatos e funil de triagem.

### `matching`
- Impacta abas: `Matching IA`.
- Ao desabilitar: remove ranking IA e atalhos de priorização por score.

### `portal-vagas`
- Impacta abas: `Portal de Vagas` e itens ligados ao prefixo `entrada.*`.
- Observação: no desenho atual, `Painel RH` usa permissão `entrada.view`; portanto, também é afetado por este módulo.

### `admissao`
- Impacta abas: `Admissão`.
- Ao desabilitar: elimina fluxo de pré-admissão do menu.

### `feedback`
- Impacta abas do bloco Feedback: `Enviar Feedback`, `Meus Feedbacks`, `Reuniões 1a1`, `Gamificação`, `Celebrações`.
- Ao desabilitar: bloco de cultura/feedback desaparece.

### `gestao`
- Impacta abas: `Dashboard Gestão`, `PDI`, `Humor`, `Resumo Atividades`.
- Pode impactar também `Painel de Solicitações` quando este depende de permissão `gestao.*`.

### `relatorios`
- Impacta abas: `Relatórios`.
- Ao desabilitar: remove leitura gerencial consolidada.

## Auditoria de coerência (sidebar x módulos)

### Alinhamentos corretos

- `matching` -> `Matching IA` (coerente).
- `admissao` -> `Admissão` (coerente).
- `feedback` -> bloco Feedback (coerente).
- `gestao` -> bloco Gestão de Pessoas (coerente).
- `relatorios` -> `Relatórios` (coerente).
- `agenda` -> `Agenda` (coerente).

### Pontos de atenção (conceito x implementação atual)

- `Painel RH` está visualmente em Recrutamento, mas a permissão atual é `entrada.view` (prefixo `entrada.`), que mapeia para módulo `portal-vagas`.
- `Pipeline` (Triagem) está em Recrutamento, porém depende de `triagem.view`, que hoje mapeia para módulo `candidatos`.
- `Solicitações` e `Minhas Pendências` ficam no bloco `Principais`, mas pertencem ao módulo `recrutamento` (impacto correto, apenas distribuição visual diferente).

### Gaps de mapeamento de permissões (não casadas com módulo)

As permissões abaixo não batem com nenhum prefixo do `ModuleCatalog`, então tendem a não ser filtradas por módulo:

- `categorias-salariais.*`
- `turnos.*`
- `nivel-cargo.*`
- `centros-custo.*`
- `unidades-lotacao.*`
- `talentos.*`
- `api-keys.*`
- `admin.gestores.*`
- `admin.regras-aprovacao.*`
- `admin.hierarquia.*`
- `desempenho*`

## Recomendação para casar tudo corretamente

1. Revisar `ModuleCatalog.PermissionKeyPrefixes` para cobrir 100% das permissões de menu ativas.
2. Decidir regra de negócio para itens ambíguos:
   - `Painel RH` fica em `recrutamento` ou `portal-vagas`?
   - `Triagem` fica em `recrutamento` ou `candidatos`?
3. Rodar validação de consistência automática:
   - cada aba da sidebar deve resolver para exatamente um módulo (ou core explícito);
   - nenhuma permissão produtiva pode ficar sem `ResolveModuleKey`.
4. Fase 2: aplicar gate de backend por módulo (não só menu) para impedir acesso por URL direta.
