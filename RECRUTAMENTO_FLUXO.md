# Módulo de Recrutamento & Seleção — Como Funciona

> **Documento gerado em:** Março 2026  
> Explica o fluxo completo, o estado atual de cada tela e o que ainda falta.

---

## O Fluxo Completo (do zero ao contratado)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│  PASSO 1          PASSO 2         PASSO 3         PASSO 4         PASSO 5      │
│                                                                                 │
│  Gestor           RH              Candidatos      Triagem /       Contratação   │
│  solicita    →    cria a    →     chegam      →   Matching   →   / Admissão    │
│  a vaga           vaga            para a vaga                                  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Mapa das Telas (em ordem de uso)

| # | Rota | Tela | Quem usa | Para quê |
|---|------|------|----------|---------|
| 1 | `/gestao/solicitacoes` | Solicitações de Vaga | Gestor | Pede abertura de nova vaga |
| 2 | `/gestao/aprovacoes` | Aprovações | Diretor / RH | Aprova ou rejeita a solicitação |
| 3 | `/vagas` | Vagas | RH | Cria e configura as vagas, requisitos e filtros de IA |
| 4 | `/talentos` | Banco de Talentos | RH | Candidatos sem vaga definida — reserva de talentos |
| 5 | `/entradaemailpasta` | Entrada Email/Pasta | RH | Ingere currículos de email/pasta automaticamente |
| 6 | `/candidatos` | Candidatos | RH | Todos os candidatos vinculados a vagas |
| 7 | `/matching` | Matching IA | RH | Ranking de candidatos por score de IA por vaga |
| 8 | `/triagem` | Triagem | RH | Kanban: mover candidatos entre etapas do processo |
| 9 | `/gestao/processo-seletivo` | Processo Seletivo | RH | Visão das fases e candidatos por projeto/rodada |
| 10 | `/gestao/projetos` | Projetos (Rodadas) | RH | Agrupa candidatos aprovados por rodada de seleção |
| 11 | `/agendas` | Agendas | RH | Agenda entrevistas e eventos vinculados a candidatos |
| 12 | `/admissao` | Pré-Admissão | RH / DP | Coleta documentos e aprova a contratação final |

---

## Detalhe de Cada Passo

---

### PASSO 1 — Gestor solicita uma vaga
**Tela:** `/gestao/solicitacoes`

O gestor preenche um formulário com:
- Título do cargo, justificativa, urgência (crítica/alta/média/baixa)
- Área, unidade, tipo de solicitação (nova vaga ou substituição)
- Se substituição: informa o nome do funcionário substituído

Ao submeter, o sistema resolve automaticamente quem deve aprovar (gestor direto na hierarquia).

**Status possíveis:** Rascunho → Pendente de Aprovação → Aprovada / Reprovada / Ajustes Necessários

---

### PASSO 2 — Aprovação da solicitação
**Tela:** `/gestao/aprovacoes`

O aprovador vê as solicitações pendentes, pode:
- **Aprovar** → sistema cria automaticamente uma Vaga no módulo de recrutamento
- **Reprovar** → notifica o solicitante
- **Pedir ajustes** → devolve para o gestor editar

> ⚠️ **Bug corrigido (Mar 2026):** A vaga criada por aprovação de solicitação não exige filtros de matching preenchidos na criação. O RH configura os filtros depois em `/vagas`.

---

### PASSO 3 — RH configura a vaga
**Tela:** `/vagas`

A vaga chega pré-criada (ou o RH cria manualmente). O RH então:
1. **Edita a vaga** (10 abas): dados básicos, requisitos, filtros de matching IA, etapas do processo, publicação
2. **Define os requisitos**: palavras-chave com peso (0-10) e flag de "obrigatório"
3. **Configura filtros de matching IA**: modalidade, senioridade, escolaridade, cidade, habilidades, etc.
4. Clica em **"Matching"** para ver o ranking de candidatos para esta vaga

---

### PASSO 4a — Candidatos chegam pela internet
**Tela:** `/entradaemailpasta`

Currículos chegam automaticamente via:
- Monitoramento de caixa de e-mail IMAP
- Pasta do servidor (watcher)
- Upload manual de PDF

O sistema extrai os dados com IA (GPT) e cria registros de candidatos/talentos.

---

### PASSO 4b — RH cadastra talentos manualmente
**Tela:** `/talentos`

Banco de pessoas que **ainda não são candidatos de uma vaga específica**.

Usos:
- Cadastrar alguém que enviou currículo espontâneo
- Importar PDF de currículo (extração IA)
- Depois: clicar em **"Candidatar"** para vincular à vaga → pessoa entra em `/candidatos` com status "Triagem"

**Fluxo visual na tela:**
```
Banco de Talentos → [Candidatar] → Candidatos → Triagem → Matching
```

---

### PASSO 4c — RH adiciona candidato direto
**Tela:** `/candidatos` → "Novo candidato"

Cadastro direto já vinculando à vaga. Entra com status "Triagem".

---

### PASSO 5 — Scoring automático
Ao adicionar texto do CV (em `/candidatos` → aba "Texto do CV"), o sistema calcula:

```
score = (soma dos pesos dos requisitos encontrados / soma de todos os pesos) × 100
Penalidade: −15 pontos por requisito OBRIGATÓRIO não encontrado (máximo −40)
```

O score determina se o candidato passa o threshold (match mínimo configurado na vaga).

---

### PASSO 6 — Matching IA
**Tela:** `/matching`

Ranking automático de candidatos por vaga, com score calculado pelo serviço de IA (`RHPortal.Ai`).

- Acessado via botão "Matching" na tela de Vagas
- 4 abas: **Triagem** (sugestões), **Aprovados**, **Reprovados**, **Pendentes**
- Arrastar card entre abas muda o status do candidato
- Edição de filtros IA sem sair da tela

---

### PASSO 7 — Triagem (Kanban)
**Tela:** `/triagem`

Board kanban com 4 colunas:
1. **Em triagem** → candidatos aguardando análise
2. **Pendente** → aguardando retorno do candidato, teste, etc.
3. **Aprovado** → perfil aprovado pelo RH
4. **Reprovado** → sem aderência

Auto-triagem: move candidatos automaticamente com base no score vs. threshold.

---

### PASSO 8 — Rodadas de Seleção
**Tela:** `/gestao/projetos`

Agrupa candidatos aprovados em "Rodadas" para avançar no processo com a área solicitante.

---

### PASSO 9 — Processo Seletivo
**Tela:** `/gestao/processo-seletivo`

Visão das etapas do processo (entrevista RH, teste técnico, entrevista com gestor, proposta, etc.) e o status de cada candidato em cada etapa.

---

### PASSO 10 — Pré-Admissão
**Tela:** `/admissao`

Candidato aprovado vira pré-admissão. RH/DP coleta:
- Dados pessoais, bancários, trabalhistas e documentos
- Submete para revisão → aprovação final
- Ao aprovar: sistema cria automaticamente o usuário (ApplicationUser) e o Funcionário

**Status:** Rascunho → Em Revisão → Aprovada / Rejeitada → Integrada

---

## Estado Atual de Cada Tela

| Tela | Status | Funciona? | Observações |
|------|--------|-----------|-------------|
| `/gestao/solicitacoes` | ✅ Implementada | Sim | CRUD completo, aprovadores automáticos |
| `/gestao/aprovacoes` | ✅ Implementada | Sim | Aprovação cria vaga corretamente (bug corrigido) |
| `/vagas` | ✅ Implementada | Sim | UI nova com shadcn, filtros funcionando |
| `/talentos` | ✅ Implementada | Sim | Auto-carrega, botão Candidatar funciona, modais OK |
| `/entradaemailpasta` | ⚠️ Implementada | Parcial | Depende de SignalR e configuração de email/pasta |
| `/candidatos` | ✅ Implementada | Sim | Lista, detalhe, upload CV, documentos |
| `/matching` | ✅ Implementada | Sim | Depende do serviço `RHPortal.Ai` estar rodando |
| `/triagem` | ⚠️ Implementada | Parcial | Usa endpoints `/api/triagem/*` — verificar se existem |
| `/gestao/projetos` | ✅ Implementada | Sim | Rodadas de seleção |
| `/gestao/processo-seletivo` | ✅ Implementada | Sim | Etapas do processo |
| `/agendas` | ⚠️ Implementada | Parcial | Depende de SignalR rodando |
| `/admissao` | ✅ Implementada | Sim | CRUD, submit, approve, documentos |

---

## Dependências para o Módulo Funcionar 100%

```
✅ Obrigatório sempre:
   - RHPortal.Api (porta 5056) — backend principal
   - LioTecnica.Web (porta 5051) — portal Razor (reverse proxy)
   - Next.js (porta 3000) — frontend novo

⚠️ Necessário para IA / Matching:
   - RHPortal.Ai (FastAPI/Python) — scoring por IA e embeddings
   - OpenAI API Key configurada em appsettings.json

⚠️ Necessário para Entrada Email/Pasta e Agendas:
   - SignalR hub ativo (incluído na API)
   - Configuração de IMAP (email) e/ou pasta monitorada no Admin

✅ Banco de dados:
   - PostgreSQL com todas as migrations aplicadas
   - Tenants: dev_render_dev, dev_render_liotecnica
```

---

## O Que Não Está Ligado (Links Quebrados / Sem Navegação Clara)

| Problema | Onde | Como deveria funcionar |
|----------|------|----------------------|
| Tela de Vagas não tem link direto para "Ver candidatos desta vaga" | `/vagas` | Botão → navega para `/candidatos?vagaId=...` |
| Candidato aprovado no Matching não tem caminho claro para Admissão | `/matching` | Botão "Iniciar Admissão" → `/admissao/nova?candidatoId=...` |
| Triagem não linka para Matching | `/triagem` | Botão "Ver no Matching" por vaga |
| Banco de Talentos não mostra vagas compatíveis | `/talentos` | Score estimado ao lado do nome da vaga no modal "Candidatar" |
| Não existe dashboard de funil | — | Deveria existir `/dashboard` com: vagas abertas → candidatos → triagem → aprovados → admissões |

---

## Fluxo Resumido para Uso do Dia a Dia

### Fluxo A — Candidato chegou espontaneamente
```
1. Entra em /talentos
2. Clica "Importar PDF" ou "Novo talento"
3. Clica "Candidatar" → seleciona a vaga → confirma
4. Vai para /matching (botão "Matching" na tela de Vagas)
5. Analisa o score → Aprova ou Reprova
6. Se aprovado → vai para /admissao → Nova Admissão
```

### Fluxo B — Abertura formal de vaga pela empresa
```
1. Gestor acessa /gestao/solicitacoes → cria solicitação
2. Aprovador acessa /gestao/aprovacoes → aprova
3. RH acessa /vagas → configura requisitos e filtros de IA
4. Candidatos chegam via /entradaemailpasta ou cadastro manual em /candidatos
5. RH acessa /matching → analisa ranking
6. Aprovados vão para /triagem → kanban → novas etapas
7. Finalista vai para /admissao
```

### Fluxo C — Só quero ver quem tem perfil para a vaga X
```
1. /vagas → clica em "Matching" na linha da vaga
2. Score automático já aparece na aba "Triagem"
3. Arrasta para "Aprovados" os que passarem
4. Exporta ou agenda entrevista em /agendas
```

---

## Serviços e Portas (Dev Local)

| Serviço | Porta | Tecnologia | Obrigatório |
|---------|-------|------------|-------------|
| Next.js (frontend novo) | 3000 | Next.js 15 + React | ✅ |
| LioTecnica.Web (portal Razor) | 5051 | ASP.NET Core Razor Pages | ✅ |
| RHPortal.Api (API principal) | 5056 | ASP.NET Core Web API | ✅ |
| RHPortal.Ai (IA) | 8000 | FastAPI / Python | ⚠️ (só para matching IA) |
| Integration.RM (legado) | — | — | ❌ (não precisa para o módulo) |
| PostgreSQL | 5432 | PostgreSQL | ✅ |

### Como subir só o necessário
```bash
# Opção rápida (API + Portal + Next.js)
bash __scripts__/dev/dev-core.sh

# Opção completa (tudo incluindo IA)
bash __scripts__/dev/dev-all.sh
```

---

## Bugs Conhecidos (ainda em aberto)

| ID | Severidade | Onde | Descrição |
|----|-----------|------|-----------|
| B01 | 🟡 Médio | `/triagem` | Endpoints `/api/triagem/*` podem não existir no backend — confirmar |
| B02 | 🟡 Médio | `/matching` | Sem serviço de IA (`RHPortal.Ai`), matching-ranking retorna 503 |
| B03 | 🟡 Médio | `/candidatos` detalhe | Endpoint `/api/candidatos/{id}/documents` pode retornar 404 (endpoint correto é `/documentos` não `/documents`) |
| B04 | 🟠 Baixo | `/matching` | Sem reversão automática se ação de status falhar na API |
| B05 | 🟠 Baixo | `/vagas` | Não há navegação de "Vaga → Candidatos desta vaga" |
| B06 | 🟠 Baixo | Geral | Não existe tela de dashboard de funil de recrutamento |
