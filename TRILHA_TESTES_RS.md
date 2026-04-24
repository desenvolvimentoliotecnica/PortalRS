# Trilha de Testes — Recrutamento & Seleção

> Roteiro operacional para validar **todas** as funcionalidades do módulo R&S
> entregues nas fases 1–3 (matching profundo DNALIO, pesos calibráveis,
> geocoding, SLA kanban, funil, bulk actions, templates, ciclo fim-a-fim).
>
> Ambiente: dev local, tenant `liotecnica`, dados já seedados (vaga + 4 candidatos).
> Data: 2026-04-24.

---

## 0. Pré-requisitos & credenciais

| Item | Valor |
|---|---|
| API | `http://localhost:5056` |
| Web Next | `http://localhost:3000/app` |
| Tenant | `liotecnica` |
| Login admin | `admin@dev.local` / `YkmF@2022*` |
| Empresa-base | LIO-001 — Embu das Artes/SP, lat `-23.6436` / lng `-46.8085` |
| Descrição de Cargo | `ASSISTENTE-DE-SUPORTE-TECNICO` (36 itens DNALIO) |
| Vaga seedada | `VAG-AST-001` — Assistente de Suporte Técnico — Embu |
| Vaga UUID | `aaaaaaaa-aaaa-4000-8000-000000000001` |
| MatchMinimoPercentual | 30 |

**Checklist antes de começar**:

- [ ] API saudável: `curl http://localhost:5056/health` → `200`
- [ ] Web Next subiu e está no path `/app`
- [ ] Login funciona com `admin@dev.local` / `YkmF@2022*`
- [ ] 4 candidatos seedados visíveis em `/app/recrutamento/candidatos` (Ana, Bruno, Carla, Diego)

Se faltar algum item, rodar: `psql ... -f /tmp/seed_vaga_simulacao.sql`

---

## Trilha A — Descrição de Cargo DNALIO (FASE 1.A)

**Objetivo**: validar que o template DNALIO é o modelo estruturado correto e que a
listagem/edição expõe as 12 seções.

### A.1 Abrir a descrição seedada
- [ ] Ir em **Recrutamento → Descrições de Cargo** (`/app/recrutamento/descricoes-cargo`)
- [ ] Abrir `ASSISTENTE-DE-SUPORTE-TECNICO`
- [ ] **Esperado**: cabeçalho "Assistente de Suporte Técnico" + Área "Tecnologia da Informação"

### A.2 Validar as seções DNALIO
A descrição deve exibir 8 categorias com itens:

| Seção | Esperado | Qtd |
|---|---|---|
| Atividades Específicas | 8 atividades de suporte técnico | 8 |
| Atividades Comuns | 7 atividades de nível cargo | 7 |
| Vivências Específicas | 3 itens (suporte, chamado, conhecimento técnico) | 3 |
| Competências DNALIO | Prioridade ao Cliente, Alta Performance… | 5 |
| Competências Liderança | Trabalho em Equipe | 1 |
| Competências Funcionais | Administração do Tempo, Dinamismo… | 5 |
| Competências Técnicas | Hardware, Informática, Sistemas Operacionais | 3 |
| Requisitos Obrigatórios | 5 requisitos | 5 |

- [ ] **Check**: **`36` itens totais**
- [ ] **Check**: formação mínima "Ensino superior Completo" exibida
- [ ] **Check**: experiência mínima "1 ano" exibida
- [ ] **Check**: revisão "00" e gestor "Lucas Muniz"

### A.3 Importar uma nova descrição por .docx (upload)
- [ ] Clicar em **"Importar .docx"** (botão da tela de listagem)
- [ ] Selecionar `/Users/lmuniz/Projetos/RH/Assistente de Suporte Tecnico.docx`
- [ ] **Esperado**: modal preview mostra as 8 seções parseadas, aviso se algo ficou em branco
- [ ] Confirmar import → deve criar outra descrição (código `ASSISTENTE-DE-SUPORTE-TECNICO-V2`)
- [ ] **Rollback**: deletar a importação de teste para não poluir os dados

---

## Trilha B — Vaga com pesos calibráveis (FASE 1.C / 1.D)

**Objetivo**: confirmar que RH consegue ajustar os 7 pesos e que a soma fecha 100.

### B.1 Abrir a vaga seedada
- [ ] Ir em **Recrutamento → Vagas** → abrir **`VAG-AST-001`**
- [ ] Clicar em **Editar**

### B.2 Aba "Pesos do Matching"
- [ ] Localizar a aba **"Pesos do Matching"**
- [ ] **Esperado**: 7 sliders com valores:
  - Competência = 35
  - Experiência = 15
  - Formação = 0
  - Localidade = 15
  - Idioma = 0
  - Conhecimento Técnico = 25
  - Vivência Específica = 10
- [ ] **Check indicador**: soma no topo = **100 ✅ (verde)**

### B.3 Testar validação da soma
- [ ] Mover o slider Competência para **50**
- [ ] **Esperado**: indicador vira **115 ❌ (vermelho)** e botão Salvar bloqueia
- [ ] Voltar Competência para 35

### B.4 Campo "Raio máximo de distância"
- [ ] Confirmar que `LocalidadeMaxDistanciaKm = 30 km` aparece
- [ ] Confirmar que `DescricaoCargoId` aponta para **ASSISTENTE-DE-SUPORTE-TECNICO**

### B.5 Criar nova vaga simples
- [ ] Clicar em **Nova Vaga**
- [ ] Preencher mínimo (Título, Centro de Custo, Quantidade, Status=Rascunho)
- [ ] Salvar
- [ ] **Esperado**: vaga criada com pesos default (Competência 35 / Experiência 25 / Formação 15 / Localidade 25)
- [ ] **Rollback**: deletar a vaga de teste

---

## Trilha C — Matching profundo + breakdown explicável (FASE 1.F / 2.A)

**Objetivo**: validar que o matching DNALIO discrimina perfis e o breakdown
é explicável.

### C.1 Kanban da vaga
- [ ] Ir em `/app/recrutamento/candidaturas?vagaId=aaaaaaaa-aaaa-4000-8000-000000000001`
- [ ] **Esperado**: 4 cards na coluna **"Em Triagem"**:
  - Ana Carolina Silva (Embu)
  - Bruno Henrique Costa (Taboão)
  - Carla Mendes (Cotia)
  - Diego Rocha (Rio de Janeiro)

### C.2 Badges de match score
Cada card deve ter um badge colorido com o match.

| Candidato | Match esperado | Cor |
|---|---|---|
| Ana | **40** | verde (≥ 30 passou) |
| Bruno | **26** | amarelo (próximo) |
| Carla | **10** | cinza |
| Diego | **0** | cinza |

- [ ] **Check**: Ana é a #1 do ranking
- [ ] **Check**: Diego (RJ) é zero (fora do raio de 30 km)

### C.3 Dialog de breakdown (Ana)
- [ ] Clicar no badge "Match 40%" do card da Ana
- [ ] **Esperado abrir** `MatchingBreakdownDialog`:
  - Score grande colorido **40**
  - Badge "✅ Passou no match mínimo (≥ 30)"
  - Distância **3,3 km até a empresa**
  - 5 critérios com barras:
    - Competência (peso 35) — 25%
    - Experiência (peso 15) — 50%
    - Localidade (peso 15) — 89%
    - Conhecimento Técnico (peso 25) — 64%
    - Vivência Específica (peso 10) — 39%
  - Lista de **itens cobertos vs faltando** em cada critério
  - Banner amarelo "2 requisitos obrigatórios faltando" com lista

### C.4 Breakdown comparativo (Diego)
- [ ] Clicar no badge do Diego (DISTANTE)
- [ ] **Esperado**: Localidade = 0 com texto "acima do máximo (30 km)" — **380,5 km**
- [ ] Conhecimento Técnico = 14% (tem Hardware/Software no CV mas não todos os tokens)

### C.5 Recálculo manual (se houver botão "Recalcular")
- [ ] Se a UI expõe "Recalcular match" em algum menu do card, disparar e confirmar que o score não muda (já está correto)

---

## Trilha D — Kanban SLA semáforo (FASE 2.B)

**Objetivo**: validar cor dos cards por dias na etapa.

### D.1 Estado atual (sem mexer)
SLA default para Triagem = 5 dias. Tempos seedados:

| Candidato | Dias | Cor esperada |
|---|---|---|
| Ana | 1 dia (20%) | 🟢 verde |
| Bruno | 3 dias (60%) | 🟡 amarelo |
| Carla | 6 dias (120%) | 🔴 vermelho |
| Diego | 8 dias (160%) | 🔴 vermelho |

- [ ] **Check visual**: cada card com a cor correta no indicador SLA
- [ ] **Check tooltip**: passar mouse sobre o indicador mostra "X dias na etapa / SLA Y dias"

### D.2 SLA por vaga (override)
- [ ] Ir em edição da vaga → aba SLA (se existir)
- [ ] `SlaDiasMetaFechamento` deve estar **30 dias**
- [ ] Voltar para o kanban e confirmar que os cards continuam corretos

---

## Trilha E — Bulk actions (FASE 3.B)

**Objetivo**: validar ações em massa no kanban.

### E.1 Seleção múltipla
- [ ] No kanban, marcar checkbox de Ana **e** Bruno
- [ ] **Esperado**: barra contextual aparece no topo com **"2 selecionados"** + botões
  (Avançar etapa / Mover para… / Recusar em massa)

### E.2 Avançar etapa em massa
- [ ] Clicar em **Avançar etapa**
- [ ] Confirmar na modal (mostra os 2 nomes)
- [ ] **Esperado**: Ana + Bruno saem de "Em Triagem" para "Entrevista"
- [ ] Cards voltam a verde (novo tempo na etapa = 0)

### E.3 Recusar em massa
- [ ] Marcar Carla + Diego
- [ ] Clicar em **Recusar em massa** → informar motivo "Teste"
- [ ] **Esperado**: cards somem do kanban (vão pra coluna "Recusado" ou Status=Reprovado)

### E.4 Rollback
- [ ] Rodar seed de novo para limpar: `psql ... -f /tmp/seed_vaga_simulacao.sql`

---

## Trilha F — Funil de conversão (FASE 3.A)

**Objetivo**: validar gráfico de funil cumulativo.

### F.1 Abrir tela
- [ ] Ir em **Recrutamento → Funil** (`/app/recrutamento/funil`)
- [ ] **Esperado**: 4 KPIs no topo (Aplicadas / Triagem / Entrevista / Contratadas) + 1 barra horizontal por etapa

### F.2 Filtro por vaga
- [ ] Filtrar por vaga **VAG-AST-001**
- [ ] **Esperado**: 4 aplicadas (todos os candidatos da simulação)
- [ ] Se avançou Ana + Bruno na trilha E, agora haverá 2 em Entrevista

### F.3 Filtro por período
- [ ] Filtrar "Últimos 7 dias"
- [ ] **Esperado**: só Ana, Bruno, Carla (Diego aplicou há 8 dias)

### F.4 Taxas de conversão
- [ ] Confirmar que as barras mostram % de conversão entre etapas
  (ex.: Triagem → Entrevista = 50%)

---

## Trilha G — Templates de notificação + preview PT-BR (FASE 3.C)

**Objetivo**: validar pré-visualização de e-mail/WhatsApp.

### G.1 Listar templates
- [ ] Ir em **Notificações → Templates** (`/app/notificacoes/templates`)
- [ ] Confirmar que há templates padrão (Aplicação recebida, Convocação entrevista, Recusa, Proposta…)

### G.2 Abrir um template
- [ ] Abrir "Convocação para Entrevista"
- [ ] **Esperado**: campos Assunto + Corpo com placeholders `{{candidato.nome}}`, `{{vaga.titulo}}`, etc.

### G.3 Botão "Pré-visualizar"
- [ ] Clicar em **Pré-visualizar**
- [ ] **Esperado**: modal mostra o e-mail renderizado com dados mock:
  - `{{candidato.nome}}` → "Maria Silva"
  - `{{vaga.titulo}}` → "Desenvolvedor Senior"
  - `{{empresa.nome}}` → "Liotécnica"
  - etc.

### G.4 Só PT-BR
- [ ] **Check**: não há seletor de idioma na UI (decidido: só português por hora)

---

## Trilha H — CEP autocomplete (FASE 1.E)

**Objetivo**: validar que campo CEP preenche endereço automaticamente.

### H.1 Na vaga
- [ ] Editar **VAG-AST-001** → aba Localização
- [ ] Limpar CEP → digitar `06803-000` → sair do campo (blur)
- [ ] **Esperado**: Logradouro/Bairro/Cidade/UF preenchidos automaticamente (via ViaCEP)

### H.2 Na empresa
- [ ] Ir em **Cadastros → Empresas** (`/app/cadastros/empresas`)
- [ ] Editar LIO-001 → digitar outro CEP qualquer (ex.: `01310-100` — Av. Paulista)
- [ ] **Esperado**: preenche "Av. Paulista", "Bela Vista", "São Paulo", "SP"
- [ ] **Não salvar** (rollback)

### H.3 Geocoding (latitude/longitude)
- [ ] Voltar CEP da empresa para `06803-...` e **salvar**
- [ ] **Esperado**: backend dispara Nominatim async; em alguns segundos `Latitude/Longitude` aparecem preenchidos
- [ ] Validar via SQL:
  ```sql
  SELECT "Cidade", "Latitude", "Longitude", "GeocodificadoEmUtc"
  FROM "Empresas" WHERE "Code" = 'LIO-001';
  ```

---

## Trilha I — Ciclo fim-a-fim (aplicar → contratar)

**Objetivo**: passar Ana pelo funil completo com todas as features.

### I.1 Preparação
- [ ] Garantir que Ana está em "Em Triagem" (rodar seed se necessário)

### I.2 Avançar pelas etapas
Uma candidatura passa por: **Aplicada → Em Triagem → Entrevista → Teste → Proposta → Contratado**.

- [ ] Ana → clicar "Avançar" → **Entrevista**
- [ ] Ana → clicar "Avançar" → **Teste**
- [ ] Ana → clicar "Avançar" → **Proposta**

### I.3 Criar proposta de vaga
- [ ] Na etapa Proposta, clicar **"Gerar proposta"**
- [ ] Preencher: Salário `R$ 4.200`, data início, benefícios
- [ ] **Check "Travar faixa salarial"**: se salário > SalarioMaximo (R$ 4.500) sistema exige aprovação de alçada
- [ ] Salvar → proposta em `PendenteAceite`

### I.4 Aceite digital (portal)
- [ ] Copiar link de aceite gerado
- [ ] Abrir o link em aba anônima
- [ ] **Esperado**: tela pública com dados da proposta + botão "Aceitar" / "Recusar"
- [ ] Clicar Aceitar → `Aceita`

### I.5 Avançar para Contratado
- [ ] Voltar ao kanban → Ana em Proposta com badge "Aceita"
- [ ] Avançar → **Contratado**
- [ ] **Esperado**: candidatura `Status=Contratado`, pré-admissão criada automaticamente

### I.6 Onboarding por Cargo Macro
- [ ] Ir em **Admissão → Pré-admissões** → abrir a de Ana
- [ ] **Esperado**: checklist pré-preenchido conforme Cargo Macro (documentos, exames, treinamentos)
- [ ] Marcar alguns como concluídos → barra de progresso atualiza

---

## Trilha J — Portal externo (candidato)

**Objetivo**: validar o portal público onde candidato aplica e acompanha.

### J.1 Tela pública de vagas
- [ ] Abrir (aba anônima) `http://localhost:3000/portal/vagas?tenant=liotecnica`
- [ ] **Esperado**: vaga VAG-AST-001 listada (se `Visibilidade=Publica` e `CanalSiteCarreiras=true`)

### J.2 Aplicar em vaga
- [ ] Clicar em "Candidatar-se" → preencher Nome, E-mail, CPF, CV (pode ser texto)
- [ ] Aceitar LGPD
- [ ] Submeter
- [ ] **Esperado**: confirmação + candidatura criada internamente (visível no kanban)

### J.3 Consulta de status (candidato)
- [ ] Voltar à home do portal → "Meu Status" → informar e-mail + chave
- [ ] **Esperado**: lista de candidaturas do candidato + etapa macro atual

---

## Trilha K — Solicitação de vaga + aprovação (carteira)

**Objetivo**: validar workflow de abertura de vaga com aprovação hierárquica.

### K.1 Gestor abre solicitação
- [ ] Login como usuário com perfil Gestor (se houver) ou usar admin
- [ ] Ir em **Recrutamento → Solicitações de Vaga** → Nova
- [ ] Preencher: Título, Centro de Custo, Justificativa, Headcount solicitado
- [ ] Submeter
- [ ] **Esperado**: solicitação em `AguardandoAprovacao`

### K.2 Aprovador avalia
- [ ] Ir em **Aprovações** → abrir solicitação → Aprovar
- [ ] **Esperado**: Status → `Aprovada` + vaga criada automaticamente (status Rascunho)

### K.3 Carteira de vagas do recrutador
- [ ] Ir em **Recrutamento → Minha Carteira**
- [ ] **Esperado**: recrutador vê só as vagas onde é `RecrutadorResponsavelUserId`
- [ ] Check alertas: vagas abertas há > X dias sem candidato → `AlertaVagaSemFill`

---

## Trilha L — Auditoria e qualidade do matching

### L.1 Auditoria
- [ ] Ir em **Administração → Auditoria** (se permissão)
- [ ] Buscar por tabela `Candidaturas` → **Esperado**: cada avanço de etapa gerou linha de auditoria

### L.2 NDCG (qualidade do ranking)
- [ ] Chamar via curl (com TOKEN do pré-req):
  ```bash
  curl -H "Authorization: Bearer $TOKEN" -H "X-Tenant-Id: liotecnica" \
    "http://localhost:5056/api/matching/ndcg?vagaId=aaaaaaaa-aaaa-4000-8000-000000000001"
  ```
- [ ] **Esperado**: JSON `{ vagaId, ndcg10 }` — valor entre 0 e 1 (alvo ≥ 0.6)

### L.3 Feedback do recrutador
- [ ] No card do kanban, ao aprovar/rejeitar candidato, confirmar que o feedback foi
  persistido em `RecruiterMatchingFeedback` (SQL direto):
  ```sql
  SELECT * FROM "RecruiterMatchingFeedback"
  WHERE "VagaId" = 'aaaaaaaa-aaaa-4000-8000-000000000001';
  ```

---

## 📋 Checklist rápido de regressão

Ao final da trilha, confirmar:

- [ ] ✅ Matching retorna score discriminado (Ana 40 > Bruno 26 > Carla 10 > Diego 0)
- [ ] ✅ Breakdown dialog explica cada critério
- [ ] ✅ Distância calculada está correta (Haversine)
- [ ] ✅ SLA semáforo pinta cards por tempo de etapa
- [ ] ✅ Bulk actions funcionam (avançar / recusar em massa)
- [ ] ✅ Funil mostra conversão entre etapas
- [ ] ✅ Templates têm preview PT-BR
- [ ] ✅ CEP autocomplete preenche endereço
- [ ] ✅ Ciclo aplicar → proposta → aceite → contratação conclui
- [ ] ✅ Portal externo aceita candidatura e mostra status
- [ ] ✅ Solicitação de vaga passa por aprovação
- [ ] ✅ Auditoria registra cada mudança

---

## 🔄 Como resetar o ambiente

Para voltar ao estado inicial da simulação:

```bash
PGPASSWORD='@FelipeL89*' psql -h localhost -U postgres -d dev_render_liotecnica \
  -f /tmp/seed_vaga_simulacao.sql
```

Isso apaga e recria CentroCusto + Vaga + 4 Pessoas/Candidatos/Candidaturas
com IDs determinísticos.

---

---

## Trilha M — Stack IA (RAG + Ollama) — FASE 4

**Objetivo**: validar matching híbrido, chatbot RH, geração de descrição de cargo,
resumo de CV e sugestão salarial — tudo via Ollama local + pgvector.

### M.1 Pré-requisitos
- [ ] `ollama serve` rodando (`curl http://localhost:11434/api/version` → `{"version":"..."}`)
- [ ] Modelos baixados: `ollama list` deve listar `qwen2.5:7b` e `bge-m3`
- [ ] pgvector instalado: `sudo bash scripts/setup-pgvector.sh`
- [ ] API reiniciada após migration

### M.2 Health do stack IA
- [ ] Abrir `/app/assistente-ia`
- [ ] **Esperado sidebar**:
  - ✓ Ollama alcançável
  - ✓ Modelo chat (Qwen 2.5)
  - ✓ Modelo embedding (bge-m3)

### M.3 Reindexar embeddings
- [ ] Clicar em "Reindexar embeddings" na sidebar
- [ ] **Esperado**: toast "Reindexado: N itens + M candidatos" em ~15s
- [ ] Validar no banco:
  ```sql
  SELECT COUNT(*) FROM "DescricaoCargoItemEmbeddings";  -- deve ter 36 linhas (DNALIO do Assistente)
  SELECT COUNT(*) FROM "CandidatoEmbeddings";           -- deve ter 4 (Ana, Bruno, Carla, Diego)
  ```

### M.4 Matching híbrido (comparação lado-a-lado)
- [ ] Ir em `/app/recrutamento/candidaturas?vagaId=aaaaaaaa-aaaa-4000-8000-000000000001`
- [ ] Clicar no badge "Match X%" de **Ana Carolina**
- [ ] No dialog, alternar toggle "Híbrido (IA)" vs "Léxico puro"
- [ ] **Esperado**:

| Candidato | Léxico puro | Híbrido (IA) |
|---|---|---|
| Ana (PERFEITO) | ~49 | **~58** |
| Bruno (BOM) | ~29 | **~42** |
| Carla (MÉDIO) | ~13 | **~28** |
| Diego (DISTANTE) | ~0 | **~13** |

- [ ] **Check banner roxo "Por que a IA acha que bate"**: lista top-3 itens semanticamente próximos com % de similaridade
- [ ] Para Ana deve aparecer algo como: "Atender e responder chamados de suporte técnico (66%)", "Conhecimento técnico em Hardware, Software e Redes (64%)", "Fornecer suporte técnico a usuários... (64%)"

### M.5 Chatbot RAG
- [ ] Tela `/app/assistente-ia`
- [ ] Digitar: **"Quais são as principais responsabilidades do Assistente de Suporte Técnico?"**
- [ ] **Esperado**:
  - Resposta streaming token-a-token (aparecem palavras aos poucos)
  - Lista bulletpoints com `[Fonte N]` após cada item
  - Seção "Fontes usadas" abaixo da resposta — 3 a 8 fontes com categoria + similaridade
- [ ] Testar outras perguntas:
  - "Quais competências DNALIO?"
  - "Qual experiência mínima do Assistente?"
  - "Resuma as atividades em 3 bullets"
- [ ] **Validar fallback**: parar o Ollama (`killall ollama`) → chat ainda responde com erro amigável

### M.6 Gerar Descrição de Cargo via IA
- [ ] Usar dialog `GerarDescricaoCargoDialog` (plugável em qualquer tela de cadastro)
- [ ] Input: Título = "Analista Financeiro Pleno", Área = "Finanças", Contexto = "contas a pagar, SAP, fornecedores"
- [ ] **Esperado**: toast "Template DNALIO gerado com sucesso" em ~20-30s
- [ ] Conferir se `Request` retornado tem:
  - `Code`, `Title`, `AreaTemplate` preenchidos
  - ~8 itens categoria 1 (AtividadeEspecifica)
  - 5 competências DNALIO fixas (categoria 10)
  - Requisitos obrigatórios (categoria 20)
- [ ] Testar direto via curl:
  ```bash
  curl -X POST -H "Authorization: Bearer $TOKEN" -H "X-Tenant-Id: liotecnica" \
    -H "Content-Type: application/json" \
    -d '{"titulo":"Analista Financeiro Pleno","areaOuDepartamento":"Finanças","contextoAdicional":"SAP, contas a pagar"}' \
    http://localhost:5056/api/assistente-ia/descricao-cargo/gerar | python3 -m json.tool
  ```

### M.7 Resumo automático de CV
- [ ] Disparar via curl:
  ```bash
  curl -X POST -H "Authorization: Bearer $TOKEN" -H "X-Tenant-Id: liotecnica" \
    "http://localhost:5056/api/assistente-ia/cv/resumir/aaaaaaaa-3001-4000-8000-000000000001?force=true"
  ```
- [ ] **Esperado** — resumo de ~200 chars contendo: cargo, anos de experiência, skills-chave, formação
- [ ] Rodar novamente — segunda chamada retorna `usouCache=true` sem gastar inferência

### M.8 Sugestão de faixa salarial
- [ ] No VagaFormModal, aba "Remuneração", clicar **"Sugerir faixa com IA"**
- [ ] **Esperado (sem histórico suficiente)**: modal explica "Sem referências internas suficientes"
- [ ] Criar 2-3 vagas similares (mesma DescricaoCargo) com salários → tentar de novo
- [ ] **Esperado**: modal mostra faixa R$ X – R$ Y + justificativa + lista de referências usadas
- [ ] Clicar "Aplicar na vaga" → preenche SalarioMinimo/Maximo no form

### M.9 Verificação SQL do armazenamento vetorial
```sql
-- Ver um embedding (primeiros 5 valores):
SELECT "ModelVersion", "Dimensions",
       "TextoSource",
       "Embedding"::text  -- vector imprime como "[0.123,-0.456,...]"
FROM "DescricaoCargoItemEmbeddings"
LIMIT 1;

-- Similaridade entre 2 itens (quão parecidos são):
SELECT a."TextoSource", b."TextoSource",
       1 - (a."Embedding" <=> b."Embedding") AS similaridade
FROM "DescricaoCargoItemEmbeddings" a, "DescricaoCargoItemEmbeddings" b
WHERE a."Id" < b."Id"
ORDER BY similaridade DESC
LIMIT 10;
```

### M.10 Comparar tempo de resposta
- [ ] Léxico puro: ~100 ms por matching
- [ ] Híbrido (primeira vez, Ana): ~1-2s (inclui embedding on-the-fly se não indexado)
- [ ] Híbrido (cache quente): ~300 ms
- [ ] Chat RAG: 10-15s no CPU, 2-3s na GPU M-series

---

## 🐛 Problemas conhecidos → ✅ Resolvidos em 2026-04-24

1. ~~Scores baixos por falta de stemming~~ → **Stemmer pt-br conservador** em
   `PtBrStemmer.cs` reduz variantes flexionais à mesma raiz
   (`trabalhar`/`trabalho`/`trabalhando` → `trabalh`; `configuração`/`configurar`
   → `configur`). Matching usa stem lookup O(1) + fallback substring.
   Ana subiu 40 → 48; reqs faltantes 2 → 0.

2. ~~Parser não reconhece sub-seções atípicas~~ → **Match fuzzy em 2 passes** em
   `DocxDescricaoCargoParser.TryMatchSecao`: pass 1 equality, pass 2 contains
   exigindo alias ≥ 2 palavras e ≥ 10 chars. `/` e `-` agora viram espaço para
   "Experiências/Vivências" não virar palavra única. Re-import do DNALIO
   categoriza 100% automático (36 itens nas 8 categorias certas).

3. ~~Requisitos processuais penalizando injustamente~~ → **`IsRequisitoProcessual`**
   detecta padrões como "alinhado com o gestor", "requisição da vaga",
   "indicado pelo gestor", "aprovação do gestor", "processo seletivo", etc., e
   esses requisitos **não entram na penalidade**. Só requisitos skill-based
   (técnicos/comportamentais) contam.

### 🔮 Próximas evoluções opcionais

1. **TF-IDF** — pesar tokens raros (ex.: "ManageEngine", "Active Directory")
   mais que tokens genéricos ("utilizando", "trazendo") — item coberto pelos
   tokens raros ganha peso proporcional. Upgrade simples sobre o stemmer atual.

2. **Sinônimos técnicos** — dicionário pequeno `AD ≡ Active Directory`,
   `MS Office ≡ Microsoft Office`, `HD ≡ Help Desk`. Melhora scores em siglas.

3. **Embeddings** — após `pgvector` instalado + serviço `RHPortal.Ai` (porta 8000),
   o matching por IA híbrido (BM25 + embeddings) entra em cena e os scores ficam
   bem mais altos (candidato "perfeito" típico → 80+).
