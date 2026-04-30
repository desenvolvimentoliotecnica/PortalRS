# Milestones — RenderRH Portal

Histórico de entregas planejadas via GSD. O repositório já contém código brownfield antes deste planejamento formal.

## Concluídos (baseline)

- **Baseline** — Plataforma multi-tenant Portal RH (.NET API + Next.js), vagas públicas/recrutamento, candidatos, matching, leitura de requisições RM (consulta/admin), conforme código atual no repositório.

## Concluídos (milestones GSD)

### v1.0 — Abertura de vaga (aumento de quadro) + integração TOTVS RM

**Shipped:** 2026-04-30  
**Phases:** 1–6 (domain → RM write → sync → gestor UI → RH seleção UI)  
**Archives:** [v1.0-ROADMAP.md](./milestones/v1.0-ROADMAP.md) · [v1.0-REQUIREMENTS.md](./milestones/v1.0-REQUIREMENTS.md)

**Accomplishments (high level):**

1. Agregado **SolicitacaoVaga** com workflow portal pré-RM, auditoria e integração RM (criação + sync CODSTATUS).
2. UI gestor Next (**UIT-01**) com formulário multi-seção e alinhamento API.
3. Workspaces RH **`/rh/contratacoes/*`**, permissões JWT **`rh.*`**, fluxos **SEL**, **indicações**, widening seguro de listagem/detalhe com **`HasPermission`**.
4. Testes API verdes + **`npm run build`**; UAT Fase 6 **7/7** ([06-UAT.md](./phases/06-ui-operacoes-rh-selecao/06-UAT.md)).

### Known gaps / follow-ups at close

- **`v1.0-MILESTONE-AUDIT.md`** não existia antes do close — recomenda-se **`$gsd-audit-milestone`** num ciclo seguinte para evidência REQ-a-REQ.
- **SEL-02** (banco de talentos): roadmap admitia *gap MVP*; validar profundidade com cliente piloto.
- Duplicidade potencial no sidebar para **`/gestao/aprovacoes`** quando o utilizador tem várias permissões — UX follow-up opcional.

## Planejado

- **v1.1+** — A definir via **`$gsd-new-milestone`**.

---

*Última atualização: **2026-04-30** — milestone **v1.0** arquivado.*
