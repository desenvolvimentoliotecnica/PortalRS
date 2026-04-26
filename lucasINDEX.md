# lucas — Índice da minha documentação

> **Autor:** Lucas Machado · **Branch:** `feature/ia-rag-fase-4-5_v2` · **Início:** 2026-04-24
> Ponto único de entrada para a documentação que **eu** mantenho neste projeto. Tudo prefixado com `lucas` para ficar fácil de filtrar (`ls lucas*` ou busca no editor).

---

## Para quê serve cada arquivo

| Arquivo | Quando consultar |
|---|---|
| **[lucasVISAO_GERAL.md](./lucasVISAO_GERAL.md)** | Visão executiva: o que é o produto, personas, domínios, sub-projetos, glossário. Comece por aqui se quiser explicar para alguém o que é o RenderRH. |
| **[lucasSTACK_TECNOLOGICA.md](./lucasSTACK_TECNOLOGICA.md)** | Inventário técnico de cada camada (frontend, API, IA, worker, banco, infra). Use para decisões de stack ou onboarding técnico. |
| **[lucasMODULOS_FUNCIONALIDADES.md](./lucasMODULOS_FUNCIONALIDADES.md)** | Mapa tela por tela do produto (28 módulos). Cada tela com abas, ações, endpoints consumidos. Use para "onde fica X?" |
| **[lucasINTEGRACOES.md](./lucasINTEGRACOES.md)** | Integrações externas (TOTVS, Entra ID, OpenAI, S3, SMTP, WhatsApp...) e sub-projetos auxiliares. Use para entender o que entra/sai do sistema. |
| **[lucasIA_RAG.md](./lucasIA_RAG.md)** | Foco na Fase 4.5: pipeline RAG, regra v2 (65/35 + gates), componentes Python, persistência, gatilhos, plano de rollout. **+ §16-20:** épico LLM-agnóstico (5 fases concluídas) — Python factory, .NET factory, escolha por tenant, on/off por tenant, observabilidade. |
| **[lucasRUNBOOK_IA.md](./lucasRUNBOOK_IA.md)** | **Manual operacional**: troubleshooting da IA em prod, rotação de chave sem downtime, mudar provider, pegadinhas conhecidas, comandos cola-rápida. Abrir aqui PRIMEIRO quando algo quebrar. |
| **[lucasbacklog.md](./lucasbacklog.md)** | O que **eu** vou fazer (LUC-001..LUC-100+). Mantido vivo. |
| **[lucaschangelog.md](./lucaschangelog.md)** | O que **eu** já fiz. Mantido vivo (entrada por dia/sprint). |

---

## Relação com a documentação original do time

Os meus arquivos `lucas*` são **derivados e complementares** ao material que já existe na raiz do repo. Eu não estou substituindo nada — estou criando minha versão "consolidada" para conseguir trabalhar sem ter que reler tudo a cada vez.

Originais que continuo lendo quando preciso de profundidade:

| Doc original | Quando uso |
|---|---|
| `README.md` | Setup do ambiente local |
| `CLAUDE.md` | Regras críticas para AI assistants (sobretudo migrations EF) |
| `VISAO_GERAL_PROJETO.md` | Visão arquitetural detalhada |
| `GUIA_IA_RAG.md` | Setup da stack IA (Ollama, pgvector) |
| `FLUXO_IA_MATCHING.md` | Quando dispara o matching e onde grava |
| `STATUS_MATCHING_VETORIZADO.md` | Checklist de implementação atual |
| `PLANO_EVOLUCAO_MATCHING_65_35.md` | Plano em 6 fases para v2 |
| `COMO_USAR_MATCHING_IA.md` | Manual do recrutador |
| `INTEGRACAO-MOVIMENTACOES-DATASUL.md` | Integração movimentações TOTVS Datasul |
| `RECRUTAMENTO_FLUXO.md` | Recrutamento ponta-a-ponta |
| `PORTAL_MVC_INVENTARIO_E_MIGRACAO.md` | Histórico do MVC removido (Fase 13) |
| `backlog.md` (gigante, do time) | Contexto histórico e itens compartilhados |
| `changelog.md` (do time) | Histórico de mudanças do time |
| `diario-de-bordo.md` | Notas operacionais do time |
| `tasks.md` | Tasks correntes do time |

---

## Workflow sugerido (meu)

1. Sempre que eu **começar uma sessão**, dou uma olhada no `lucasbacklog.md` e nos itens com prioridade alta para decidir o que tocar.
2. Quando começar um item, mudo o status para `🔄 em progresso` no `lucasbacklog.md`.
3. Ao terminar, registro no `lucaschangelog.md` (com commit/PR) e removo do backlog.
4. Se durante o trabalho descubro coisa nova relevante (estrutura, decisão, gotcha), atualizo o `lucas*` apropriado.
5. Se a stack mudar (novo provider, nova lib), atualizo `lucasSTACK_TECNOLOGICA.md`.
6. Se uma tela for criada/removida, atualizo `lucasMODULOS_FUNCIONALIDADES.md`.

---

**Esses arquivos são meus — não substituem nada do time, mas me dão velocidade.**
