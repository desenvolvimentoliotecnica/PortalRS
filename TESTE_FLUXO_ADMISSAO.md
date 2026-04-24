# Teste Ponta-a-Ponta — Fluxo completo de Admissão

> **Escopo**: roteiro de aceitação manual que exercita o ciclo **solicitação de vaga → aprovação → vaga → candidatura → processo seletivo → aprovação da contratação → pré-admissão → integração TOTVS**.
>
> **Perfis**: três usuários de teste (gestor, diretor, RH) criados por um único endpoint dev.
>
> **Duração estimada**: 20–30 min em ritmo normal, 10 min em modo express.
>
> **Última revisão**: Sessão 29 (2026-04-22) — integra com a white-label nova (login branded por `?tenant=<slug>`).

---

## 0. Pré-requisitos

1. **API** rodando em `Development` (`ASPNETCORE_ENVIRONMENT=Development`) — o `DevSeedController` retorna **404** fora desse ambiente.
2. **Next.js** rodando (`pnpm dev` em `LioTecnica.Web.Next`) ou build estático servido.
3. **Seed principal** aplicado: ao subir a API com `Seed:Enabled=true`, `DbSeeder` cria as roles (`Admin`, `Gestor`, `Recrutador`) e o usuário owner.
4. Tenant de teste existe e está ativo no master DB. O roteiro assume `tenant = liotecnica`. Substitua onde aparecer `<tenant>` se usar outro.
5. Um navegador limpo (ou janela anônima) por perfil — facilita não misturar sessões.

---

## 1. Preparar os 3 usuários de teste

Um único POST cria os três perfis, já com funcionários vinculados, hierarquia (gestor subordinado ao diretor) e roles.

```bash
curl -X POST http://localhost:5000/api/dev/seed/usuarios-teste \
  -H "X-Tenant-Id: liotecnica"
```

**Resposta esperada** (trecho):

```json
{
  "message": "3 usuários de teste criados com sucesso!",
  "tenant": "liotecnica",
  "senha": "YkmF@2022*",
  "usuarios": [
    { "email": "gestor@teste.local",  "papel": "Gestor — solicita vaga" },
    { "email": "diretor@teste.local", "papel": "Diretor — aprova solicitação de vaga" },
    { "email": "rh@teste.local",      "papel": "RH — preenche vaga, candidatos, processo seletivo, admissão" }
  ]
}
```

- Papéis (roles):
  - **gestor@teste.local** → `Gestor`, `Admin`
  - **diretor@teste.local** → `Admin` (subordinado direto: ninguém; é o topo da cadeia no teste)
  - **rh@teste.local** → `Admin`, `Recrutador`
- Senha: `YkmF@2022*` (fixada no controller).
- Hierarquia: `gestor` e `rh` têm `GestorDiretoId = diretor.Id`. Isso basta para o Aprovador 1 da solicitação resolver para o diretor.

> Se a resposta for `Usuários de teste já existem`, siga direto para o próximo passo — é idempotente.

---

## 2. (Opcional) Seed de dados prontos para testes de UI

Se quiser pular a criação manual de vaga/candidatos e ir direto para testar a camada de processo seletivo, use:

```bash
curl -X POST http://localhost:5000/api/dev/seed \
  -H "X-Tenant-Id: liotecnica"
```

Cria Área `TI`, Unidade `SP01`, Cargo `DEV-SR`, uma Vaga com 5 candidatos em fases distintas, 2 talentos e um projeto seletivo com 4 fases. Recomendado só para demo visual — o roteiro abaixo **não depende** disso.

---

## 3. Fluxo principal (manual, pela UI)

### 3.1 Gestor — Solicita vaga

1. Abra `http://localhost:3005/app/login?tenant=liotecnica` (ou o slug real — a query `?tenant=` carrega o branding white-label da tela).
2. Login: `gestor@teste.local` / `YkmF@2022*`.
3. Sidebar → **Solicitações** → botão **Nova solicitação**.
4. Preencha:
   - **Título**: `Dev Backend Senior — Teste E2E`
   - **Área**: qualquer área ativa (usar `Operações` se veio do seed)
   - **Quantidade**: 1
   - **Justificativa**: `Reposição de colaborador que pediu desligamento`
   - **Senioridade**: Senior
5. **Salvar rascunho** e depois **Submeter para aprovação**.

> **Endpoint-equivalente** (caso queira automatizar):
> ```
> POST /api/solicitacoes-vaga                     (cria rascunho)
> POST /api/solicitacoes-vaga/{id}/submit         (submete → Aprovador 1 = diretor)
> ```
> Ver `SolicitacoesVagaController.cs` para o contrato completo.

**Validação visual**:
- Status muda de `Rascunho` → `AguardandoAprovacao1`.
- Aparece em `/gestao/solicitacoes` do gestor com badge "Em aprovação".
- E-mail de notificação (se `email-config` configurado) para o diretor.

---

### 3.2 Diretor — Aprova a solicitação

1. Nova aba anônima → `http://localhost:3005/app/login?tenant=liotecnica`.
2. Login: `diretor@teste.local` / `YkmF@2022*`.
3. Sidebar → **Minhas Pendências** (badge no topo mostra o contador).
4. Abra a solicitação "Dev Backend Senior — Teste E2E".
5. Clique **Aprovar** → confirmar.

> **Endpoint-equivalente**: `POST /api/solicitacoes-vaga/{id}/approve`.

**Validação visual**:
- Contador em **Minhas Pendências** decrementa.
- Status da solicitação → `Aprovada` (ou `AguardandoAprovacaoRh` se o tenant tem `RhDeveAprovarAposGestor=true` em `/admin/tenant-configuracao`).
- Na fila do RH (`/painel-rh`) aparece uma nova vaga em rascunho.

> Se o tenant está configurado para exigir aprovação do RH, repita esse passo logando com `rh@teste.local` em **Minhas Pendências** antes de prosseguir.

---

### 3.3 RH — Preenche e publica a vaga

1. Nova aba anônima → login com `rh@teste.local` / `YkmF@2022*`.
2. Sidebar → **Painel RH**.
3. Vaga gerada aparece em rascunho. Clique para editar.
4. Preencha os campos críticos para matching:
   - **Cidade/UF** (ex.: São Paulo/SP)
   - **Faixa salarial** (ex.: R$ 8.000–15.000)
   - **Descrição interna** (texto livre)
   - **Resumo pitch** (texto livre para portal)
   - **Keywords** (ex.: `dotnet;api;sqlserver;backend`)
   - **Responsabilidades** (ex.: `code-review;arquitetura;mentoria`)
   - **Pesos** (competência 40 / experiência 30 / formação 15 / localidade 15)
5. Clique **Salvar** → **Publicar** (status `Aberta`).

**Validação visual**:
- A vaga aparece em `/vagas` com status `Aberta`.
- Fica visível no Portal de Vagas público (se o módulo estiver habilitado).

---

### 3.4 RH — Cadastra candidato e roda matching

1. Ainda logado como RH, Sidebar → **Candidatos** → **Novo candidato**.
2. Preencha:
   - **Nome**: `Candidato Teste E2E`
   - **Email**: `candidato.e2e@testmail.com`
   - **Fone**: `(11) 99999-1234`
   - **Cidade/UF**: São Paulo/SP
   - **Vaga**: selecione a vaga criada no passo 3.3
   - **CV Text** (copiar/colar):
     ```
     Experiência:
     - 2021-atual: Dev Backend Senior em empresa XPTO (C#, .NET 8, SQL Server, Azure, REST)
     - 2018-2021: Dev Pleno em consultoria (ASP.NET Core, Postgres)
     Formação: Ciência da Computação
     ```
3. Salvar.
4. Na lista de candidatos, clique no candidato recém-criado → aba **Matching** → botão **Calcular match IA**.
5. Aguarde: o score deve sair ≥ 70 (bate com `MatchMinimoPercentual` padrão). Campo `LastMatchPass=true`.

**Validação**: candidato com `LastMatchScore` preenchido e botão **Aprovar para processo seletivo** habilitado.

---

### 3.5 RH — Conduz processo seletivo

1. Sidebar → **Processo Seletivo** → selecione a vaga.
2. Se ainda não houver projeto para essa vaga, clique **Novo projeto** → nome "Rodada 1 — E2E".
3. Crie fases (se vazio):
   - `Triagem RH` (ordem 0)
   - `Entrevista Técnica` (ordem 1)
   - `Proposta Final` (ordem 2)
4. Arraste/mova o candidato (ou clique **Avançar fase**) até ele chegar em **Proposta Final**.
5. Na fase **Proposta Final**, clique **Aprovar contratação**.

**Validação visual**:
- `ProjetoCandidato.Status` → `Aprovado`.
- Aparece alerta para o gestor solicitante aprovar a contratação.

---

### 3.6 Gestor — Aprova a contratação final

1. Volte para a aba do **gestor@teste.local** (ou faça login de novo).
2. Sidebar → **Minhas Pendências** → "Aprovação de contratação".
3. Abra → revise → **Aprovar**.

> **Endpoint-equivalente**: decisões de contratação são persistidas via `POST /api/pre-admissao/aprovar-contratacao` (chamado internamente pelo fluxo; ver `PreAdmissaoController.cs`).

**Validação visual**:
- Status do candidato no projeto vira `AprovadoPeloGestor`.
- **RH** recebe notificação de que pode iniciar pré-admissão.

---

### 3.7 RH — Pré-admissão

1. Como RH, Sidebar → **Admissão** → aba **Em andamento**.
2. O candidato aprovado deve aparecer na fila. Se não aparecer, clique **Iniciar manualmente** e selecione-o.
3. Preencha o cadastro de pré-admissão — **atenção aos blocos obrigatórios**:
   - **Dados pessoais**: CPF, RG, data de nascimento, sexo, estado civil, nacionalidade, nomes dos pais, local de nascimento
   - **Endereço**: CEP + campos que o CEP retorna + número
   - **Contato**: celular obrigatório, emergência obrigatório
   - **Bancário**: banco, agência, conta, tipo de conta
   - **Contrato**: CLT/PJ/Estágio, data de admissão, salário, carga horária, PIS, CTPS
4. Use o botão **Validar** em cada bloco — campos `Validacao*Ok` devem ficar verdes:
   - ValidacaoCpfOk, ValidacaoCepOk, ValidacaoBancoOk, ValidacaoSalarioOk
5. Clique **Submeter** → Status `AguardandoAprovacao`.
6. Clique **Aprovar** (o próprio RH tem permissão neste roteiro — em produção poderia ser outro usuário com role `Admin`) → Status `Aprovada`.

> **Endpoint-equivalente** do ciclo: `POST /api/pre-admissao` → `PUT /api/pre-admissao/{id}` → `POST /api/pre-admissao/{id}/submit` → `POST /api/pre-admissao/{id}/approve`.

**Validação visual**:
- Pré-admissão aparece em **Admissão → Fila TOTVS** (pendentes de integração).
- `PreAdmissao.Status = Aprovada`, `ApprovedAtUtc` preenchido.

---

### 3.8 Integração TOTVS

1. Ainda como RH, Sidebar → **Admissão** → aba **Integração TOTVS** (ou `/admin/logs` se a tela específica não estiver no menu do ambiente).
2. Confirme que a pré-admissão aprovada aparece em **Pendentes de integração**.

> **Endpoint-equivalente** (consulta pela fila): `GET /api/pre-admissao/integracao/pendentes`

3. Em ambiente com `IntegracaoTotvsService` real apontado para o TOTVS: dispare a integração. Em DEV, simule a resposta:

```bash
curl -X POST http://localhost:5000/api/pre-admissao/{ID}/integracao/resultado \
  -H "X-Tenant-Id: liotecnica" \
  -H "Authorization: Bearer <JWT do RH>" \
  -H "Content-Type: application/json" \
  -d '{
    "sucesso": true,
    "matriculaTotvs": "E2E-001",
    "observacoes": "Integrado pelo roteiro TESTE_FLUXO_ADMISSAO.md"
  }'
```

**Validação visual**:
- Status da pré-admissão vira `IntegradaTotvs`.
- Em `/admin/operational-logs` registra a operação (se esse logger estiver ativo).

---

## 4. Check-list de aceitação

Marque conforme executa:

- [ ] `POST /api/dev/seed/usuarios-teste` retorna 3 usuários criados
- [ ] Gestor consegue logar e criar solicitação de vaga
- [ ] Solicitação vai para `AguardandoAprovacao1` após `Submit`
- [ ] Diretor vê pendência em **Minhas Pendências** e aprova
- [ ] RH vê vaga em rascunho em `/painel-rh`
- [ ] RH preenche, publica; status → `Aberta`
- [ ] Candidato cadastrado; matching gera score ≥ 70
- [ ] RH move candidato no Kanban até **Proposta Final**
- [ ] RH clica **Aprovar contratação** → notifica gestor
- [ ] Gestor aprova contratação
- [ ] RH cria pré-admissão, preenche todos os blocos, aprova
- [ ] Pré-admissão aparece em `GET /api/pre-admissao/integracao/pendentes`
- [ ] Simulação de retorno TOTVS marca como `IntegradaTotvs`

---

## 5. Modo express (API only, via script)

Se o objetivo for só regressão rápida (sem UI), chame os endpoints em sequência com `jq` encadeando IDs:

```bash
#!/usr/bin/env bash
set -euo pipefail
API="http://localhost:5000"
TENANT="liotecnica"
HDR=(-H "X-Tenant-Id: $TENANT")

# 1. Seed users
curl -s -X POST "$API/api/dev/seed/usuarios-teste" "${HDR[@]}" >/dev/null

# 2. Login gestor
GESTOR_JWT=$(curl -s -X POST "$API/api/auth/auto-login" "${HDR[@]}" \
  -H "Content-Type: application/json" \
  -d '{"email":"gestor@teste.local","password":"YkmF@2022*"}' | jq -r .accessToken)

# 3. Login diretor
DIRETOR_JWT=$(curl -s -X POST "$API/api/auth/auto-login" "${HDR[@]}" \
  -H "Content-Type: application/json" \
  -d '{"email":"diretor@teste.local","password":"YkmF@2022*"}' | jq -r .accessToken)

# 4. Login RH
RH_JWT=$(curl -s -X POST "$API/api/auth/auto-login" "${HDR[@]}" \
  -H "Content-Type: application/json" \
  -d '{"email":"rh@teste.local","password":"YkmF@2022*"}' | jq -r .accessToken)

echo "Tokens obtidos. Continue a partir daqui com os JWTs:"
echo "  GESTOR=$GESTOR_JWT"
echo "  DIRETOR=$DIRETOR_JWT"
echo "  RH=$RH_JWT"
```

A partir daí, invoque em sequência os mesmos endpoints chamados pela UI (`POST /api/solicitacoes-vaga`, `POST /api/solicitacoes-vaga/{id}/submit`, `POST /api/solicitacoes-vaga/{id}/approve`, `PUT /api/vagas/{id}`, `POST /api/vagas/{id}/publicar`, `POST /api/candidatos`, `POST /api/pre-admissao/iniciar-manual`, …). Os contratos estão documentados no Swagger em `http://localhost:5000/swagger`.

---

## 6. Limpeza

Quando terminar:

```bash
# Remove vagas/candidatos/talentos do seed visual
curl -X DELETE http://localhost:5000/api/dev/seed -H "X-Tenant-Id: liotecnica"

# Remove mocks TOTVS (se usou)
curl -X DELETE http://localhost:5000/api/dev/seed/pre-admissoes -H "X-Tenant-Id: liotecnica"
```

> Os **usuários de teste** (`gestor@teste.local`, `diretor@teste.local`, `rh@teste.local`) **não** são removidos por `DELETE /api/dev/seed`. Deixá-los é intencional — o script de criação é idempotente e reutilizável em qualquer ciclo de regressão. Se quiser apagar manualmente, use a tela de admin `/admin/users` e exclua-os logado como owner.

---

## 7. Troubleshooting

| Sintoma                                                         | Causa provável                                                      | Ação                                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `/api/dev/seed/*` retorna 404                                    | API não está em Development                                         | Setar `ASPNETCORE_ENVIRONMENT=Development` e reiniciar                |
| `Roles ... não encontradas` na resposta                          | Seed principal não rodou                                            | Subir API com `Seed:Enabled=true` (ou chamar endpoint de seed equiv.) |
| Minhas Pendências do diretor vazio                               | Hierarquia não resolveu — `GestorDiretoId` pode não ter sido setado | Recheque `Funcionario` do gestor: deve ter `GestorDiretoId = diretor.Id` |
| RH não vê vaga em `/painel-rh`                                   | `TenantConfiguracao.RhDeveAprovarAposGestor=true` — falta etapa extra | Logar como RH em **Minhas Pendências** e aprovar antes               |
| Matching retorna score baixo                                    | CV text pobre em keywords da vaga                                   | Incluir pelo menos 3 keywords da vaga no texto do CV                 |
| Pré-admissão não pode ser submetida                              | Campo obrigatório em branco ou validação bloqueando                 | Checar blocos com `Validacao*Ok=false` — bancário/CPF/CEP/salário    |
| Integração TOTVS não aparece pendente                           | Status não é `Aprovada` OU campo de aprovação não foi preenchido     | `GET /api/pre-admissao/{id}` para inspecionar status                 |

---

## 8. Referência cruzada

- **Código** que cria os usuários: `RHPortal.Api/Controllers/DevSeedController.cs#SeedUsuariosTeste`
- **Endpoint de solicitações**: `RHPortal.Api/Controllers/SolicitacoesVagaController.cs`
- **Endpoint de vagas**: `RHPortal.Api/Controllers/VagasController.cs`
- **Endpoint de pré-admissão**: `RHPortal.Api/Controllers/PreAdmissaoController.cs`
- **White-label da tela de login** (Sessão 29): `LioTecnica.Web.Next/src/features/auth/LoginScreen.tsx`
- **Admin de branding**: `/admin/tenant-branding` (sidebar em Configurações)
