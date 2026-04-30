# Requirements — Milestone v1.0 · Abertura de vaga (aumento de quadro) + RM

**Defined:** 2026-04-30  
**Core Value:** Ver [PROJECT.md](./PROJECT.md) — entrada única e auditável alinhada ao RM.

## v1 Requirements

### Acesso e segurança (ACC)

- [ ] **ACC-01**: Apenas usuários com perfil autorizado (gestor/coordenador/gerente ou equivalente parametrizável) podem iniciar solicitação de **aumento de quadro**, limitada ao escopo organizacional da própria área (RN01).

### Formulário e consistência (CMP)

- [ ] **CMP-01**: Toda nova solicitação neste fluxo declara tipo/motivo **Aumento de quadro** (RN02).
- [ ] **CMP-02**: Quando aumento de quadro, sistema exige **justificativa detalhada** antes de permitir envio (RN03).
- [ ] **CMP-03**: Envio só ocorre com **todos os campos obrigatórios** preenchidos (seções equivalentes à história §7.1–7.5); servidor rejeita com erros discriminados (RN04, CA02).
- [ ] **CMP-04**: Gestor pode gravar solicitação em **rascunho** sem iniciar triagem (status §8).

### Fluxo no portal até RM (FLX)

- [ ] **FLX-01**: Solicitação enviada válida torna‑se **Pendente de Triagem** (ou primeiro status operacional antes de RM, conforme §8 — CA04).
- [ ] **FLX-02**: Responsável pela triagem move para **Em Triagem** ou equivalente durante análise.
- [ ] **FLX-03**: Triagem pode **devolver ao gestor** com pendências (**Devolvida para Ajustes** — CA06, item 9 do fluxo macro).
- [ ] **FLX-04**: Gestor reenvia após correção; ciclo volta à triagem até aprovação.
- [ ] **FLX-05**: Após fluxo definido pela empresa (**triagem + aprovação interna**), solicitação aprovada só então pode gerar vínculo com RM (**sem** criar requisição antes dessa decisão interna — RN05).
- [ ] **FLX-06**: Estado **Reprovado** encerra com motivação auditável (**Reprovada** — RN14).

### Integração RM — criação (IRM)

- [ ] **IRM-01**: Quando solicitado pela transição **Aprovada** no Portal, sistema **cria requisição** no RM com conjunto documentado em §12.1 / integração técnica a definir na fase CA07.
- [ ] **IRM-02**: Portal guarda vínculos retornados: **ID interno da solicitação**, **código requisição**, atendimento (se vier), status inicial RM, timestamps, mensagens sucesso/erro (**§12.2 — CA08**).
- [ ] **IRM-03**: Em falha, solicitação entra em estado **Erro de integração RM** ou **Pendente de Reprocessamento** com log e possibilidade de **nova tentativa** (RN09, CA09).
- [ ] **IRM-04**: Histórico de **todas tentativas** de integração (payload resumido, código HTTP/erro, horário).

### Integração RM — sincronismo (SYN)

- [ ] **SYN-01**: Mapeamento **CODSTATUS RM ↔ statuses portal** parametrizável por ambiente/tenant (**§9 observação**) — valores default podem iniciar pela tabela sugerida.
- [ ] **SYN-02**: Atualização de status no RM reflete‑se nos **painéis e detalhes** da solicitação no Portal (polling, job ou mecanismo combinado — CA10).
- [ ] **SYN-03**: Registrar **última sincronização**, status cru RM e última mensagem erro de sync quando houver (**§12.3**).

### Auditoria (AUD)

- [ ] **AUD-01**: Toda mudança relevante (**status**, aprovação, reprovação, devolução, integrações, retentativa) aparece na **timeline** com ator data/hora opcional texto (RN10).

### RH — pós‑RM seleção (SEL)

- [ ] **SEL-01**: RH pode avançar para **Em Processo Seletivo** após cenário válido (**CA11**) alinhando com **IRM** quando requisição aprovada RM.
- [ ] **SEL-02**: Busca compatíveis no **banco de talentos** filtrável por perfil/competências da solicitação (**CA12**).
- [ ] **SEL-03**: Registro/visualização **sugestões internas** / indicações vinculadas à solicitação (**CA13**).
- [ ] **SEL-04**: Conclusões finais (**Contratação Concluída**, **Cancelada**, **Suspensa**, **Encerrada sem Contratação** — RN14, CA14) com coerência de status RM quando aplicável.

### UX (UIT)

- [ ] **UIT-01**: Jornada **gestor**: “Abrir nova vaga”, escolha motivo aumento quadro wizards multi‑seções, mesmo conjunto obrigatório validado antes de submit (CA01, CA03).
- [ ] **UIT-02**: Jornadas **triagem**, **aprovação** e **RH** separadas por permissão e filtros equivalentes aos status §8 (+ estados erro RM).

---

## Future (v2+)

Estes pontos ficam conscientemente após MVP do v1 quando houver segunda onda ou integrações extras:

| ID | Capability | Motivo deferimento |
|----|-------------|---------------------|
| FUT‑01 | Assinatura eletrônica multi‑alçada paralela configurável graficamente | Exige modelo de BPM completo não coberto apenas por state machine inicial |
| FUT‑02 | Publicação automatizada lista extensa de portals externos por job orchestration | Canal por canal contractual |
| FUT‑03 | Fluxo outros motivos (substituição, projeto, etc.) além aumento quadro | História atual escopo reduz aumento quadro |

## Out of Scope

Ver [PROJECT.md](./PROJECT.md). Extras: duplicar cálculos de orçamento que pertencem 100 % ao RM; substituir aprovação fiscal no RM pela do Portal quando política empresa exija RM apenas.

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ACC-01 | Phase 1 | Pending |
| CMP-01 | Phase 1 | Pending |
| CMP-02 | Phase 1 | Pending |
| CMP-03 | Phase 2 | Pending |
| CMP-04 | Phase 1 | Pending |
| FLX-01 | Phase 2 | Pending |
| FLX-02 | Phase 2 | Pending |
| FLX-03 | Phase 2 | Pending |
| FLX-04 | Phase 2 | Pending |
| FLX-05 | Phase 2 | Pending |
| FLX-06 | Phase 2 | Pending |
| IRM-01 | Phase 3 | Pending |
| IRM-02 | Phase 3 | Pending |
| IRM-03 | Phase 3 | Pending |
| IRM-04 | Phase 3 | Pending |
| SYN-01 | Phase 4 | Pending |
| SYN-02 | Phase 4 | Pending |
| SYN-03 | Phase 4 | Pending |
| AUD-01 | Phase 1 | Pending |
| SEL-01 | Phase 6 | Pending |
| SEL-02 | Phase 6 | Pending |
| SEL-03 | Phase 6 | Pending |
| SEL-04 | Phase 6 | Pending |
| UIT-01 | Phase 5 | Pending |
| UIT-02 | Phase 6 | Pending |

**Coverage**

- **v1 requirements:** 25  
- **Mapped to phases:** 25  
- **Unmapped:** 0 ✓

---

*Requirements defined: 2026-04-30 · Last updated: 2026-04-30 after roadmap creation.*
