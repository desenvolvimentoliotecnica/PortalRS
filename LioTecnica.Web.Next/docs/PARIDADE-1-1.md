# Garantia de paridade 1:1 — Razor → Next.js

**Objetivo:** Garantir que o Next.js funcione igual ao legado Razor em funcionalidade e experiência.

---

## 1. Pré-requisitos de deploy

Para paridade 1:1, o ambiente precisa estar configurado assim:

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `NEXT_PUBLIC_API_BASE` | URL da API (RHPortal.Api) | `http://localhost:5056` |
| `DEV_API_ORIGIN` | Rewrite local de `/api/*`, `/health`, `/hubs/*` | `http://localhost:5056` |
| `DEV_BFF_ORIGIN` | Rewrite local de `/bff/*` (login/entra/switch-tenant legado) | `http://localhost:5051` |
| `LEGACY_ORIGIN` | Fallback de compat para `DEV_BFF_ORIGIN` | `http://localhost:5051` |

**Arquitetura esperada:**
- **Next.js** em `/app` (ou subdomínio)
- **Legado Razor** (LioTecnica.Web) na raiz ou subdomínio
- **RHPortal.Api** servindo `/api/*`
- **Proxy/reverse:** `/api/*` e `/health` → RHPortal.Api; `/bff/*` → Legado (enquanto necessário)

---

## 2. O que está implementado e funcionando

### 2.1 App principal (admin/operacional)

| Funcionalidade | Legado | Next | Status |
|----------------|--------|------|--------|
| Login (email/senha) | `/Account/Login` | `/login` + `/api/auth/login` | ✅ |
| Logout | `POST /Account/Logout` | `clearSession` + `POST /api/auth/logout` (se existir) | ✅ |
| Troca de tenant (Owner) | SwitchTenant | `/api/me/switch-tenant` | ✅ |
| Dashboard, Vagas, Candidatos, Talentos, Triagem, Matching | Rotas correspondentes | Rotas Next | ✅ |
| Candidatos — Detalhes | Modal + página | Modal + link "Abrir em página" | ✅ |
| Cadastros (Departamentos, Áreas, Categorias, Cargos, etc.) | Rotas correspondentes | Rotas Next | ✅ |
| Gestão, Feedback, Relatórios, Notificações | Rotas correspondentes | Rotas Next | ✅ |
| Admin — Roles, Users, Menus | Páginas Edit | Formulários inline (criar, editar, excluir) | ✅ |
| Owner — Tenants | Lista + Details | Lista + `?id=` ou `[tenantId]` | ✅ |

### 2.2 Portal do Candidato (PortalVagas)

| Funcionalidade | Legado | Next | Status |
|----------------|--------|------|--------|
| Listagem de vagas | Index + jobs-data.js | PortalVagasScreen + `/api/public/vagas` | ✅ |
| Vagas agrupadas por área | buildSection | getSectionInfo + seções | ✅ |
| Job cards com hero | job-hero gradient | JobCard.tsx | ✅ |
| Modal detalhes (tags, resumo, responsabilidades, copiar link) | _JobModal | Modal completo | ✅ |
| Filtros (selects) | _FiltersDrawer | Selects inline | ✅ |
| Search box (Buscar/Limpar) | search-box | Caixa dedicada | ✅ |
| Candidatura (Apply) | Modal | Modal | ✅ |
| Login candidato | POST /PortalVagas/Auth/Login | `POST /api/public/portal-auth/login` | ✅ |
| Registro candidato | POST /PortalVagas/Auth/Register | `POST /api/public/portal-auth/register` | ✅ |
| Logout candidato | POST /PortalVagas/Logout | Limpeza de sessão local do candidato | ✅ |
| Perfil (12 abas) | _ProfileModal | Modal com seções | ✅ |
| Agenda, Skills, Education, etc. | Rotas /PortalVagas/* | `api/public/portal-candidates/*` | ✅ |

### 2.3 APIs

O Next chama:
- **RHPortal.Api** (`/api/*`): auth, vagas, candidatos, roles, users, menus, dashboard, lookup, etc.
- **Legado** (`/bff/*`): fluxos de autenticação legados ainda não migrados (ex.: Entra redirect).

O legado precisa estar acessível em `/bff/*` até fechamento total do BFF.

---

## 3. Diferenças conhecidas (não bloqueantes)

| Aspecto | Legado | Next | Impacto |
|---------|--------|------|---------|
| **Autenticação** | Cookie HttpOnly | Token em localStorage | XSS: token exposto. Mitigação: CSP, sanitização. |
| **Login Entra ID** | `/Account/EntraLogin` (OIDC) | Ativo via `/bff/auth/entra-login` + `/api/auth/entra-login` | Requer tenant válido e configuração ativa no legado. |
| **Admin Edit** | Páginas separadas | Formulários inline | Funcionalidade equivalente. |
| **Estética** | Bootstrap, portal-vagas.css | Tailwind | Visual diferente, não bloqueante. |
| **i18n** | portal-vagas-strings.js | Textos hardcoded pt-BR | Opcional. |

---

## 4. Checklist de validação

Antes de considerar paridade 1:1 garantida, validar:

- [ ] **Login:** Entrar com tenant + email + senha → redireciona para dashboard
- [ ] **Logout:** Clicar em Sair → limpa sessão e redireciona para /login
- [ ] **Owner:** Trocar para tenant Owner → ver lista de tenants
- [ ] **Owner/Tenants:** Clicar em tenant → ver detalhes (ou `?id=` na URL)
- [ ] **Candidatos:** Listar, filtrar, abrir detalhes (modal), "Abrir em página"
- [ ] **Admin Roles/Users/Menus:** Criar, editar, excluir
- [ ] **PortalVagas:** Listar vagas, filtrar, ver detalhes, candidatar-se
- [ ] **PortalVagas Acesso:** Login e registro de candidato
- [ ] **PortalVagas Logout:** Candidato logado clica em Sair → desloga

---

## 5. Troubleshooting

### PortalVagas não carrega vagas
- Verificar `tenantId` na URL (`?tenantId=xxx`)
- Verificar que `NEXT_PUBLIC_API_BASE` aponta para RHPortal.Api (que expõe `/api/public/vagas`)

### PortalVagas Login/Profile/Agenda falha
- Verificar `tenantId` na URL e sessão local do candidato
- Verificar que `NEXT_PUBLIC_API_BASE` aponta para RHPortal.Api
- Conferir se `X-Tenant-Id` está sendo enviado nas chamadas públicas

### Logout candidato não funciona
- Logout no Next limpa sessão local do candidato.
- Para invalidar cookies legados antigos, sair também do legado quando necessário.

### Rotas 404
- Verificar `ROUTE_MAP` em SidebarNavClient.tsx
- Verificar que o BFF retorna hrefs que o `normalizeHref` converte corretamente
