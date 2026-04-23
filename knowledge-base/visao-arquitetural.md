# Visão Arquitetural — Voltage.RenderRH

**Natureza deste documento:** descreve o sistema-alvo (TO-BE) conforme entendimento do arquiteto, capturado em sessão de entrevista em 2026-04-17.
Para o estado atual (AS-IS), ver [documentacao.md](../documentacao.md).
Para mapa funcional da sidebar atual, ver [sidebar-blocos-e-abas.md](./sidebar-blocos-e-abas.md).

---

## 1. Propósito

Plataforma de RH modular SaaS multi-tenant com três eixos de contratação independentes (Recrutamento e Seleção, Gestão de Pessoas, Folha de Pagamento), apoiada por IA para matching e sustentada por uma fundação comum de cadastros.

## 2. Princípios arquiteturais

1. **Pacotes comerciais são o nível primário de entitlement.** O Owner contrata pacotes; módulos finos só existem dentro de um pacote contratado.
2. **Cadastros é fundação core** — não contratável, sempre disponível, alimenta todos os pacotes.
3. **Relatórios é capability transversal core** — não é pacote nem módulo.
4. **Separação Owner × Admin do tenant** é invariante (ver `documentacao.md`).
5. **Multi-tenant com banco por tenant** é invariante operacional (não muda agora).
6. **IA fica em serviço separado (Python)** — integração por HTTP.
7. **Next.js é o frontend-alvo**; Portal MVC (`LioTecnica.Web`) será **refatorado e migrado** para Next.js (não é descontinuação simples — o conteúdo funcional precisa ir junto).
8. **Dados operacionais isolados por tenant** mesmo quando expostos via Owner (suporte cross-tenant).

## 3. Modelo em camadas

```
┌────────────────────────────────────────────────────────────┐
│  PACOTES COMERCIAIS  (entitlement do Owner)                │
│  ─────────────────────────────────────────────             │
│  • Recrutamento e Seleção                                  │
│  • Gestão de Pessoas                                       │
│  • Folha de Pagamento  (futuro)                            │
│                                                            │
│  Regras:                                                   │
│  - Cliente pode contratar qualquer combinação de pacotes   │
│  - Módulo só é contratado se pacote-pai estiver contratado │
└────────────────────────────────────────────────────────────┘
                            ▲
                            │ depende de
                            │
┌────────────────────────────────────────────────────────────┐
│  CORE  (sempre ligado)                                     │
│  ──────────────────────                                    │
│  • Cadastros   (fundação de todos os pacotes)              │
│  • Admin       (usuários, perfis, configs, logs)           │
│  • Relatórios  (capability transversal, personalizável)    │
└────────────────────────────────────────────────────────────┘
```

---

## 4. Taxonomia

### 4.1 Pacote: Recrutamento e Seleção

| Módulo | Descrição |
|---|---|
| Portal de Vagas Externo | Portal público (tipo Vagas.com) com **autenticação de candidato**; mostra etapa **macro** da vaga; candidatura via cadastro |
| Vagas | Vagas abertas + integração Totvs RM; quadro operacional do RH |
| Banco de Currículos | Base de candidatos do tenant |
| Pipeline de Vaga | Ciclo de vida da vaga: entrevista → admissão; integração Totvs RM na contratação; **aceite digital da proposta** (convive com e-mail) |
| Match IA | Correlação descrição × currículo; parecer e match score via serviço Python |
| Onboarding/Admissão | Banco de documentos **flexível**; templates por **Cargo Macro** |

**Definições operacionais do pacote R&S:**

- **Carteira de vaga** (N vagas → 1 recrutador). Visibilidade por papel:
  - **Recrutador** → só sua carteira
  - **Gestor do recrutador** (ex.: Gerente de RH) → todas as vagas + distribuição por recrutador (**visão kanban**)
  - **Gestor da área** → processo seletivo das vagas da sua área (ex.: Lucas de TI vê vagas de TI; Carlos de Financeiro vê vagas de Financeiro)
- **Faixa salarial travável**: flag por vaga. Se travada e necessário contratar fora → **alçada de aprovação** obrigatória.
- **SLA de vaga**: por **eixo** (dado mestre cadastrado pelo admin do tenant). Vaga aponta seu eixo; SLA herda da config do eixo. Eixos típicos: Estratégica, Operacional — abertos a customização pelo admin.
- **Notificações automáticas**: selecionado/não selecionado via e-mail (hoje) e **WhatsApp** (futuro). Carta proposta automática + envio do onboarding documental ao selecionado.

### 4.2 Pacote: Gestão de Pessoas

| Módulo | Descrição |
|---|---|
| Avaliação de Desempenho | **Nine Box** — ciclos configuráveis (trim/sem/anual); gestores avaliam por hierarquia; **comitê de calibragem** entre líderes |
| PDI | Plano de Desenvolvimento Individual com ações e acompanhamento |
| Feedback | Envio/recebimento, 1:1, celebração. **Sem gamificação** |
| Metas | Metas individuais (backlog aberto) |
| Plano de Carreira e Sucessão | (backlog aberto) |

**Definições operacionais do pacote Gestão de Pessoas:**

- **Ciclo de avaliação**: criado pelo admin do tenant, com período configurável (trimestral / semestral / anual) e escopo.
- **Hierarquia de avaliação**: cada gestor avalia seus reportes diretos (usa o organograma do Admin).
- **Comitê de calibragem**: membros definidos por ciclo; workflow formal (rascunho → **proposta do comitê** → **decisão final do gestor**). **O gestor do colaborador tem palavra final**; o sistema registra a divergência — o que o comitê propôs × o que o gestor decidiu — como histórico auditável.

### 4.3 Pacote: Folha de Pagamento (futuro)

Módulos previstos quando o pacote for implantado:
- Folha de pagamento
- Pagamento Extra
- Desligamentos / Rescisão
- Férias
- Ponto Eletrônico (usando Turnos)

**Estado transitório:** itens parciais existentes hoje (`Batida de Ponto`, `Pagamento Extra`, `Desligamentos`) **devem sumir totalmente da UI** até o pacote oficial nascer.

### 4.4 Core: Cadastros

Fundação não-contratável. Alimenta todos os pacotes.

| Cadastro | Observação |
|---|---|
| Empresas | |
| Estabelecimentos | (≈ `Unidades` no sistema atual) |
| Centros de Custo | **Com hierarquia organizacional**, construída na plataforma (hoje é flat) |
| Cargos | |
| Categorias Salariais | Tabela de Cargos × Salários |
| Funcionários | Com perfil de acesso |
| Departamentos | |
| Funções | |
| Turnos | **Por unidade** (unidade fabril tem turnos X/Y/Z; unidade administrativa tem A/B) |
| Cargo Macro (Nível Ocupacional) | Usa `NivelCargo` existente. Hierarquia: operador → assistente → analista → especialista → coordenador → gerente → diretor. **Chave de template de onboarding** |
| Descrição de Cargos | **Novo**: upload de documento + editor; template por **Cargo Macro**; alimenta criação de vaga |
| Pessoas | Base neutra (origem: Manual/Talento/Vaga/Email/Pasta/Funcionário); alimenta Candidato, Talento, Funcionário, Inbox |
| Áreas | Hierarquia organizacional com dono (Funcionário responsável); suporta RBAC do "Gestor de Área" em R&S |
| Bloqueio de Pessoa | Detalhe de Pessoa (não aparece na sidebar top-level); blacklist usada por Candidato/Talento |

### 4.5 Core: Admin

Mantém como está por ora — decisões diferidas. Único ajuste previsto:

- **Logs operacionais do tenant** devem ser expostos **ao admin do tenant**, com **isolamento por tenant** (admin só vê do seu). Hoje o endpoint `/api/admin/operational-logs` é chamado pelo frontend mas não existe na API — já está no backlog.

### 4.6 Core: Relatórios (capability transversal)

Relatórios **não é pacote nem módulo** — é capability disponível em qualquer contratação, personalizável. Cada pacote contribui com seus relatórios.

---

## 5. Conceitos de domínio a criar/evoluir

| Conceito | Novo / Evolução | Descrição |
|---|---|---|
| `PacoteComercial` | Novo | Catálogo de pacotes; entity `TenantPackage` persiste contratação |
| `EixoVaga` | Novo | Dado mestre por tenant; admin cadastra; `Vaga` aponta eixo + herda SLA |
| `SlaConfig` por eixo | Novo | Configuração do SLA vinculada ao eixo |
| `CarteiraVaga` | Novo | `Vaga.RecrutadorResponsavelId` + RBAC por papel; kanban |
| `FaixaSalarialTravada` + alçada | Novo | Flag na vaga + workflow de aprovação quando violada |
| `AceiteDigitalProposta` | Novo | Assinatura eletrônica da proposta (convive com e-mail) |
| `CicloAvaliacao` | Novo | Período, status (aberto/fechado), escopo |
| `AvaliacaoNineBox` | Novo | Resultado da avaliação por ciclo |
| `ComiteCalibragem` | Novo | Membros; proposta do comitê; decisão final do gestor; histórico da divergência |
| `DescricaoCargoTemplate` | Novo | Documento/template por Cargo Macro |
| `HierarquiaCentroCusto` | Evolução | Construir árvore sobre cadastro flat atual |
| `TurnoPorUnidade` | Evolução | Confirmar se modelo atual suporta; ajustar se não |
| `PortalExternoCandidato` | Evolução | Autenticação + cadastro + visibilidade macro de etapa |
| Notificações WhatsApp | Novo | Canal adicional ao e-mail |

---

## 6. Gap visão-alvo × sistema atual

### 6.1 O que já existe e está alinhado

- Core atuais (`administracao`, `cadastros`, `configuracoes`, `dashboard`)
- Módulos que vão compor o pacote R&S: `recrutamento`, `candidatos`, `matching`, `portal-vagas`, `admissao`
- Módulos que vão compor o pacote Gestão de Pessoas: `gestao`, `feedback` (parcial)
- PDI, Feedback (envio, 1:1, celebração), Admissão/pré-admissão com TOTVS
- Separação Owner × Admin do tenant estabelecida
- Suite API verde (425/425), logs Owner funcionais, KB da sidebar

### 6.2 Backlog estratégico (derivado da visão)

**Camada de entitlement** (fundação de tudo)
- [ ] Introduzir `PacoteComercial` + `TenantPackage` **acima** do `ModuleCatalog` / `TenantModule`
- [ ] Regra "módulo só é contratado se pacote-pai estiver contratado"
- [ ] UI no Owner: toggle por pacote, com módulos filhos agrupados
- [ ] Gate backend por pacote (fase 2 — hoje só filtra menu)

**Pacote R&S — features**
- [ ] Carteira de vaga (atribuição + RBAC Recrutador / Gestor do Recrutador / Gestor de Área + visão kanban)
- [ ] `EixoVaga` como dado mestre por tenant + SLA por eixo configurável pelo admin
- [ ] Flag "travar faixa salarial" na vaga + workflow de alçada quando violada
- [ ] Aceite digital da proposta (convive com fluxo atual de e-mail)
- [ ] Portal externo com autenticação de candidato + visibilidade macro de etapa + candidatura via cadastro
- [ ] Onboarding por template de Cargo Macro (usa `NivelCargo`)
- [ ] Notificações WhatsApp (além de e-mail)

**Pacote Gestão de Pessoas — features**
- [ ] Módulo `desempenho` no catálogo (hoje permissões `desempenho*` sem mapeamento)
- [ ] `CicloAvaliacao` + Nine Box + workflow de comitê de calibragem com registro de divergência gestor × comitê
- [ ] Remover **Gamificação** da sidebar e do backlog de UX

**Pacote Folha (diferido)**
- [ ] Sumir `Batida de Ponto`, `Pagamento Extra`, `Desligamentos` da sidebar atual até o pacote oficial nascer

**Core — Cadastros**
- [ ] Hierarquia organizacional em Centros de Custo
- [ ] Novo cadastro "Descrição de Cargos" (upload + editor; template por Cargo Macro)
- [ ] Confirmar que modelo de Turnos suporta vínculo por unidade; adaptar se necessário

**Core — Admin**
- [ ] Endpoint `/api/admin/operational-logs` para admin do tenant com isolamento (já no backlog)

**Infra / refatoração do Portal MVC**
- [ ] **Refatorar Portal MVC (`LioTecnica.Web`) migrando telas, proxies e integrações para Next.js (`LioTecnica.Web.Next`)**. Ordem sugerida: (a) inventário do que ainda é usado no MVC (rotas, views, controllers, JS), (b) priorizar telas críticas vs descartáveis, (c) migrar incrementalmente com cobertura de teste, (d) só então descontinuar o projeto MVC. Base de referência: [MIGRACAO-RAZOR-PARA-NEXT-ANALISE.md](../MIGRACAO-RAZOR-PARA-NEXT-ANALISE.md).

### 6.3 Gaps de coerência do KB resolvidos pela visão

Os gaps de permissões sem módulo (em `sidebar-blocos-e-abas.md`) agora têm destino natural:

| Permissão sem módulo | Destino na visão |
|---|---|
| `desempenho*` | Pacote Gestão de Pessoas → módulo Avaliação de Desempenho |
| `turnos.*` | Pacote Folha (futuro) / Core Cadastros |
| `categorias-salariais.*` | Core Cadastros (Tabela de Cargos e Salários) |
| `centros-custo.*` | Core Cadastros (com hierarquia) |
| `unidades-lotacao.*` | Core Cadastros (Estabelecimentos) |
| `talentos.*` | Pacote R&S (Banco de Currículos) |
| `api-keys.*`, `admin.gestores.*`, `admin.regras-aprovacao.*`, `admin.hierarquia.*` | Core Admin |
| `nivel-cargo.*` | Core Cadastros (Cargo Macro) |

### 6.4 Cadastros/itens existentes — decisões de posicionamento

Investigados em 2026-04-17 (varredura de entities, controllers, services, telas e permissões). Decisões aplicadas:

| Item | Decisão | Destino |
|---|---|---|
| `Pessoas` (`/pessoas`) | **Manter** | Core Cadastros — base neutra (origem: Manual/Talento/Vaga/Email/Pasta/Funcionário); alimenta todos os pacotes |
| `Áreas` (`/areas`) | **Manter** | Core Cadastros — hierarquia organizacional com dono; suporta RBAC do "Gestor de Área" da carteira de vaga |
| `Bloqueio de Pessoa` (`/bloqueiopessoa`) | **Subordinar** | Core Cadastros, acessível **pelo detalhe da Pessoa** — sair da sidebar top-level |
| `Humor` (`/gestao/humor`) | **Reposicionar** | Pacote **Gestão de Pessoas** → módulo Feedback |
| `Resumo Atividades` (`/gestao/resumoatividades`) | **Reposicionar** | Pacote **Gestão de Pessoas** → módulo Feedback (sub-dashboard) |
| `Agenda` (`/agendas`) | **Reposicionar** | Pacote **R&S** → módulo Pipeline de Vaga (sair do bloco Operacional) |
| `Entrada (e-mail/pasta)` (`/entradaemailpasta`) | **Reposicionar** | Pacote **R&S** → módulo Portal de Vagas/Banco de Currículos (consolida com `entrada.*` do `ModuleCatalog`) |
| `Painel de Solicitações` (`/gestao/painel-solicitacoes`) | **Decidido — B1 (transversal core)** | **Onda 14, 2026-04-20:** promovido para o bucket `principais` (`Destacado: true, Ordem: 40` no `NavegacaoManifest`) e adicionado ao `PRINCIPAIS_ORDER` do front. Justificativa: agregador analítico multi-tipo que cruza R&S (Vaga), Folha (Promoção/Desligamento/Férias/Benefício) e Cadastros (Dependente/Endereço); colocá-lo em Gestão de Pessoas excluiria gestores de R&S/Folha; B3 (dividir por pacote) perderia a visão consolidada. Fica ao lado do par workflow `Minhas Pendências` / `Solicitações`. Permissão preservada: `gestao.dashboard` |

**Correção registrada:** `Funcionários` permanece em Core Cadastros (§4.4), não migra para Gestão de Pessoas.

**Nota de implementação:** estas decisões serão refletidas na sidebar, no `ModuleCatalog` e no `permissionManifest` conforme os épicos dos respectivos pacotes forem executados (§6.2).

---

## 7. Invariantes arquiteturais

Não mudam no horizonte atual:

- Multi-tenant com banco por tenant (`dev_render_{tenantId}`)
- Master DB para metadados de tenant/owner
- Next.js como frontend-alvo
- IA em serviço Python separado (HTTP)
- Separação Owner × Admin do tenant
- EF Core migrations idempotentes (ver [CLAUDE.md](../CLAUDE.md))
- Portal MVC em refatoração (migração para Next.js)

---

## 8. Próximos passos

1. Validar o backlog estratégico (§6.2) com o arquiteto e priorizar
2. Resolver cadastros órfãos (§6.4)
3. Atacar primeiro a **camada de entitlement** (§6.2 primeiro bloco) — é fundação para tudo
4. Cada item vira épico no `backlog.md` com quebra em subtarefas técnicas
5. Para novos conceitos de domínio (§5), modelar entidades EF + migrations conforme `CLAUDE.md`
