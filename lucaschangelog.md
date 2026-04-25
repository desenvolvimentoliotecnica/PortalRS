# lucas — Changelog pessoal

> **Autor:** Lucas Machado · **Branch:** `feature/ia-rag-fase-4-5_v2`
> Histórico do que **eu** efetivamente fiz no projeto. Independente do `changelog.md` global do time. Cada entrada vincula ao item do `lucasbacklog.md` quando aplicável.

> **Convenção:** entradas em ordem reversa (mais recente em cima). Cabeçalho de cada dia: `## YYYY-MM-DD`. Cada item: tipo (✨ feature, 🐛 bugfix, 🔧 refactor, 📝 docs, 🏗️ infra, 🔬 spike) + título + impacto resumido + commit/PR (quando houver).

---

## 2026-04-24

### 📝 docs · Onboarding inicial — leitura completa do projeto + documentação derivada
- **O que fiz:**
  - Cloneei o repo do Azure DevOps (branch `feature/ia-rag-fase-4-5_v2`).
  - Naveguei pelo monorepo inteiro: frontend Next.js, API .NET, serviço Python de IA, worker de integração TOTVS, scripts, knowledge-base, dumps.
  - Li `README.md`, `CLAUDE.md`, `VISAO_GERAL_PROJETO.md`, `GUIA_IA_RAG.md`, `FLUXO_IA_MATCHING.md`, `STATUS_MATCHING_VETORIZADO.md`, `PLANO_EVOLUCAO_MATCHING_65_35.md`, `COMO_USAR_MATCHING_IA.md`, `INTEGRACAO-MOVIMENTACOES-DATASUL.md`, `RECRUTAMENTO_FLUXO.md`, `PORTAL_MVC_INVENTARIO_E_MIGRACAO.md`.
  - Mapeei: 98 controllers, 146 entidades de domínio, 369 migrations EF, ~10 background workers, 12 sub-services do worker RM, ~4900 LoC do serviço Python.
- **Arquivos novos meus:**
  - `lucasVISAO_GERAL.md` — visão de negócio executiva, personas, domínios, mapa visual, glossário.
  - `lucasSTACK_TECNOLOGICA.md` — inventário técnico completo (front, API, IA, worker RM, banco, infra, CI/CD, ferramentas dev).
  - `lucasMODULOS_FUNCIONALIDADES.md` — mapa tela por tela (28 módulos), abas internas, ações, endpoints consumidos, permissões.
  - `lucasINTEGRACOES.md` — inventário de integrações externas e sub-projetos (TOTVS RM, Datasul, Entra ID, OpenAI, Gemini, Ollama, S3, SMTP, WhatsApp, Blip, Nominatim, pgvector, Inbox, CI/CD, Docker).
  - `lucasIA_RAG.md` — foco na Fase 4.5: pipeline RAG detalhado, regra v1 vs v2 (65/35 + gates), componentes, persistência, gatilhos, perf, plano de rollout.
  - `lucasbacklog.md` — meu backlog pessoal (LUC-001…LUC-023, LUC-100+).
  - `lucaschangelog.md` — este arquivo.
- **Impacto:** tenho o mapa mental do projeto inteiro. Próximos commits podem ir direto pra implementação sem reabrir o monorepo.

---

## Como vou registrar a partir daqui

Sempre que eu:
- **Implementar uma feature** → entrada com ✨ + descrição + arquivos tocados + commit/PR
- **Corrigir bug** → 🐛 + sintoma + causa + correção
- **Refatorar** → 🔧 + por que (não o quê — o quê fica no diff)
- **Adicionar/mudar doc** → 📝
- **Mexer em infra** → 🏗️ (CI, docker, scripts, migrations não-código)
- **Fazer spike** → 🔬 + decisão go/no-go + dados

Modelo de entrada:
```md
### {emoji} {tipo} · {título curto}
- **Contexto:** por que estava fazendo
- **O que mudou:** lista pontual
- **Arquivos:** principais
- **Commit/PR:** sha ou link (quando houver)
- **Item backlog:** LUC-XXX (se vier do backlog)
- **Impacto:** uma linha
```
