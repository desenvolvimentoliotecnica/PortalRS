# Portal Vagas no Next (basePath `/app`) — regra de rewrite

Este projeto Next roda com `basePath: "/app"` (ver `next.config.ts`). Isso significa que a UI do Portal Vagas implementada aqui é servida em:

- **UI Next**: `/app/PortalVagas` (internamente: `/PortalVagas`)

Mas, no legado (Razor), o Portal Vagas público é acessado em:

- **UI Legado**: `/PortalVagas`

## Objetivo

Expor o Portal Vagas migrado **na mesma URL do legado** (`/PortalVagas`) sem remover o `basePath` (migração incremental).

## Como fazer

Crie uma regra no host (IIS / reverse-proxy / gateway) que reescreva:

- `/PortalVagas` → `/app/PortalVagas`
- `/PortalVagas/*` → `/app/PortalVagas/*`

> Importante: isso é para a **UI**. As APIs do legado continuam em `/PortalVagas/Agenda*` e afins (e o Next já faz proxy dessas rotas quando `LEGACY_ORIGIN` está configurado).

## Exemplo (IIS URL Rewrite)

Crie uma regra de *Rewrite* com estas condições:

- **Match URL**: `^PortalVagas(.*)$`
- **Action**: Rewrite para `/app/PortalVagas{R:1}`

## Observações

- Como o Next faz a migração incremental com `basePath`, **não** tente servir o Next diretamente em `/PortalVagas` sem essa regra (ou sem separar um segundo app Next sem `basePath`).
- As chamadas de API usadas pela UI migrada são feitas para `/app/PortalVagas/Agenda*` e são encaminhadas ao legado via `rewrites()` no `next.config.ts`.

