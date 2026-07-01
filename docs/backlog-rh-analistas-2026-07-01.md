# Backlog RH — Feedback Analistas (01/07/2026)

Origem: apresentação do sistema para analistas de RH.  
Status: `[ ]` pendente · `[~]` em refinamento · `[x]` pronto para dev · `[!]` bloqueado

---

## Item 1 — Documentação básica no cadastro de candidato (portal de vagas)

**Status:** `[x]` **Implementado (P2 — 01/07/2026, DEV)**

### Problema
Candidatos se cadastram no portal de vagas sem documentação básica. RH precisa desses dados cedo no funil.

### Decisões (entrevista 01/07/2026)

| Tópico | Decisão |
|--------|---------|
| **Momento da coleta** | No **cadastro inicial** (criar conta) — campos integrados ao fluxo de registro |
| **Campos obrigatórios** | RG, CPF, Data de nascimento, Nome da mãe |
| **Campos opcionais** | Nome do pai |
| **Validação CPF** | Dígito verificador + bloqueio de duplicidade no tenant |
| **Validação RG** | Texto livre, máscara opcional (sem validação algorítmica) |
| **Candidatos já cadastrados** | Exigir completar no **próximo login** (banner/modal persistente) |
| **Fallback na candidatura** | Se perfil incompleto ao candidatar-se: **bloquear** e abrir formulário para completar, **mantendo a vaga selecionada** |

### Escopo técnico (indicativo)
- Backend: estender `PortalCandidateRegisterRequest` + entidade candidato com novos campos; validação CPF
- Frontend: formulário de registro em `PortalVagasScreen` / `PortalVagasAccessScreen`
- Migration EF se novos campos na entidade `Candidato`
- Modal/banner para candidatos legados no login

### Critérios de aceite
- [x] Novo cadastro não conclui sem RG, CPF, nascimento e nome da mãe
- [x] Nome do pai é opcional e pode ficar em branco
- [x] CPF inválido ou duplicado no tenant é rejeitado com mensagem clara
- [x] Candidato antigo vê solicitação de completar dados no login
- [x] Tentativa de candidatura com perfil incompleto abre complemento sem perder vaga

### Como testar
1. **Novo cadastro:** em `/app/PortalVagas/Acesso?tenantId=...`, criar conta sem CPF → bloqueio; com CPF inválido → mensagem; preencher todos os campos obrigatórios → sucesso.
2. **Legado:** candidato sem doc no banco → login → banner + modal pedindo complemento.
3. **Candidatura bloqueada:** logado com perfil incompleto → clicar candidatar → modal de doc mantendo vaga selecionada → após salvar, fluxo de candidatura abre.

---

## Item 2 — Não enviar e-mail ao responsável da vaga na candidatura

**Status:** `[x]` **Implementado (P2 — 01/07/2026, DEV)**

### Problema
Gestor e recrutador recebem e-mail a cada nova candidatura, gerando ruído. RH prefere acompanhar pelo portal.

### Decisões (entrevista 01/07/2026)

| Tópico | Decisão |
|--------|---------|
| **Quem não recebe e-mail** | **Gestor requisitante** e **Recrutador responsável** da vaga |
| **Notificação in-app** | **Manter** (sino no portal para RH) |
| **E-mail ao candidato** | **Manter** confirmação de candidatura |
| **Configurabilidade** | Flag por **tenant** em Configurações; **ligada por padrão** (= não envia e-mail ao responsável) |

### Critérios de aceite
- [x] Flag em Configurações do tenant: "Enviar e-mail ao responsável na candidatura" (default: desligada)
- [x] Com flag desligada (padrão): nenhum e-mail para gestor nem recrutador ao candidatar-se
- [x] Notificação in-app continua funcionando
- [x] Candidato continua recebendo e-mail de confirmação
- [x] Com flag ligada: comportamento anterior restaurado (para tenants que quiserem)

### Como testar
1. Admin → **Configurações do tenant** → Recrutamento → confirmar checkbox **desligado** por padrão.
2. Candidatar-se a uma vaga → gestor/recrutador **não** recebem e-mail; candidato recebe confirmação.
3. Ligar a flag, salvar, candidatar novamente → e-mails ao responsável voltam.

---

## Item 3 — Adicionar "Conversar com WhatsApp Web"

**Status:** `[x]` **Implementado (P2 — 01/07/2026, DEV)**

### Problema
RH precisa contatar candidatos rapidamente pelo WhatsApp, mas o atalho está ausente ou discreto em várias telas.

### Decisões (entrevista 01/07/2026)

| Tópico | Decisão |
|--------|---------|
| **Onde aparece** | **Todos os locais** que exibem dados do candidato (lista, detalhe, hub da vaga, pipeline, admissão, etc.) |
| **Comportamento** | Link `wa.me/{telefone}` abrindo em **nova aba** (WhatsApp Web se logado) |
| **Número usado** | **Celular**; fallback para **Fone** se celular vazio |
| **Sem telefone** | Botão **visível desabilitado** com tooltip "Sem telefone cadastrado" |
| **Label** | "Conversar com WhatsApp Web" (texto explícito, não só ícone) |

### Critérios de aceite
- [x] Componente reutilizável `WhatsAppContactButton` aplicado em todas as telas com dados de candidato
- [x] Normalização E.164/brasil (55 + DDD + número) antes do link
- [x] Botão desabilitado + tooltip quando não há telefone
- [x] Abre nova aba sem sair do portal

### Como testar
1. Abrir lista de candidatos, matching, hub da vaga, triagem ou tracking de admissão.
2. Candidato com celular → botão **Conversar com WhatsApp Web** abre `wa.me` em nova aba.
3. Candidato sem telefone → botão desabilitado com tooltip.

---

## Item 4 — Flag de benefícios ao criar/enviar proposta

**Status:** `[x]` Refinado — aguardando priorização

### Problema
Campo de benefícios na proposta é texto livre; RH quer marcar benefícios de forma estruturada.

### Decisões (entrevista 01/07/2026)

| Tópico | Decisão |
|--------|---------|
| **UI** | **Checkboxes** por benefício (não só textarea) |
| **Origem da lista** | Benefícios **cadastrados na vaga** (`VagaBeneficios`) — pré-carregados no formulário |
| **Envio** | Só benefícios **marcados** entram no e-mail/carta ao candidato |
| **Obrigatoriedade** | **Opcional** — RH decide incluir ou não; toggle para incluir seção de benefícios |

### Critérios de aceite
- [ ] Ao criar proposta, checkboxes listam benefícios da vaga selecionada
- [ ] Toggle "Incluir benefícios na proposta" (default: ligado se vaga tem benefícios)
- [ ] E-mail/carta pública exibe apenas itens marcados
- [ ] Textarea livre pode permanecer como complemento/observação (confirmar na implementação)

---

## Item 5 — Simplificar preenchimento da Admissão (RH)

**Status:** `[x]` **Implementado (P1 — 01/07/2026, DEV)**

### Problema
Wizard RH em `/app/admissao/nova` tem 8 etapas e dezenas de campos TOTVS — complexo demais para analistas.

### Decisões (entrevista 01/07/2026)

| Tópico | Decisão |
|--------|---------|
| **Etapas alvo** | **3 etapas:** Contratual → Documentos RH → Revisão |
| **Divisão RH vs candidato** | **RH:** cargo, salário, CC, data admissão, etc. \| **Candidato (portal):** pessoal, endereço, documentos |
| **Campos TOTVS** | **Remover do wizard RH** — integração TOTVS fica em fluxo separado/backoffice |
| **Pré-preenchimento** | Auto-preencher com dados do **candidato + vaga + proposta** quando admissão vem do recrutamento |
| **Agrupamento** | Reduzir e agrupar campos restantes |

### Entrega técnica
- `AdmissaoWizardScreen.tsx`: 3 etapas (`AdmissaoContratualStep`, documentos, revisão simplificada)
- `finishWizard`: salva rascunho e redireciona para `/app/admissao/tracking?id=...` (sem submit TOTVS)
- `rhWizardValidation.ts`: validação mínima (data admissão, salário, tipo contratação, contato)

### Critérios de aceite
- [x] Wizard RH com no máximo 3 etapas visíveis
- [x] Sem campos TOTVS/eSocial no formulário RH
- [x] Dados do candidato/vaga/proposta pré-carregados ao abrir `?id=...`
- [x] Validação mínima alinhada ao que RH realmente precisa antes de enviar link ao candidato

### Como testar
1. Abrir `/app/admissao/nova?id={preAdmissaoId}` com admissão iniciada pelo recrutamento.
2. Confirmar **3 abas**: Dados Contratuais → Documentos → Revisão e Envio.
3. Na etapa contratual: nome/CPF read-only; preencher data admissão, salário, tipo contratação e e-mail/celular.
4. Clicar **Próximo** → anexar documentos RH (opcional) → **Revisão** → **Salvar e continuar**.
5. Verificar redirecionamento para **tracking** (não para revisão TOTVS antiga).

---

## Item 6 — Melhorar segurança do formulário de admissão

**Status:** `[x]` **Implementado (P1 — 01/07/2026, DEV)**

### Problema
Portal de admissão do candidato autentica apenas com CPF + IDs na URL — risco de acesso indevido.

### Decisões (entrevista 01/07/2026)

| Tópico | Decisão |
|--------|---------|
| **Melhoria principal** | **OTP por e-mail** além do CPF no login do portal |
| **Fluxo sugerido** | Candidato informa CPF → sistema envia código ao e-mail cadastrado → valida código → libera formulário |

### Entrega técnica
- API: `AdmissaoPortalOtpService` + endpoints `POST login/request-otp` e `POST login/verify-otp`
- OTP 6 dígitos, cache 15 min, cooldown 1 min entre reenvios
- Frontend portal: tela de login em duas etapas (CPF → código)

### Critérios de aceite
- [x] Login do portal exige CPF + código OTP enviado ao e-mail da pré-admissão
- [x] OTP com validade limitada (ex.: 10–15 min) e rate limit de reenvio
- [x] Mensagem clara se e-mail não cadastrado ou código inválido

### Como testar
1. No tracking, gerar/copiar link do portal do candidato.
2. Abrir link em aba anônima; informar CPF correto → **Solicitar código**.
3. Verificar e-mail (fila SMTP do ambiente) com código de 6 dígitos.
4. Informar código válido → formulário liberado.
5. Testar código errado (mensagem de erro) e reenvio antes de 1 min (bloqueio/cooldown).

---

## Item 7 — Portal de admissão: manter pessoais + docs; remover gerais e bancários

**Status:** `[x]` **Implementado (P1 — 01/07/2026, DEV)**

### Problema
Portal do candidato pede muitas seções; RH quer foco em dados pessoais e documentos.

### Decisões (entrevista 01/07/2026)

| Tópico | Decisão |
|--------|---------|
| **Manter** | Dados pessoais + anexo de documentos |
| **Remover** | Dados gerais + informações bancárias (e demais seções fora do escopo) |

### Entrega técnica
- `wizardSteps.ts`: 4 etapas principais (pessoais, documentos, revisão, conclusão) + migração de steps legados
- `DocumentoAdmissaoScreen.tsx`: removidos `DadosGeraisStep` e `DadosBancariosStep`
- `ReviewStep.tsx`: cards apenas Dados Pessoais + Documentos

### Critérios de aceite
- [x] Wizard portal candidato exibe apenas etapas de dados pessoais e upload de documentos
- [x] Dados gerais (dependentes, etc.) e bancários não aparecem para o candidato
- [x] RH continua podendo ver/completar dados removidos no backoffice se necessário

### Como testar
1. Após login OTP, percorrer sidebar/stepper do portal.
2. Confirmar etapas: **Boas-vindas → Dados Pessoais → Documentos → Revisão → Conclusão**.
3. Verificar ausência de menus "Dados gerais", "Bancário" ou dependentes.
4. Na revisão, apenas resumo de pessoais + documentos.

---

## Item 8 — Remover "Upload Manual (RH)" no tracking de admissão

**Status:** `[x]` **Implementado (P1 — 01/07/2026, DEV)**

### Problema
RH faz upload manual de documentos no tracking, contornando o fluxo do candidato.

### Decisões (entrevista 01/07/2026)

| Tópico | Decisão |
|--------|---------|
| **Ação** | **Remover completamente** a seção "Upload Manual (RH)" em `/app/admissao/tracking` |
| **Alternativa** | Usar fluxo "Solicitar reenvio ao candidato" quando documento estiver incorreto |

### Entrega técnica
- `PreAdmissaoTrackingScreen.tsx`: removida seção/card "Upload Manual (RH)" e handlers associados

### Critérios de aceite
- [x] Card/seção "Upload Manual (RH)" removido da UI de tracking
- [x] Documentos entram apenas via portal do candidato ou fluxos existentes de reenvio

### Como testar
1. Abrir `/app/admissao/tracking?id={preAdmissaoId}`.
2. Confirmar que **não** existe card "Upload Manual (RH)".
3. Validar que envio de link ao candidato e "Solicitar reenvio" continuam disponíveis.

---

## Item 9 — Retorno negativo aos demais candidatos quando vaga fechada

**Status:** `[x]` Refinado — aguardando priorização

### Problema
Vaga fechada com 1 contratado deixa demais candidatos sem retorno.

### Decisões (entrevista 01/07/2026)

| Tópico | Decisão |
|--------|---------|
| **Gatilho** | Ao **fechar a vaga** (status Fechada) |
| **Canal** | **E-mail** com template configurável |
| **Confirmação** | **Modal** listando candidatos que receberão antes de enviar |
| **Escopo** | Candidatos ativos na vaga **exceto** o contratado/selecionado |

### Critérios de aceite
- [ ] Ao fechar vaga com múltiplos candidatos, sistema oferece envio de retorno negativo
- [ ] Modal mostra lista de destinatários antes de confirmar
- [ ] E-mail usa template editável (nome candidato, vaga, empresa)
- [ ] Log de envio por candidatura

---

## Item 10 — Coluna STATUS em `/app/gestao/solicitacoes`

**Status:** `[x]` **Implementado (P2 — 01/07/2026, DEV)**

### Problema
Grid de solicitações não exibe status de forma visível.

### Decisões (entrevista 01/07/2026)

| Tópico | Decisão |
|--------|---------|
| **UI** | Coluna **STATUS** com **badge colorido** |
| **Valores** | Aberto, Fechado, Stand-by, Cancelada, Reprovada |
| **Origem** | Mapear do **status existente** em `SolicitacaoVaga` (validar enum na implementação) |

### Critérios de aceite
- [x] Coluna STATUS visível na grid de solicitações
- [x] Badge com cor distinta por status
- [x] Labels exatamente: Aberto, Fechado, Stand-by, Cancelada, Reprovada

### Como testar
1. Abrir `/app/gestao/solicitacoes`.
2. Confirmar coluna **Status** com badges coloridos (Aberto, Fechado, Stand-by, Cancelada, Reprovada).

---

## Priorização sugerida (rascunho)

| Prioridade | Item | Esforço estimado | Impacto RH |
|------------|------|------------------|------------|
| P1 | 7 + 5 + 8 | Alto | Admissão — **entregue 01/07/2026** |
| P1 | 6 | Médio | Segurança/LGPD — **entregue 01/07/2026** |
| P2 | 1 | Médio | Qualidade do funil — **entregue 01/07/2026** |
| P2 | 2 | Baixo | Reduz ruído de e-mail — **entregue 01/07/2026** |
| P2 | 10 | Baixo | Visibilidade gestão — **entregue 01/07/2026** |
| P2 | 3 | Médio | Produtividade RH — **entregue 01/07/2026** |
| P3 | 4 | Médio | Propostas — **entregue 01/07/2026** |
| P3 | 9 | Médio | Experiência candidato — **entregue 01/07/2026** |
| P4 | Preview wizard DNALIO | Médio | UX publicar vaga — **promovido 01/07/2026** |

---

## Roteiro E2E — P1 Admissão (smoke test)

Fluxo completo sugerido para homologação:

1. **RH — iniciar admissão** a partir do pipeline ou lista; abrir wizard `/app/admissao/nova?id=...`.
2. **RH — 3 etapas**: contratual → documentos (opcional) → revisão → **Salvar e continuar**.
3. **RH — tracking**: copiar link do candidato; confirmar ausência de upload manual.
4. **Candidato — portal**: CPF → OTP por e-mail → preencher pessoais + documentos → revisão → enviar.
5. **RH — tracking/revisão**: conferir documentos recebidos e status atualizado.

**Pré-requisitos:** pré-admissão com e-mail válido; SMTP/fila de e-mail configurados no tenant para OTP.

**Planner:** `TASK-2026-168`

---

_Documento gerado em 01/07/2026 — entrevista interativa com analistas de RH._
