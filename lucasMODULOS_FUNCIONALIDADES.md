# lucas — Módulos e Funcionalidades (aba por aba, módulo por módulo)

> **Autor:** Lucas Machado · **Data inicial:** 2026-04-24
> Mapeamento funcional de cada tela do produto. Foco em **negócio**: o que cada tela faz, quem usa, quais ações estão disponíveis e quais endpoints da API .NET ela consome. Use isso como "índice" para localizar onde fica cada coisa.

> **Convenção:** rotas começando com `/app/` são da área autenticada do tenant. `/Owner/` é do super-admin. `/portal/` é do portal público de candidato.

---

## Sumário

1. [Autenticação e SSO](#1-autenticação-e-sso)
2. [Dashboard](#2-dashboard)
3. [Recrutamento — Vagas](#3-recrutamento--vagas)
4. [Recrutamento — Candidatos](#4-recrutamento--candidatos)
5. [Recrutamento — Triagem](#5-recrutamento--triagem)
6. [Recrutamento — Matching com IA](#6-recrutamento--matching-com-ia)
7. [Recrutamento — Candidaturas (Kanban / Funil)](#7-recrutamento--candidaturas-kanban--funil)
8. [Recrutamento — Solicitações de Vaga](#8-recrutamento--solicitações-de-vaga)
9. [Recrutamento — Propostas](#9-recrutamento--propostas)
10. [Banco de Talentos](#10-banco-de-talentos)
11. [Admissão / Pré-admissão](#11-admissão--pré-admissão)
12. [Gestão de Funcionários](#12-gestão-de-funcionários)
13. [Gestão / Meu Time (gestor)](#13-gestão--meu-time-gestor)
14. [Solicitações de RH (férias, benefícios, promoção, desligamento, endereço, dependentes)](#14-solicitações-de-rh)
15. [Avaliação de Desempenho](#15-avaliação-de-desempenho)
16. [Feedback contínuo, 1:1, Mood](#16-feedback-contínuo-11-mood)
17. [Celebrations e Gamificação](#17-celebrations-e-gamificação)
18. [Surveys](#18-surveys)
19. [Nine-Box](#19-nine-box)
20. [Relatórios e Analytics](#20-relatórios-e-analytics)
21. [Comunicação (e-mail, WhatsApp)](#21-comunicação)
22. [Aprovações (magic link e in-app)](#22-aprovações)
23. [Admin do Tenant](#23-admin-do-tenant)
24. [Owner (multi-tenant)](#24-owner-multi-tenant)
25. [Portal público de vagas](#25-portal-público-de-vagas)
26. [Portal de Pré-admissão (candidato)](#26-portal-de-pré-admissão-candidato)
27. [Auditoria e Logs](#27-auditoria-e-logs)
28. [Comunicação interna / Notificações](#28-notificações)

---

## 1. Autenticação e SSO

### `/app/login`
- **Para quê:** Login no portal do tenant.
- **Quem usa:** RH, Recrutador, Gestor, Admin, Colaborador.
- **Mecanismos:**
  - **E-mail + senha** (`POST /api/auth/login` → JWT)
  - **Login com Microsoft** (Entra ID) — botão dispara `GET /api/auth/entra/challenge` (gera URL OAuth) → redireciona → callback retorna ao app
- **Após login:** JWT armazenado em sessionStorage, decodificado para extrair `tenant` (vai no header `X-Tenant-Id`).
- **Recuperação de senha:** fluxo via e-mail.

### `/Owner/Login`
- **Para quê:** Login do super-admin (cross-tenant).
- **Endpoint:** `POST /api/owner/auth/login` → JWT com política "Owner".

---

## 2. Dashboard

### `/app/dashboard`
- **Para quê:** Visão executiva de KPIs do tenant.
- **Quem usa:** RH, Diretoria, Admin.
- **Cards/widgets típicos:**
  - Vagas abertas, encerradas, em SLA
  - Pipeline de candidatos por etapa
  - Taxa de conversão (triagem → entrevista → proposta → contratado)
  - Tempo médio de fechamento
  - Headcount autorizado vs. realizado
  - Próximos aniversários (`GET /api/gestao/aniversarios?dias=30`)
  - Vagas com SLA estourado
- **Endpoints:**
  - `GET /api/dashboard/analytics`
  - `GET /api/dashboard/pipeline`
  - `GET /api/dashboard/vagas-abertas`
  - `GET /api/dashboard/taxas-conversao`
  - `GET /api/me`

---

## 3. Recrutamento — Vagas

### `/app/vagas`
- **Para quê:** Listar todas as vagas do tenant.
- **Quem usa:** Recrutador, RH, Gestor (filtra por escopo).
- **Filtros:** Status (Rascunho, Aberta, Pausada, Encerrada), centro de custo, busca textual, modalidade, urgência.
- **Colunas:** Título, Código, Status, Senioridade, Data abertura, Headcount, Candidatos vinculados, SLA.
- **Ações:** Criar vaga, editar, mudar status, renovar vaga expirada, gerar PDF, abrir modal de matching IA, exportar CSV.

### `/app/vagas/[id]`
- **Para quê:** Detalhe completo da vaga, com **modal/abas internas**:

| Aba | O que tem |
|---|---|
| **Geral** | Título, código, descrição, modalidade, senioridade, faixa salarial, datas, headcount autorizado, gestor responsável |
| **Requisitos** | Lista de `VagaRequisito` (obrigatório/desejável, peso, sinônimos) — usado pelo matching keyword |
| **Filtros matching (IA)** | `MatchingFiltrosRaw` (texto livre com idioma, vivência específica, etc.) + `MatchingFiltrosOriginaisRaw` para "reverter para filtros da criação" |
| **Pesos do matching** | 7 sliders que somam 100% — competência / experiência / formação / localidade / idioma / conhecimento técnico / vivência específica |
| **Etapas** | `VagaEtapa` (Triagem, Entrevista 1, ...) com tempo médio máximo |
| **Benefícios** | `VagaBeneficio` ofertados |
| **Perguntas screening** | `VagaPergunta` que aparecem ao candidato no portal |
| **Campos personalizados** | `CampoPersonalizadoVaga` |
| **Permissões** | Quem pode ver esta vaga (`PermissaoNivelVaga`) |
| **Histórico** | Histórico de mudanças de status, ocupações anteriores |

- **Endpoints:**
  - `GET /api/vagas/{id}`
  - `PUT /api/vagas/{id}`
  - `POST /api/vagas/{id}/status`
  - `PATCH /api/vagas/{id}/matching-filtros` (atualiza filtros IA)
  - `POST /api/vagas/{id}/renovar`

---

## 4. Recrutamento — Candidatos

### `/app/candidatos`
- **Para quê:** Lista geral de candidatos (vinculados a alguma vaga ou no banco geral).
- **Quem usa:** Recrutador, RH.
- **Filtros:** Status (Novo, Triagem, Aprovado, Reprovado), Vaga, Cidade/UF, Fonte (LinkedIn, indicação, portal etc.).
- **Colunas:** Nome, e-mail, telefone, cidade, vaga atual, status, último match score.
- **Ações:** Cadastrar manualmente, importar CV (upload PDF, IA extrai dados), exportar, desvincular de vaga.

### `/app/candidatos/[id]`
- **Para quê:** Perfil completo do candidato.
- **Abas:**

| Aba | Conteúdo |
|---|---|
| **Resumo** | Nome, contato, foto, status, vaga atual, fonte, render score IA |
| **CV / Resumo profissional** | `CvText` extraído + `ResumoProfissional` |
| **Educação** | `CandidatoEducacao` |
| **Experiência** | `CandidatoExperiencia` |
| **Competências** | `CandidatoCompetencia` (skill + nível) |
| **Certificações** | `CandidatoCertificacao` |
| **Projetos** | `CandidatoProjeto` (portfolio) |
| **Documentos** | Upload/download (CV, portfólio, RG, comprovantes) |
| **Referências** | `CandidatoReferencia` |
| **Preferências** | Modalidade, senioridade, áreas, agenda, notificações |
| **Histórico** | `CandidatoStatusHistory` (mudanças de status) |
| **LGPD** | Consentimento e datas |
| **Acessibilidade** | Necessidades especiais |

- **Endpoints:**
  - `GET /api/candidatos/{id}`
  - `POST /api/candidatos/{id}/documentos`
  - `POST /api/candidatos/{id}/documentos/curriculo-extrair` (IA extrai dados estruturados do CV)
  - `GET /api/candidatos/{id}/documentos/{docId}/download`

---

## 5. Recrutamento — Triagem

### `/app/triagem`
- **Para quê:** Tela operacional para triar candidatos novos.
- **Quem usa:** Recrutador.
- **Layout:** Lista lateral de candidatos pendentes + painel direito com CV + ações rápidas (aprovar / reprovar / pedir mais info / mover para vaga específica).
- **Filtros:** Vaga, fonte, score IA mínimo.

---

## 6. Recrutamento — Matching com IA

### `/app/matching`
- **Para quê:** Encontrar os melhores candidatos para uma vaga via IA.
- **Quem usa:** Recrutador, RH.
- **Layout:**
  - **Esquerda:** lista de vagas (filtra por aberta).
  - **Centro:** ranking de candidatos (badge colorido — verde 75+, amarelo 50-74, laranja 30-49, cinza <30).
  - **Direita:** detalhe do candidato selecionado com **breakdown explicável** (score por dimensão).
- **Ações:**
  - **Editar filtros de matching** (modal — atualiza `MatchingFiltrosRaw`)
  - **Reverter para filtros da criação**
  - **Recomputar matching**
  - Mover candidato para próxima etapa
- **Pipeline executado (Fase 4.5):**
  1. `GET /api/vagas/{id}/matching-candidates` — lê do cache em `CandidatoVagaMatchingScores`
  2. Se cache vazio/expirado: dispara recompute em background (que chama `RHPortal.Ai`)
  3. Frontend mostra rankig com score, justificativa e classificação Dentro/Abaixo
- **Versão de regra:** v1 (80/20) ou v2 (65/35 + gates) — controlado por feature flag em `RhAi:TenantRuleVersions`.

---

## 7. Recrutamento — Candidaturas (Kanban / Funil)

### `/app/candidaturas` (visão Kanban)
- **Para quê:** Mover candidatos entre etapas do processo.
- **Quem usa:** Recrutador, RH.
- **Layout:** Colunas correspondem a `VagaEtapa` (Triagem → Entrevista 1 → Entrevista 2 → Teste → Proposta → Contratado). Cada card = candidato.
- **Ações:**
  - Drag & drop entre colunas
  - Bulk avançar (`POST /api/candidaturas/bulk-avancar`)
  - Avançar individual (`POST /api/candidaturas/{id}/avançar-etapa`)
  - Aprovar/rejeitar
  - Agendar entrevista
  - Anotações por etapa
- **Endpoints:**
  - `GET /api/candidaturas/kanban`
  - `POST /api/candidaturas/{id}/aprovar`
  - `POST /api/candidaturas/{id}/rejeitar`
  - `POST /api/candidaturas/{id}/agenda`

---

## 8. Recrutamento — Solicitações de Vaga

### `/app/solicitacoes-vaga`
- **Para quê:** Gestor solicita criação de vaga / acréscimo de headcount; RH/Diretoria aprova.
- **Quem usa:** Gestor (cria), RH/Diretor (aprova).
- **Tipos:** Vaga nova, Substituição, Acréscimo de headcount.
- **Workflow:** Rascunho → Submetida → Aprovada Gestor → Aprovada RH → Vaga criada.
- **Ações:** Submeter, aprovar, rejeitar, escalar.
- **Endpoints:**
  - `GET /api/solicitacoes-vaga`
  - `POST /api/solicitacoes-vaga/{id}/submeter`
  - `POST /api/solicitacoes-vaga/{id}/aprovar`
  - `POST /api/solicitacoes-vaga/{id}/rejeitar`
  - `POST /api/solicitacoes-vaga/{id}/escalar`

---

## 9. Recrutamento — Propostas

### `/app/propostas`
- **Para quê:** Propostas formais de trabalho enviadas a candidatos.
- **Quem usa:** RH, Recrutador.
- **Estados:** Rascunho → Enviada → Aceita | Rejeitada | Expirada.
- **Mecanismo:** Envia e-mail com **magic link tokenizado** — candidato responde sem precisar logar.
- **Endpoints:**
  - `POST /api/propostas`
  - `POST /api/propostas/{id}/enviar`
  - `PUT /api/propostas/{id}/responder` (público, via token)

### `/portal/propostas/{token}` (lado candidato)
- **Para quê:** Candidato visualiza a proposta e aceita/rejeita.

---

## 10. Banco de Talentos

### `/app/talentos`
- **Para quê:** Pool de pessoas pré-cadastradas, **sem candidatura ativa**, mantidas para futuras vagas.
- **Quem usa:** Recrutador.
- **Diferença para Candidato:** Talento é uma "pessoa interessante" que pode ser convertida em candidato quando uma vaga adequada surgir.
- **Composição:** `Talento` + `TalentoCompetencia` + `TalentoExperiencia` + `TalentoFormacao` + `TalentoTreinamento` + `TalentoDocumento`.
- **Importação de CV em lote:** `TalentoCvImportJob` — IA processa PDFs e cria talentos automaticamente.
- **Embedding:** Talento também tem embedding vetorial — entra no UNION da busca pgvector junto com Candidatos.
- **Ações:** Criar manual, importar lote, transformar em candidatura para uma vaga (`POST /api/talentos/{id}/candidatura`).

---

## 11. Admissão / Pré-admissão

### `/app/pre-admissao`
- **Para quê:** Lista de pré-admissões (candidatos aprovados em processo de virar funcionário).
- **Quem usa:** RH.
- **Status:** Rascunho → Preenchido → Aprovada → Pendente TOTVS → Integrada.

### `/app/pre-admissao/[id]`
- **Para quê:** Tela de gestão da pré-admissão.
- **Abas:**
  - **Dados pessoais** (do candidato)
  - **Documentos solicitados** (CNH, RG, comprovante residência, foto, etc.) — `PreAdmissaoDocumentoSolicitado`
  - **Documentos enviados** (`PreAdmissaoDocumento`)
  - **Dependentes** (`PreAdmissaoDependente`)
  - **Validação TOTVS** (campos obrigatórios para integrar com Datasul)
  - **Histórico**
- **Ações:**
  - Submeter para aprovação RH
  - Validar TOTVS (`POST /api/pre-admissao/{id}/validar-totvs`)
  - Aprovar contratação
  - Integrar TOTVS (`POST /api/pre-admissao/{id}/integrar-totvs`) — empurra para Datasul
  - Status integração (`POST /api/pre-admissao/integracao/status`)

---

## 12. Gestão de Funcionários

### `/app/funcionarios`
- **Para quê:** Lista de colaboradores ativos.
- **Origem:** Sincronizados do TOTVS RM via worker, ou criados via integração de admissão.
- **Filtros:** Cargo, centro de custo, unidade, gestor, status (ativo/inativo/desligado).

### `/app/funcionarios/[id]`
- **Abas:**
  - **Dados pessoais** (Pessoa)
  - **Dados profissionais** (cargo, nível, salário, data admissão, gestor)
  - **Dependentes** (`Dependente`)
  - **Dados bancários** (`DadosBancarios`, criptografados)
  - **Documentos** (`DocumentoColaborador` — RG, CPF, etc.)
  - **Beneficiários**
  - **Histórico de movimentações** (promoção, transferência, mérito)
  - **Avaliações** (ciclos passados)
  - **PDI** (planos de desenvolvimento)
  - **1:1** (histórico de reuniões com gestor)
  - **Mood** (humor diário, se autorizado)
  - **Render Coins** (saldo + transações)

---

## 13. Gestão / Meu Time (gestor)

### `/app/meu-time`
- **Para quê:** Gestor enxerga só o **seu time**.
- **Endpoints:**
  - `GET /api/gestao/meu-time` (filtra por `ManagerId == userId`)
  - `GET /api/gestao/aniversarios?dias=30`
- **Ações típicas:** Aprovar férias, dar feedback, agendar 1:1, abrir solicitação de vaga.

---

## 14. Solicitações de RH

Conjunto de telas de **workflow de aprovação** com pattern parecido (`Rascunho → Submetida → Aprovada/Rejeitada`).

| Tela | Endpoint base | O que solicita |
|---|---|---|
| `/app/solicitacoes/ferias` | `/api/solicitacoes-ferias` | Funcionário pede férias; gestor aprova; integra TOTVS |
| `/app/solicitacoes/beneficio` | `/api/solicitacoes-beneficio` | Inclusão/remoção de benefício |
| `/app/solicitacoes/promocao` | `/api/solicitacoes-promocao` | Gestor propõe promoção |
| `/app/solicitacoes/desligamento` | `/api/solicitacoes-desligamento` | Pedido, demissão, aposentadoria |
| `/app/solicitacoes/endereco` | `/api/solicitacoes-endereco` | Mudança de endereço cadastral |
| `/app/solicitacoes/dependente` | `/api/solicitacoes-dependente` | Inclusão de dependente |
| `/app/solicitacoes/pagamento-extra` | `/api/solicitacoes-pagamento-extra` | Adiantamento, bônus, comissão |

Todas usam `SolicitacaoAprovacaoEtapa` para rastrear quem aprovou em cada nível e podem disparar **e-mail com magic link** para o aprovador (via `ApprovalMagicLink`).

---

## 15. Avaliação de Desempenho

### `/app/avaliacoes`
- **Para quê:** Ciclos de avaliação 360° (geralmente 3 ciclos por ano: Jan-Abr, Mai-Ago, Set-Dez).
- **Quem usa:** RH (cria ciclo), Gestor (avalia), Colaborador (auto-avalia + avalia pares).
- **Abas:**
  - **Templates** (`AvaliacaoTemplate` + `AvaliacaoTemplatePergunta`) — **Entrega 1.1 (Fase 1 Paridade Feedz)**. 7 modelos prontos chegam por seeder em todo tenant: Anual 360° (completo), 180° (Gestor+Auto), 90° (Gestor→Liderado), Semestral, 30-60-90 Onboarding, Auto-avaliação, Liderança. Tenant pode criar customizados via POST `/templates`. Idempotente — adicionar templates novos no seeder propaga automaticamente para tenants existentes no próximo restart.
  - **Ciclos** (`AvaliacaoCiclo`) — abrir, fechar, calibragem. Pode ser criado do zero ou a partir de um template.
  - **Perguntas** (`AvaliacaoPergunta`) — categorizadas (Desempenho, Competência, Liderança)
  - **Convites** (`AvaliacaoConvite`) — quem avalia quem (com token público)
  - **Respostas** (`AvaliacaoResposta`)
  - **Calibragem** (`AvaliacaoCalibragem`) — RH ajusta notas em reunião
- **Endpoints:**
  - `GET /api/avaliacao/templates` — lista templates do catálogo
  - `GET /api/avaliacao/templates/{id}` — detalhe com perguntas
  - `POST /api/avaliacao/templates` — cria template customizado (RH)
  - `POST /api/avaliacao/ciclos/from-template` — cria ciclo herdando perguntas do template
  - `POST /api/avaliacao/ciclos` — cria ciclo do zero
  - `POST /api/avaliacao/ciclos/{id}/ativar` — ativa rascunho
  - `POST /api/avaliacao/ciclos/{id}/convites/gerar` — gera convocações 360°
  - `POST /api/avaliacao/ciclos/{id}/fechar` — encerra
  - `GET  /api/avaliacao/ciclos/{id}/calibragem` — comitê de calibragem
  - `POST /api/avaliacao/ciclos/{id}/calibragem/decidir` — decisão final + Nine-Box opcional

---

## 16. Feedback contínuo, 1:1, Mood

### `/app/feedback`
- **Sub-abas:**
  - **Feedback contínuo** (`FeedbackItem`) — qualquer pessoa pode dar feedback a qualquer outra, com rating por categoria
  - **PDI** (`DevelopmentPlan` + `DevelopmentPlanGoal`) — planos individuais com metas
  - **1:1** (`OneOnOneMeeting`) — registro de reuniões gestor↔subordinado com pauta + anotações
  - **Templates de Pauta de 1:1** (`OneOnOneTemplate` + `OneOnOneTemplateItem`) — **Entrega 1.2 (Fase 1 Paridade Feedz)**. 10 pautas prontas chegam por seeder em todo tenant: Check-in Semanal, Carreira & Crescimento, Acompanhamento de Metas, Status de Projeto, Onboarding 30/60/90, Pós-Avaliação, Retorno de Férias, Bem-estar & Carga, Resolução de Conflito, Conversa sobre Promoção. Tenant pode criar customizados via POST `/templates`. Quando o gestor escolhe template ao criar 1:1, Subject e Notes (markdown) são pré-populados.
  - **Mood** (`MoodEntry`) — humor diário (😀 / 😐 / 😞) com observação opcional
- **Endpoints:**
  - `POST /api/feedback`
  - `GET /api/feedback/plans`
  - `GET /api/feedback/mood`
  - `POST /api/feedback/oneonone` — cria 1:1 (aceita `templateId` opcional para pré-popular pauta)
  - `GET /api/feedback/oneonone/templates` — lista templates de pauta (sistema + customizados ativos)
  - `GET /api/feedback/oneonone/templates/{id}` — detalhe com itens
  - `POST /api/feedback/oneonone/templates` — cria template customizado pelo tenant

---

## 17. Celebrations e Gamificação

### `/app/celebrations`
- **Para quê:** Mural de reconhecimento — qualquer pessoa pode criar post celebrando alguém (aniversário, conquista, ajuda).
- **Componentes:**
  - `CelebrationPost` (título, descrição, emojis)
  - `CelebrationMention` (tag de pessoa)
  - `CelebrationComment` + `CelebrationCommentMention` + `CelebrationCommentReaction` (👍 ❤️ 😆)
- **Quem usa:** Todos.

### `/app/render-coins` (gamificação)
- **Para quê:** Saldo e histórico de "Render Coins" — moeda interna ganha por atividades (responder survey, dar feedback, completar PDI).
- **Componentes:**
  - `RenderCoinBalance` (saldo)
  - `RenderCoinTransaction` (ganhos/gastos)
  - `GamificationDailyState` (streak)
- **Endpoints:** `GET /api/feedback/gamification/pontos`, `/historico`, `POST /usar-pontos`.

---

## 18. Surveys

### `/app/surveys`
- **Para quê:** Pesquisas de pulse, clima organizacional, NPS interno.
- **Componentes:** `Surveys` + `SurveyQuestion` + `SurveyOption` + `SurveyResponse` + `SurveyAnswer`.
- **Envio:** Por e-mail com token, resposta pública sem login.

---

## 19. Nine-Box

### `/app/nine-box`
- **Para quê:** Matriz 3×3 de Performance × Potencial, classifica colaboradores em 9 quadrantes (estrelas, alto potencial, sólidos, etc.).
- **Quem usa:** RH, Diretor, Gestor (sobre seu time).
- **Endpoints:**
  - `GET /api/nine-box`
  - `GET /api/nine-box/matriz`
  - `POST /api/nine-box`

---

## 20. Relatórios e Analytics

### `/app/relatorios`
- **Tipos:** Headcount, turnover, pipeline de candidatos, conversões, custo por contratação, tempo médio de fechamento, eNPS, mood agregado.
- **Exportação:** CSV, Excel, PDF.

---

## 21. Comunicação

### `/app/comunicacao`
- **Para quê:** Disparar comunicações em massa.
- **Canais:** E-mail, SMS (via Twilio), WhatsApp (Twilio ou Meta Cloud), Blip.
- **Componentes:**
  - Lista de templates (`EmailTemplate`, `NotificacaoTemplate`)
  - Histórico (`LogComunicacao`)
- **Endpoints:**
  - `POST /api/comunicacao/email`
  - `POST /api/comunicacao/sms`
  - `POST /api/comunicacao/blip`
  - `GET /api/comunicacao/historico`

---

## 22. Aprovações

### `/app/aprovacoes`
- **Para quê:** Inbox de aprovações pendentes (consolida solicitações de vaga, férias, desligamento, etc.).
- **Endpoints:**
  - `GET /api/aprovacoes`
  - `POST /api/aprovacoes/{id}/aprovar`
  - `POST /api/aprovacoes/{id}/rejeitar`

### `/portal/approve/{token}` (público)
- **Para quê:** Aprovador acessa via magic link enviado por e-mail e aprova/rejeita sem login.
- **Endpoints:**
  - `GET /api/public/approve/{token}`
  - `POST /api/public/approve/{token}/approve`
  - `POST /api/public/approve/{token}/reject`

---

## 23. Admin do Tenant

Toda a árvore `/app/admin/*` requer permissão `admin.*`.

### `/app/admin/usuariosperfis`
- **Para quê:** CRUD de usuários e atribuição de roles.
- **Endpoints:** `GET/POST/PUT /api/admin/users`, `POST /api/admin/users/{id}/reset-senha`, `POST /api/admin/users/{id}/roles`.

### `/app/admin/roles`
- **Para quê:** CRUD de roles e suas permissões.

### `/app/admin/menus`
- **Para quê:** Configurar quais menus aparecem para cada role (`MenusController`).

### `/app/admin/branding`
- **Para quê:** Logo, cores, favicon (`TenantBrandingController`).

### `/app/admin/configuracoes`
- **Para quê:** Configurações gerais do tenant (moeda, timezone, idioma) — `TenantConfiguracaoController`, `LocalizationConfigController`.

### Vagas — atribuição de recrutador *(novo, 2026-04-26)*
- **Para quê:** Gerente/Diretor de RH atribui uma vaga a um analista recrutador específico — preenche `Vaga.RecrutadorResponsavelUserId` (Guid) e mantém `Vaga.RecrutadorResponsavel` (string) sincronizado com o nome do usuário.
- **Onde mexe:**
  - `VagaFormModal` — campo "Recrutador responsável" virou dropdown com autocomplete (`RecrutadorAutocomplete`) que lista todos os usuários com role `Recrutador*` do tenant.
  - `VagasListScreen` — coluna nova "Recrutador" entre "Data criação" e "Status".
  - Sidebar do recrutador continua filtrando automaticamente via `VagasDataScope.ByRecrutador` (sem mudança).
- **Endpoint dedicado:** `PATCH /api/vagas/{id}/recrutador` body `{ "recrutadorResponsavelUserId": "guid|null" }`. **Restrito a Admin/RH/Owner** (Recrutador comum não pode atribuir vagas a outros).
- **Lookup novo:** `GET /api/lookup/users-recrutadores` retorna `[{ id, name, email }]` dos usuários ativos com role iniciando em "Recrutador" (ex.: "Recrutador", "Recrutador Sênior", "Recrutadora").
- **Auto-atribuição preservada:** quando o próprio Recrutador cria/edita uma vaga sem mexer no campo, ele continua sendo atribuído automaticamente (comportamento legado).
- **Performance/medição:** o relatório `r6 SLA por recrutador` (`GET /api/reports/sla-vaga`) **já existe** e agrupa por recrutador — usa o mesmo dado que esta feature popula. Dashboard dedicado fica para o backlog (`LUC-118` — esperando volume de uso real).

### `/app/admin/ia` *(novo na Fase 3 LLM-agnóstico, 2026-04-25)*
- **Para quê:** Cada tenant escolhe seu provider de LLM (chat) e embeddings.
- **Quem usa:** Admin do tenant.
- **Campos:**
  - **LLM Provider** (dropdown: OpenAI / Gemini / Anthropic / Ollama / "padrão global")
  - **LLM Model** (input de texto, com placeholder do default do provider escolhido)
  - **Embedding Provider** (dropdown idem)
  - **Embedding Model** (input)
- **Painel "Effective":** mostra qual provider/modelo está sendo realmente usado agora (após resolução de fallbacks).
- **Endpoints:**
  - `GET /api/tenant-configuracao/ai`
  - `PUT /api/tenant-configuracao/ai` (admin only)

### `/app/admin/entra-id`
- **Para quê:** Configurar SSO Microsoft do tenant (ClientId, ClientSecret, Tenant Microsoft, RedirectUri).
- **Endpoint:** `EntraIdConfigController`.

### `/app/admin/email-config`
- **Para quê:** Configurar SMTP do tenant (host, porta, user, senha — encriptados).

### `/app/admin/email-templates`
- **Para quê:** Templates de e-mail editáveis (com variáveis).

### `/app/admin/aws-settings`
- **Para quê:** Credenciais AWS S3 do tenant (encriptadas).

### `/app/admin/api-keys`
- **Para quê:** Gerenciar chaves de API (para integrações externas usarem `X-Api-Key`).

### `/app/admin/workflows`
- **Para quê:** Configurar workflows de aprovação por tipo de solicitação (`WorkflowRH`, `EtapaConfigAprovacao`, `EtapaConfigWorkflowRH`).

### `/app/admin/aprovadores-alternativos`
- **Para quê:** Definir substitutos de aprovador (em férias, ausência).

### `/app/admin/configuracoes-headcount`
- **Para quê:** Limites de headcount por área/centro de custo.

### `/app/admin/documentacao-padrao`
- **Para quê:** Lista de documentos obrigatórios padrão para admissão.

### `/app/admin/sla-vaga`
- **Para quê:** Configurar SLA por status de vaga e prioridade (dias para fechar).

### `/app/admin/cargos`
- **Para quê:** CRUD de Cargos + Níveis de Cargo + Descrições de Cargo (DNALIO 36+ itens).

### `/app/admin/centros-custo` / `/app/admin/unidades`
- **Para quê:** Cadastro de centros de custo e unidades/lotações.

---

## 24. Owner (multi-tenant)

Toda a árvore `/Owner/*` requer JWT de Owner.

### `/Owner/Tenants`
- **Para quê:** Lista de tenants (clientes).
- **Colunas:** Nome, CNPJ, status (ativo/suspenso/trial/arquivado), plano, último acesso, usuários ativos, integrações, storage usado.
- **Ações:** Provisionar novo tenant, suspender, ativar, upgrade plano.

### `/Owner/Tenants/[tenantId]`
- **Abas:** Geral, Usuários, Configurações, Billing, Logs, Suporte.
- **Endpoint principal:** `POST /api/owner/tenants` (provisiona) — cria DB, aplica migrations, faz seed.

### `/Owner/Tenants/[tenantId]/modules`
- **Para quê:** Ativar/desativar módulos do tenant (recrutamento, admissão, feedback, talentos, etc.).
- **Endpoint:** `POST /api/owner/tenants/{tenantId}/modules`.

### `/Owner/AwsSettings`
- **Para quê:** Credenciais AWS globais do owner (S3 bucket, região).

### `/Owner/Integracao`
- **Para quê:** Configurar integrações globais (Entra ID compartilhado, SendGrid, etc.).

### `/Owner/IA`
- **Para quê:** Gerenciar chaves de IA (`AiProviderKey` — OpenAI, Anthropic, Gemini) e modelos (`AiModel`).
- **Endpoints:** `OwnerAiController` (`GET/POST/PUT/DELETE /api/owner/ai/keys`).
- **Já está funcional** (CRUD de chaves dos 3 providers + catálogo de modelos + dashboard de uso/custo por tenant e por usuário).

### `/Owner/Tenants/[id]/modules` — toggle "IA habilitada"
- **Para quê (Fase 4 LLM-agnóstico, 2026-04-26):** Owner liga/desliga o módulo `ai` para cada tenant (transversal — afeta TODAS as features que dependem de LLM/embedding via API).
- **Endpoint:** `PUT /api/owner/tenants/{tenantId}/modules/ai { "isEnabled": true/false }`
- **Quando OFF:** `UnifiedAiService.InvokeAsync` retorna `null` cedo; UI tenant `/app/admin/ia` mostra banner "IA não habilitada".
- **Default:** todo tenant novo provisionado nasce com `ai=true` (via `EnsureDefaultsAsync`).

---

## 25. Portal público de vagas

### `/portal/vagas`
- **Para quê:** Site público de carreiras do tenant (com branding customizado).
- **Quem usa:** Candidato externo (sem login).
- **Endpoints públicos:**
  - `GET /api/portal/vagas` (lista)
  - `GET /api/public/vagas/{id}` (detalhe)
  - `GET /api/public/vagas/{id}/descricao-cargo`
  - `GET /api/public/branding` (logo/cores do tenant)

### `/portal/vagas/[id]`
- **Para quê:** Detalhe da vaga + formulário de candidatura.
- **Ações:**
  - Candidatar-se (upload CV + dados básicos)
  - Login/cadastro candidato (`POST /api/public/portal-auth/login` ou `/register`)

### `/portal/minhas-candidaturas`
- **Para quê:** Candidato logado vê status das suas candidaturas.

---

## 26. Portal de Pré-admissão (candidato)

### `/portal/admissao/{token}`
- **Para quê:** Candidato aprovado acessa via magic link e completa dados de admissão (documentos, dependentes, dados bancários).
- **Endpoints:**
  - `GET /api/public/admissao-portal/{token}`
  - `POST /api/public/admissao-portal/{token}/enviar-documentos`
  - `POST /api/public/admissao-portal/login` (login alternativo com senha)

---

## 27. Auditoria e Logs

### `/app/admin/audit`
- **Para quê:** Histórico de quem alterou o quê e quando.
- **Componentes:** `AuditTransaction` → `AuditEvent` → `AuditEntityChange` (granular por propriedade).
- **Endpoint:** `GET /api/audit`.

### `/app/admin/logs`
- **Para quê:** Logs de aplicação (info/warn/error), requests HTTP, exceções.
- **Endpoints:** `GET /api/logs`, `/api/logs/requests`, `/api/logs/exceptions`.

---

## 28. Notificações

### `/app/notificacoes` (sino no header)
- **Para quê:** Notificações in-app (Info, Aviso, Erro) com link de ação.
- **Componentes:** `Notification` + `NotificationReceipt`.
- **Endpoints:** `GET /api/notifications`, `POST /api/notifications/{id}/read`.

---

## Permissões — modelo geral

Formato: `{recurso}.{ação}` ou wildcard `*` (super-admin).

Exemplos:
- `access.manage` (super)
- `vagas.criar`, `vagas.editar`, `vagas.deletar`, `vagas.ver`
- `candidatos.*`, `recrutamento.ver`
- `solicitacoes-vaga.view`, `solicitacoes-vaga.approve`
- `admin.users`, `admin.roles`, `admin.config`
- `colaborador.perfil`, `colaborador.ferias`, `colaborador.beneficios`
- `feedback.enviar`, `feedback.avaliar`, `feedback.ver`
- `admissao.criar`, `admissao.editar`, `admissao.revisar`, `admissao.integrar`

Roles vêm do banco (não hardcoded), e cada role tem suas permissões. `Menu.RoleMenu` controla quais itens de sidebar aparecem.

---

## Fluxos de negócio críticos (resumo)

### A) Recrutamento ponta-a-ponta
1. Gestor abre `Solicitação de Vaga` → RH/Diretor aprova
2. Vaga criada → publicada no portal público + visível para recrutadores
3. Candidatos se aplicam (portal) ou são prospectados manualmente
4. **Triagem** com **matching IA** ranqueia automaticamente
5. **Kanban** move candidatos pelas etapas
6. **Proposta** enviada via magic link → candidato aceita/recusa
7. **Pré-admissão**: candidato envia documentos → RH valida TOTVS → integra Datasul → vira Funcionário

### B) Desligamento
1. Solicitação iniciada por RH ou Gestor
2. Aprovação (gestor → diretor)
3. Cálculos (saldo férias, 13°, rescisão)
4. Documentação gerada (TRCT)
5. Integração TOTVS
6. Entrevista de saída (`EntrevistaSaida`)

### C) Avaliação 360°
1. RH cria ciclo
2. Convites enviados (auto-avaliação + pares + gestor)
3. Respostas coletadas
4. Reunião de calibragem (notas ajustadas)
5. Resultados publicados → input para Nine-Box e PDI

---

**Fim do mapeamento de telas. Manterei vivo conforme novas features aparecerem.**
