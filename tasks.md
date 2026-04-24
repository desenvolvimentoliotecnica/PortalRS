# Tasks

Quadro operacional curto para acompanhamento entre IAs/IDEs.

Status:
- `[ ]` pendente
- `[~]` em andamento
- `[x]` concluído
- `[!]` bloqueado

---

## Em andamento

- _(nenhum item — Recrutamento & Seleção 100% completo na sessão de 2026-04-24, com stack RAG + Ollama + pgvector)_

## Próximas

### FASE 1 — Matching profundo (Descrição de Cargo + Pesos calibráveis + Distância)

Objetivo: o match candidato × vaga hoje só usa `Vaga.Requisitos` (lista). Vai passar a usar a **Descrição de Cargo** estruturada (template DNALIO do anexo) + **pesos configuráveis por vaga** (RH calibra Competência/Localização/Idioma/etc por vaga) + **distância geocodificada** entre Pessoa e Empresa.

- [x] **1.A — Estender `DescricaoCargo` com seções DNALIO** (commit 42d5d6f / a4a49c0) estruturadas:
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
- [x] **1.B — `Vaga.DescricaoCargoId` (FK opcional)** — vaga aponta para uma descrição de cargo (template) e o matching usa essa fonte, não `Vaga.Descricao*`. Vaga ainda pode ter overrides locais.
- [x] **1.C — Pesos calibráveis por vaga**: hoje `Vaga` tem `PesoCompetencia/Experiencia/Formacao/Localidade` mas eles **não são usados** no `MatchingService`. Estender com `PesoIdioma`, `PesoConhecimentoTecnico`, `PesoVivenciasEspecificas`. Validar soma = 100. Plugar no algoritmo.
- [x] **1.D — UI de calibragem de pesos no `VagaFormModal`**: aba "Pesos do Matching" com sliders para cada peso (com soma controlada para fechar 100), preview da distribuição.
- [x] **1.E — Endereço da Empresa + geocoding**:
  - Estender `Empresa` com `Cep, Logradouro, Numero, Bairro, Cidade, Uf, Latitude?, Longitude?`
  - Adicionar `Pessoa.Latitude?, Pessoa.Longitude?`
  - Serviço `IGeocodingService` com implementação Nominatim (OpenStreetMap, free) + cache via campos persistidos
  - Helper Haversine para distância em km
- [x] **1.F — `MatchingService` reescrito** para consumir `DescricaoCargo` (seções DNALIO), pesos calibrados da vaga, e distância geocodificada. Score continua 0-100; breakdown novo: Competência / Experiência / Formação / Localidade (km) / Idioma / Conhecimento Técnico / Vivências.
- [x] **1.G — Migrations idempotentes + suite verde + commit + push**.

### FASE 2 — UX do matching e do kanban

- [x] **2.A — Score com explicabilidade**: API retorna breakdown por critério com peso aplicado e contribuição (ex.: "Competência 85% × peso 30 = 25.5 pts"). UI mostra barras coloridas por categoria e tooltip de "por que esse score".
- [x] **2.B — SLA semáforo no kanban de candidaturas**: cada card calcula dias na etapa atual; verde até 50% do SLA, amarelo 50–100%, vermelho >100%. SLA por etapa configurável (default global; override por vaga via `Vaga.SlaDiasMetaFechamento` já existe).

### FASE 3 — Operacional + comunicação

- [x] **3.A — Funil de conversão de candidaturas**: dashboard com gráfico de funil mostrando taxas de conversão entre etapas (Aplicada → Triagem → Entrevista → Teste → Proposta → Contratado). Filtro por vaga, período, recrutador.
- [x] **3.B — Bulk actions no kanban**: checkbox por card + barra contextual "X selecionados" com botões "Avançar etapa", "Mover para...", "Recusar em massa". Confirma com lista detalhada de quem foi afetado.
- [x] **3.C — Preview de templates de notificação (PT-BR)**: na tela `NotificacoesTemplatesScreen`, adicionar botão "Pré-visualizar" que renderiza o template com placeholders preenchidos (dados de exemplo) — útil pra ver como o e-mail/WhatsApp realmente fica antes de salvar. Por hora **apenas em PT-BR** (decidido com usuário 2026-04-23 — sem multi-idioma; campo `Idioma` da entidade fica intocado mas UI só edita o template default).

---

## Pendências infra (pré-requisitos para matching por IA)

- [ ] Rodar `fix-broken-migrations.sh` caso apareça erro "relação X já existe" ao subir o app (migration `20260411055438_AddUnidadeLotacaoHierarchyV2` é conhecidamente corrompida)
- [x] **pgvector instalado** (via `scripts/setup-pgvector.sh` — 2026-04-24)
- [x] **Ollama + Qwen 2.5 7B + bge-m3** — stack completo operando localmente
- [~] Serviço Python `RHPortal.Ai` (porta 8000) — mantido como opcional (legado 80/20); stack principal migrou para Ollama local

## FASE 4 — Stack RAG (Ollama + pgvector) — CONCLUÍDA 2026-04-24

Objetivo: matching híbrido (léxico + semântico + localidade) + chatbot RAG + geradores IA.
Tudo rodando 100% local, zero custo por inferência, zero dado saindo da infra do tenant.

- [x] **4.A** — pgvector instalado e habilitado em `dev_render_liotecnica` + script idempotente `scripts/setup-pgvector.sh` para replicar em novos hosts
- [x] **4.B** — Entidades `DescricaoCargoItemEmbedding` + `CandidatoEmbedding` com tipo `Vector(1024)` + migration idempotente (`AddEmbeddingsPgvector`)
- [x] **4.C** — `IOllamaClient` (HTTP tipado): `/api/embeddings`, `/api/chat` (buffered + streaming SSE), `/api/tags` (health)
- [x] **4.D** — `IEmbeddingService` com upsert idempotente por hash SHA256 + `IVectorSearchService` (kNN cosine distance) + HostedService de re-indexação
- [x] **4.E** — `HybridMatchingService` — blend 30% léxico + 50% semântico + 20% localidade, com fallback automático para léxico puro quando Ollama indisponível
- [x] **4.F** — `ILlmAssistantService` (chatbot RAG) + streaming SSE no controller + retrieval de itens DNALIO + vagas abertas
- [x] **4.G** — `IDescricaoCargoGeneratorService` — gera template DNALIO completo a partir de brief (título + contexto) com JSON estruturado
- [x] **4.H** — `ICvResumoService` — resume CV em 250 chars para card do kanban, idempotente
- [x] **4.I** — `ISalarioSuggesterService` — sugere faixa salarial baseada em vagas similares + categoria salarial internas do tenant (não inventa dados de mercado)
- [x] **4.J** — Tela `/assistente-ia` com chat streaming token-a-token + sidebar de health Ollama + reindexação + sugestões
- [x] **4.K** — Componentes plugáveis: `GerarDescricaoCargoDialog`, `SugerirSalarioButton`, `ResumirCvButton`
- [x] **4.L** — `MatchingBreakdownDialog` estendido com toggle Híbrido/Léxico + seção "evidências semânticas" (top-3 itens mais similares)
- [x] **4.M** — Controller único `/api/assistente-ia/*` com 7 endpoints (health, chat, chat/stream, descricao-cargo/gerar, cv/resumir, vagas/sugerir-salario, embeddings/reindexar)
- [x] **4.N** — Item de navegação "Assistente IA" registrado em `NavegacaoManifest` (sidebar)
- [x] **4.O** — **Reindexação automática** via `EmbeddingReindexInterceptor` (SaveChangesInterceptor) + `EmbeddingIndexQueue` (Channel singleton) + `EmbeddingIndexerHostedService` (BackgroundService). Quando item DNALIO ou CV/resumo do candidato muda via EF Core, o worker reembeda em background sem bloquear UI. Fix `AuditWriter.CreateDbContext` faltando `UseVector()`.
- [x] **4.P** — **Nomenclatura dos 3 modos** padronizada: <c>"ai"</c> (Ollama disponível, híbrido completo — default sempre priorizado), <c>"semantic"</c> (Ollama indisponível, usa TF-IDF + stems + sinônimos + localidade), <c>"lexical"</c> (endpoint legacy sem localidade). UI mostra badge colorido por modo em todas as telas de matching.
- [x] **4.Q** — **Aba "Matching IA" na tela de Vaga** (`VagaHubScreen`) — tabela com score híbrido, semântico, léxico, distância, modo, passou/abaixo, ordenável + botão "Ver breakdown" por linha + reindexar embeddings
- [x] **FASE 5 — Agent RAG com Function Calling** (implementada 2026-04-24):
  - **IAgentTool + AgentToolRegistry** — catálogo de ferramentas com schema JSON
  - **16 tools** iniciais: `vagas_listar/contar/info/candidatos`, `candidatos_listar/info/contar`, `candidaturas_por_etapa/sla_atrasadas/por_fonte`, `propostas_listar/estatisticas`, `centros_custo_listar`, `descricoes_cargo_listar/info`, `empresas_listar`
  - **OllamaClient.ChatWithToolsAsync** — Function Calling OpenAI-compatible (tools + tool_calls + tool results)
  - **LlmAssistantService refatorado** com loop ReAct (MaxAgentIterations=6), intent detection (perguntas estruturadas zeram RAG pra incentivar tools), synthesis fallback (se Qwen responde vazio após tools, força sintetizar)
  - **Frontend**: ChatBubble mostra chips violeta das ferramentas invocadas (hover mostra args + resultado preview)
  - Validado: "quantas vagas abertas?" → tool `vagas_contar` → "2 vagas abertas" em 28ms ✓
  - Validado: "distribuição por etapa" → tool `candidaturas_por_etapa` → breakdown completo ✓
  - Validado: "vaga VAG-FIN-001 detalhes" → tool `vagas_info` → dados completos ✓
- [x] **4.R** — **LLM-as-a-Judge** (`ILlmMatchingService`): Qwen 2.5 raciocina sobre CV + DescCargo estruturada + pesos da vaga e retorna score 0-100 + justificativa PT-BR + breakdown por critério (pontos fortes e gaps). Cache persistente em `CandidatoVagaLlmScores` invalidado por SHA256 de (CV + DescCargo itens + pesos + MatchMinimo). 1ª chamada ~46s CPU / ~10s GPU; 2ª instantânea (30ms). Endpoint `GET /api/vagas/{id}/matching-llm/{candId}` + `LlmMatchingDialog` + botão "Análise IA" na aba Matching IA. Score muito mais fiel — Rafael saltou de 46 (híbrido) para **85 (LLM)** pois Qwen detecta semântica profunda ("SAP FI" ≡ "ERP financeiro", "3 anos" ≡ "experiência relevante"), identifica gaps sutis ("falta atendimento a fornecedores") e explica em linguagem natural.

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
