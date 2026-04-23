# Tasks

Quadro operacional curto para acompanhamento entre IAs/IDEs.

Status:
- `[ ]` pendente
- `[~]` em andamento
- `[x]` concluído
- `[!]` bloqueado

---

## Em andamento

- [~] **FASE 1 — R&S 2026-04-23 — Matching baseado em Descrição de Cargo + calibragem de pesos por vaga + distância** (sessão atual)

## Próximas

### FASE 1 — Matching profundo (Descrição de Cargo + Pesos calibráveis + Distância)

Objetivo: o match candidato × vaga hoje só usa `Vaga.Requisitos` (lista). Vai passar a usar a **Descrição de Cargo** estruturada (template DNALIO do anexo) + **pesos configuráveis por vaga** (RH calibra Competência/Localização/Idioma/etc por vaga) + **distância geocodificada** entre Pessoa e Empresa.

- [ ] **1.A — Estender `DescricaoCargo` com seções DNALIO** estruturadas:
  - Atividades Específicas (lista), Atividades Comuns (lista)
  - Formação: mínima/desejável/área
  - Experiência: tempo mínimo/desejável/especificação
  - Vivências Específicas (lista com flag obrigatório/desejável)
  - Competências DNALIO (lista) — Prioridade ao Cliente, Alta Performance, etc.
  - Competências Liderança/Relacionamento (lista)
  - Competências Funcionais (lista)
  - Competências Técnicas (lista) — agora estruturada com `Categoria` (Hardware/Software/Idioma/Segurança)
  - Requisitos Obrigatórios (lista)
  - Migration idempotente; entidades-filha com Cascade
- [ ] **1.B — `Vaga.DescricaoCargoId` (FK opcional)** — vaga aponta para uma descrição de cargo (template) e o matching usa essa fonte, não `Vaga.Descricao*`. Vaga ainda pode ter overrides locais.
- [ ] **1.C — Pesos calibráveis por vaga**: hoje `Vaga` tem `PesoCompetencia/Experiencia/Formacao/Localidade` mas eles **não são usados** no `MatchingService`. Estender com `PesoIdioma`, `PesoConhecimentoTecnico`, `PesoVivenciasEspecificas`. Validar soma = 100. Plugar no algoritmo.
- [ ] **1.D — UI de calibragem de pesos no `VagaFormModal`**: aba "Pesos do Matching" com sliders para cada peso (com soma controlada para fechar 100), preview da distribuição.
- [ ] **1.E — Endereço da Empresa + geocoding**:
  - Estender `Empresa` com `Cep, Logradouro, Numero, Bairro, Cidade, Uf, Latitude?, Longitude?`
  - Adicionar `Pessoa.Latitude?, Pessoa.Longitude?`
  - Serviço `IGeocodingService` com implementação Nominatim (OpenStreetMap, free) + cache via campos persistidos
  - Helper Haversine para distância em km
- [ ] **1.F — `MatchingService` reescrito** para consumir `DescricaoCargo` (seções DNALIO), pesos calibrados da vaga, e distância geocodificada. Score continua 0-100; breakdown novo: Competência / Experiência / Formação / Localidade (km) / Idioma / Conhecimento Técnico / Vivências.
- [ ] **1.G — Migrations idempotentes + suite verde + commit + push**.

### FASE 2 — UX do matching e do kanban

- [ ] **2.A — Score com explicabilidade**: API retorna breakdown por critério com peso aplicado e contribuição (ex.: "Competência 85% × peso 30 = 25.5 pts"). UI mostra barras coloridas por categoria e tooltip de "por que esse score".
- [ ] **2.B — SLA semáforo no kanban de candidaturas**: cada card calcula dias na etapa atual; verde até 50% do SLA, amarelo 50–100%, vermelho >100%. SLA por etapa configurável (default global; override por vaga via `Vaga.SlaDiasMetaFechamento` já existe).

### FASE 3 — Operacional + comunicação

- [ ] **3.A — Funil de conversão de candidaturas**: dashboard com gráfico de funil mostrando taxas de conversão entre etapas (Aplicada → Triagem → Entrevista → Teste → Proposta → Contratado). Filtro por vaga, período, recrutador.
- [ ] **3.B — Bulk actions no kanban**: checkbox por card + barra contextual "X selecionados" com botões "Avançar etapa", "Mover para...", "Recusar em massa". Confirma com lista detalhada de quem foi afetado.
- [ ] **3.C — Preview de templates de notificação (PT-BR)**: na tela `NotificacoesTemplatesScreen`, adicionar botão "Pré-visualizar" que renderiza o template com placeholders preenchidos (dados de exemplo) — útil pra ver como o e-mail/WhatsApp realmente fica antes de salvar. Por hora **apenas em PT-BR** (decidido com usuário 2026-04-23 — sem multi-idioma; campo `Idioma` da entidade fica intocado mas UI só edita o template default).

---

## Pendências infra (pré-requisitos para matching por IA)

- [ ] Rodar `fix-broken-migrations.sh` caso apareça erro "relação X já existe" ao subir o app (migration `20260411055438_AddUnidadeLotacaoHierarchyV2` é conhecidamente corrompida)
- [ ] Instalar extensão `pgvector` no Postgres local e executar `AddEmbeddingSupport.sql` para habilitar matching por IA vetorial
- [ ] Configurar Python 3.11+ e subir o serviço `RHPortal.Ai` (porta 8000) para validar matching por IA híbrido (BM25 + embeddings)

---

## Concluídas (sessão 31.x — 2026-04-23)

- [x] **Sessão 31.2** — Consolidação Area + Department → CentroCusto (29 arquivos test ajustados, migration idempotente, sidebar limpa, grid unificado com colunas Headcount/Responsável/Local)
- [x] **Sessão 31.3** — Fix DELETE de Centro de Custo com vínculos (pre-check de 7 FKs + 409 com mensagem)
- [x] **Sessão 31.4** — Fix DELETE de Candidato com vínculos (pre-check PropostaVaga + ProjetoCandidato + 409 detalhado)
- [x] **Sessão 31.5** — Remover Função (RequisitoCategoria) — redundante com Cargo
- [x] **Sessão 31.6** — Rename "Eixos de Vaga" → "SLA de Vagas" (UI + rota /sla-vagas com redirect)
- [x] **Sessão 31.7** — Categoria Salarial com grade percentual (ValorBase + Steps 80%-120% livres)

## Concluídas (sessões anteriores)

- [x] **Painel de Solicitações — B1 (transversal core)** aplicado na Sessão 25 Onda 14 — item movido para bucket `principais` no `NavegacaoManifest` (Destacado=true, Ordem=40), justificativa registrada no backlog
- [x] **Épicos R&S** — todos os 8 épicos do pacote concluídos entre Sessões 17 e 28 (ver `backlog.md` → "Épicos estratégicos"): Carteira de vaga, Eixo+SLA, Travar faixa salarial, Aceite digital, Portal externo, Onboarding por Cargo Macro, Notificações WhatsApp + extras, Auditoria
- [x] **Cobertura de testes — entitlement** — `TenantPackageServiceTests` (17 cenários) + 5 cenários de composição em `TenantModuleServiceTests` (Sessão 17)
- [x] **UI Owner — gestão de pacotes** — `TabModulos.tsx` reescrito com seção "Pacotes contratados" + "Opcionais avulsos" + "Core" (Sessão 17)
- [x] **Camada de entitlement em dois níveis** — `PackageCatalog` + `TenantPackage` + `TenantPackageService` + endpoints Owner + migration `AddTenantPackages` (Sessão 17)
- [x] **Cadastros órfãos resolvidos** — Pessoas/Áreas mantidos em Core; Bloqueio subordinado a Pessoas; Humor/Resumo Atividades → Feedback/GP; Agenda/Entrada → R&S
- [x] **Visão arquitetural TO-BE** capturada em `knowledge-base/visao-arquitetural.md`
