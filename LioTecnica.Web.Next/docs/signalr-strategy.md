# Estratégia SignalR (sem expor `access_token` no browser)

## Objetivo

Permitir que o Next.js consuma **notificações em tempo real** (SignalR) sem repetir o padrão legado de injetar `access_token` no HTML/`window`.

## Princípios

- O browser **não deve** receber `access_token` do RH API.
- A autenticação continua **cookie-based** (legado como fonte de verdade).
- O Next consome **mesma origem** (ideal) para evitar CORS e simplificar cookies.

## Opção recomendada (Proxy do Hub via BFF / reverse proxy)

### Como funciona

1. Browser (UI Next) conecta em um Hub **na mesma origem**:
   - `wss://<dominio>/bff/hubs/notifications`
2. O ASP.NET (BFF) faz proxy da conexão (WebSocket) para o Hub real do RH API:
   - `wss://<rh-api>/hubs/notifications`
3. No caminho do proxy, o ASP.NET **injeta** o `Authorization: Bearer <token>` usando:
   - claim `access_token` (usuário tenant), ou
   - cookie `OwnerAccessToken` (contexto Owner), ou
   - estratégia equivalente já usada pelo `ApiAuthenticationHandler` nos `HttpClient`s.

### Por que atende a restrição

- O token **nunca** vai para o browser.
- A UI só precisa de cookies (já existentes) e do endpoint/hub local `/bff/...`.

### Implementação sugerida (alto nível)

- **BFF (ASP.NET)**:
  - Criar rota de proxy WebSocket (ex.: via YARP) para `/bff/hubs/notifications/{**catch-all}`.
  - Adicionar *transform* para anexar `Authorization` com token obtido no servidor.
  - Manter feature flag (ex.: `SignalRProxy:Enabled`) para rollback.

- **Next.js**:
  - Consumir o Hub sempre via `basePath` + mesma origem:
    - URL final: `/bff/hubs/notifications`
  - Reaproveitar a UI/feature de notifications para “listar” via HTTP (`GET /bff/notifications`) e “live updates” via Hub.

## Alternativa (Token efêmero via BFF)

### Como funciona

1. UI chama `POST /bff/signalr/notifications-token`.
2. O BFF troca a sessão/cookie por um **token curto** (ex.: 30–60s) e retorna para o browser.
3. Browser conecta no hub do RH API usando o token curto.

### Trade-off

- Ainda existe token no browser (apesar de curto). É aceitável apenas se o proxy WebSocket não for viável.

## Checklist de pronto (quando implementar)

- UI do Next **não** usa `window.__apiAccessToken`.
- Conexão SignalR funciona em tenant e em Owner (quando aplicável).
- Rollback: desligar flag e voltar para polling/HTTP (`GET /bff/notifications`) sem quebrar a UI.
- Teste E2E (smoke):
  - “abre dashboard” + “conecta hub” (pode validar só que não dá erro, ou que recebe 1 evento de teste em ambiente dev).

