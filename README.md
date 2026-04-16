# RenderRH — Guia de Setup Local

## Pré-requisitos

| Ferramenta | Versão mínima | Verificar |
|---|---|---|
| .NET SDK | 8.0 | `dotnet --version` |
| Node.js | 20 LTS | `node --version` |
| pnpm | 8+ | `pnpm --version` |
| PostgreSQL | 15+ | `psql --version` |
| Python | 3.11+ | `python --version` |
| Git Bash (Windows) | — | necessário para rodar os `.sh` |

---

## Primeira vez na máquina

### 1. PostgreSQL

Certifique-se de que o PostgreSQL está rodando localmente na porta **5432** com:
- Usuário: `postgres`
- Senha: `admin`

Os bancos são criados automaticamente na primeira execução da API.

### 2. Dependências .NET

```bash
cd Voltage.RenderRH
dotnet restore LioTecnica.sln
```

### 3. Dependências Node.js

```bash
cd Voltage.RenderRH/LioTecnica.Web.Next
pnpm install
```

> **Sempre rode `pnpm install` após `git pull`** — pacotes novos são adicionados com frequência e a ausência deles causa erros de build no Next.js.

### 4. Corrigir migration corrompida (obrigatório)

Existe uma migration inválida no repositório (`20260411055438_AddUnidadeLotacaoHierarchyV2`) que impede a API de subir em bancos recém-criados. Rode o fix antes da primeira execução:

```bash
bash __scripts__/dev/fix-broken-migrations.sh
```

Saída esperada:
```
Verificando banco dev_render                   ... CORRIGIDO ✓
Verificando banco dev_render_dev               ... CORRIGIDO ✓
Verificando banco dev_render_liotecnica        ... CORRIGIDO ✓
```

> Se os bancos ainda não existem (primeira vez), a API vai criá-los e depois o script pode ser ignorado — a migration já estará marcada ao criar. Rode o script **depois** da primeira tentativa que falhar.

---

## Rodando o projeto

### Tudo junto (recomendado)

```bash
cd Voltage.RenderRH
bash __scripts__/dev/dev-all.sh
```

Abre automaticamente:
- `http://localhost:3000/app` — Next.js (frontend principal)
- `http://localhost:5056/swagger` — API .NET (Swagger)
- `http://localhost:5051` — Portal (LioTecnica.Web MVC)

### Serviços individualmente

```bash
bash __scripts__/dev/dev-api.sh      # Só a API .NET (porta 5056)
bash __scripts__/dev/dev-portal.sh   # Só o Portal MVC (porta 5051)
bash __scripts__/dev/dev-next.sh     # Só o Next.js (porta 3000)
```

---

## Credenciais de desenvolvimento

| Tipo | Email | Senha |
|---|---|---|
| Owner (super admin) | `owner@dev.local` | `ChangeThisPassword123!` |
| Admin tenant | `admin@dev.local` | `ChangeThisPassword123!` |

---

## Problemas conhecidos

### API não sobe: `relação "AgendaEventTypes" já existe`

A migration `20260411055438_AddUnidadeLotacaoHierarchyV2` foi gerada com todo o schema por engano. A solução é marcar ela como aplicada sem executá-la:

```bash
bash __scripts__/dev/fix-broken-migrations.sh
```

### Next.js: `Can't resolve 'algum-pacote/css/styles.css'`

Pacote não instalado. Rode:

```bash
cd LioTecnica.Web.Next
pnpm install
```

### Next.js com erros de cache após pull

```bash
cd LioTecnica.Web.Next
rm -rf .next
pnpm dev
```

### Portas ocupadas ao reiniciar

```bash
bash __scripts__/dev/kill-ports.sh
```

---

## Arquitetura resumida

```
LioTecnica.Web.Next      :3000   Next.js 16 (App Router) — frontend principal
RHPortal.Api             :5056   .NET 8 API — backend principal
LioTecnica.Web (Portal)  :5051   ASP.NET MVC — portal legado / admissão
RHPortal.Ai              :8000   Python FastAPI — matching por IA
Liotecnica.Integration.RM        .NET — integração TOTVS RM
```

Banco de dados: PostgreSQL com multi-tenant via connection string por tenant.

---

## Scripts úteis

| Script | Descrição |
|---|---|
| `__scripts__/dev/dev-all.sh` | Sobe tudo |
| `__scripts__/dev/fix-broken-migrations.sh` | Corrige migration V2 corrompida |
| `__scripts__/dev/apply-all-tenant-migrations.sh` | Aplica migrations em todos os tenants |
| `__scripts__/dev/kill-ports.sh` | Mata processos nas portas do projeto |
| `__scripts__/test-battery.sh` | Testa todos os endpoints principais |
