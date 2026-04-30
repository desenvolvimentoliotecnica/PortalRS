<!-- source: ROADMAP Fase 3 + REQUIREMENTS IRM-* + codebase IntegracaoTotvs + Rm read -->
<!-- gsd-phase:phase=03-integracao-rm-criacao -->

Phase: **Integração RM — criação de requisição (IRM-01…IRM-04)**  
Focus: API — disparo configurável após estado aprovador final, persistência vínculos, falhas/recuperação, histórico de tentativas.  
Out of scope: **SYN-\*** polling (Fase 4); UI formulários (**UIT-\***).

# Phase Plan: Integração RM criação

## Requirements traceability

```
| REQ ID  | Acceptance (resumo) | Plan tasks |
|---------|---------------------|------------|
| IRM-01  | Portal dispara criação requisição RM com dados §12.1 doc | T03.T1–T03.T5 |
| IRM-02  | Persistir código/atendimento/status inicial/timestamps/msg | T03.T5, T03.T10 |
| IRM-03  | Falha → ErroIntegracaoRm ou AguardandoReprocessamento; retry seguro | T03.T6–T03.T9 |
| IRM-04  | Histórico **todas** tentativas (payload resumo, erro, timestamp) | T03.T7, T03.T14 |
```

## Prerequisites

- Fase 2 concluída para **AumentoQuadro** (triagem antes de RM).  
- `Rm` configurável já usado por leitura; credenciais **escrita** definidas pela equipe infra (usuário só leitura **não** basta para IRM-01 se via SQL).

---

## Executable tasks for executor (`03.T*`)

### 03.T0 — Spike transporte (checkpoint obrigatório antes de código massivo)

**Objective:** Confirmar uma das rotas aceitáveis com stakeholders/infra:

1. Chamada Progress/Datasul alinhada a `TipoIntegracao.SolicitacaoVaga = 9` (reutilizar padrão payloads existentes onde possível — ver `TotvsPayloadHelper`).  
2. **Ou** INSERT/EXEC em SQL Server via `RmConnectionOptions` ou connection string paralela `RmWrite`.

**Deliverable:** 1 página em código comment ou `Infrastructure/Rm/README.md` **apenas se** projeto já usar README RM — senão registrar decisão nos XML docs do novo serviço (evitar novo .md não solicitado).

---

### 03.T1 — Interface `IRMRequisicaoCreateClient` (nome final à escolha do executor)

Contrato estável na camada Application ou Infrastructure conforme patterns existentes:

```csharp
// exemplificativo — o executor deve alinhar a interfaces reais do repo
Task<RmCreateRequisicaoResult> EnviarOuObterJaCriadoAsync(SolicitacaoVaga solicitacao, string idempotencyKey, CancellationToken ct);
```

`RmCreateRequisicaoResult`: `Sucesso`, `JaExiste` (codigo rm), `Falha` (mensagem, código erro técnico).  
Implementações registradas DI: **`RmRequisicaoCreateNoOpClient`** (dev), **`RmRequisicaoSqlClient`** ou **`TotvsRmRequisicaoClient`**.

---

### 03.T2 — Resolver idempotência e short-circuit

Antes da chamada externa:

1. Se `RmRequisicaoCodigo` já preenchido **e** `IntegracaoResultado == Sucesso` (ou política combinada produto) → não reenviar.  
2. Se tentativa anterior em voos “in-flight” — opcional usar rowversion / lock otimista (evitar double `Efetivar` paralelo).

---

### 03.T3 — Mapeamento `SolicitacaoVaga` → payload RM §12.1

Método isolado **`BuildRmRequisicaoPayload`** (pure + testável) usando campos já persistidos (`JobPositionId`, `CentroCusto`, `RequisitosDetalhadosJson`, `Titulo`, `QtdPosicoes`, dados gestor quando necessário).  

**Aceite:** valores nulos com semântica clara causam **`InvalidOperationException`** estável antes de bater RM (lista campos obrigatórios para “go-live” aumento quadro).

---

### 03.T4 — **`EfetivarAsync`** (e/ou comando dedicado) orquestra criação

Arquivo principal: `SolicitacaoVagaService.cs`.

Fluxo recomendado:

1. Estado permitido: hoje só `Aprovada` — avaliar inclusão **`PendenteIntegracaoRm`** quando produto definir estado explícito pós-aprovadores.  
2. Incrementar `TentativasIntegracao`; `UltimaTentativaUtc = UtcNow`.  
3. Chamar cliente T03.T1.  
4. Sucesso → preencher `RmRequisicaoCodigo`, `RmCodStatus` se retornado; `IntegracaoResultado`, `IntegradaEmUtc`; transição **`EmIntegracao`** ou **`PendenteIntegracaoRm`** (decisão D-RM-03 — documentar uma linha no summary).  
5. Falha → `ErroIntegracaoRm` ou `AguardandoReprocessamentoRm` (`IntegracaoMensagem`); **não** perder código HTTP/stack em log interno apenas.

Registrar `StatusHistoricoService` nas transições.

---

### 03.T5 — Harmonizar com **`IIntegracaoTotvsService.RegistrarResultadoAsync`** tipo 9

Garantir que webhook / batch que já processa outros tipos consome **Rm** codes devolvidos e atualiza `SolicitacaoVaga` de forma única — evitar dois caminhos contraditórios estado vs `RmCodStatus`.

**Verificar:** `IntegracaoTotvsService` caso `TipoIntegracao.SolicitacaoVaga` em `RegistrarResultadoAsync`, `RetryAsync`, etc.

---

### 03.T6 — **`RetryAsync`** tipo 9

Fluxo deve reutilizar mesmo pipeline que `Efetivar` (extração método `ExecutarIntegracaoRmAsync`).  
Limite opcional máximo tentativas → `IntegracaoResultado.FalhaDefinitiva` (se já existir no enum — alinhar com desligamentos).

---

### 03.T7 — Persistência histórico **IRM-04**

Se não existir entidade equivalente nos outros fluxos Totvs para **lista** de tentativas:

1. Nova entidade `SolicitacaoVagaIntegracaoTentativa` (tenant FK, SolicitacaoVaga FK, TimestampUtc, Success bool, PayloadResumo texto/jsonb até N KB, MensagemErro, HttpStatus opcional).  
2. Migration idempotente `IF NOT EXISTS` conforme `CLAUDE.md`.  
3. Inserção **antes** ou **depois** da chamada conforme política auditoria — ideal: linha pendente → update sucesso/falha.

---

### 03.T8 — Endpoint reprocessamento **IRM-04 UX API**

Ou reutilizar `POST /integracao-totvs/…/retry` já existente mapeando tipo 9 — **preferir reuso**.

Se faltar autorização granular: policy Admin/RH apenas.

---

### 03.T9 — Estados e DTO/resposta exposição cliente

Expandir `SolicitacaoVagaResponse`/contratos se novos campos visíveis (lista última tentativa resumida **ou** count apenas — MVP pode ser só servidor + painel integração já existente).

---

### 03.T10 — Config

`appsettings` / opções nomeadas por tenant se necessário: timeout RM, modo dry-run (dev), nome procedure/SQL hash.

---

### 03.T11 — Testes automatizados

1. **`ExecutarIntegracaoRmAsync`** com mock cliente: sucesso grava código; segunda chamada idempotente.  
2. Falha simulada → status `ErroIntegracaoRm`; incremento tentativa + linha histórico.  
3. `RetryAsync` tipo 9 (integração onde já testados outros tipos — seguir padrão projeto).  

Usar Filtragem `IntegracaoTotvs` + novo teste projeto `SolicitacoesVaga` se aplicável.

---

### 03.T12 — Segurança

Não logar PII inteiro nos `PayloadResumo`; mascara CPF/email se aparecer cópia do JSON solicitante.

---

### 03.T13 — Smoke manual

Staging com RM read-only já existente OK; staging **write** opcional segundo infra.

---

### 03.T14 — **`dotnet build`** sln Release + testes tocados  

Zero novos warnings bloqueadores introduzidos por esta fase.

---

## Threat model

| Threat | Mitigation |
|--------|------------|
| Double submit cria dois códigos RM | Idempotency key + check pré-call |
| SQL injection nos parâmetros RM | parametrizado sempre |
| Credenciais em log | sanitizar mensagens |
| Estado inconsistente (Approvada mas RM ok) | transação ef + ordem atualização |

## Verification loop (Nyquist)

```
CHECKPOINT
├── [ ] IRM-01 caminho código executado após estado permitido
├── [ ] IRM-02 código RM persistido (colunas existentes)
├── [ ] IRM-03 falha sintética muda estado + permite retry seguro
├── [ ] IRM-04 ≥2 tentativas visíveis histórico
├── [ ] IntegracaoTotvs tipo 9 coerente
├── [ ] Fase 2 não regressada (triagem intacta)
└── [ ] Migration idempotente se nova tabela
```

## Success criteria

- Documentado transporte aceite + código executável atrás da feature flag/config.  
- REQUIREMENTS **IRM-\*** marcáveis verificação no próximo `gsd-verify-work` quando UI existir parte.

## Meta

| Field | Value |
|-------|-------|
| **Research** | Embebido em T03.T0 (--skip-research possível apenas após spike fechado) |
| **Plan verify** | Self-check contra lista acima (subagent opcional não disponível neste IDE) |

---

*Próximo comando sugerido: `$gsd-execute-phase 3`*
