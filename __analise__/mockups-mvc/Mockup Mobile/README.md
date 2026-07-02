# Protótipo Mobile — Talent RH

Protótipo navegável com **17 telas** do recrutamento (analista RH) e portal de candidatos (Liotécnica).

## Como abrir

1. Abra [`index.html`](index.html) no navegador (duplo clique ou servidor estático).
2. Escolha **Analista RH** ou **Candidato**.

> Para módulos ES (`import`), use servidor local se o navegador bloquear `file://`:
> `npx serve "__analise__/mockups-mvc/Mockup Mobile"`

## Mapa de telas

### Analista RH (13 telas)

| Tela | Arquivo | Descrição |
|------|---------|-----------|
| Dashboard | `dashboard-mobile.html` | Home com KPIs, funil e ações rápidas |
| Detalhe requisição | `detalhe-requisicao-mobile.html` | Requisição RM + distribuir para analista |
| Gestão de vagas | `gestao-vagas-mobile.html` | Lista de vagas por status |
| Detalhe vaga publicada | `detalhe-vaga-publicada-mobile.html` | Métricas, canais e pipeline |
| Banco de talentos | `banco-talentos-mobile.html` | Busca e filtros de candidatos |
| Matching | `matching-candidatos-mobile.html` | Ranking para vaga |
| Kanban | `kanban-candidatos-mobile.html` | Funil visual por etapa |
| Perfil candidato | `perfil-candidato-mobile.html` | Visão RH do candidato |
| Agenda | `agenda-entrevistas-mobile.html` | Entrevistas da semana |
| Avaliação | `avaliacao-entrevista-mobile.html` | Formulário pós-entrevista RH |
| Aprovação gestor | `aprovacao-gestor-mobile.html` | Decisão do gestor |
| Proposta | `proposta-pre-admissao-mobile.html` | Oferta e documentos |
| Relatórios | `relatorios-mobile.html` | Analytics (aba Mais) |

### Candidato — portal público (4 telas)

| Tela | Arquivo | Descrição |
|------|---------|-----------|
| Oportunidades | `portal-oportunidades-mobile.html` | Vitrine de vagas |
| Detalhe vaga | `portal-detalhe-vaga-mobile.html` | Página da vaga (Liotécnica) |
| Candidatura | `portal-candidatura-mobile.html` | Formulário de inscrição |
| Área do candidato | `portal-area-candidato-mobile.html` | Acompanhamento de candidaturas |

## Roteiro de demonstração (~5 min)

### Fluxo RH

1. **index.html** → Analista RH → Dashboard
2. Ações rápidas: **Banco de talentos** → toque em um candidato → **Perfil**
3. **Agendar entrevista** → Agenda → toque em entrevista → **Avaliação**
4. **Avançar candidato** (selecionar “Avançar para gestor”) → **Aprovação gestor**
5. **Confirmar aprovação** → **Proposta e pré-admissão**
6. Bottom nav: **Vagas** → vaga publicada → **Ver** → Detalhe → **Ver candidatos** → Kanban
7. **Compartilhar** no detalhe da vaga → abre visão pública (portal)

### Fluxo candidato

1. **index.html** → Candidato → Oportunidades
2. **Ver vaga** → Detalhe → **Candidatar-se** → preencher e **Enviar**
3. Redireciona para **Área do candidato** com stepper de etapas

## Navegação técnica

- [`js/routes.js`](js/routes.js) — registro de rotas (`rh-dashboard`, `pub-vaga`, etc.)
- [`js/nav.js`](js/nav.js) — `navigateTo()`, bottom nav RH/portal, atributo `data-route`
- Elementos com `data-route="rh-kanban"` navegam automaticamente
- `data-route-toast` exibe mensagem antes de navegar

## Limitações

- Sem backend; dados ilustrativos
- Toasts em ações sem tela (exportar, notificações, filtros avançados)
- Tab Requisições abre detalhe (não há lista de requisições)
