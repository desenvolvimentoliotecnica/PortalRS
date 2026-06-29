# Liotecnica Hub — repositório dedicado

O **Liotecnica Hub** foi extraído deste monorepo e passou a viver em repositório próprio:

- **GitHub:** [desenvolvimentoliotecnica/LiotecnicaHub](https://github.com/desenvolvimentoliotecnica/LiotecnicaHub)
- **Clone local sugerido:** `D:\Projetos\PortalRH\LiotecnicaHub`
- **Branches:** `DEV`, `HML`, `PRD`

Documentação de deploy, SSO e operação do Hub está no repositório acima (`docs/HUB-*.md`).

## Integração com o Portal RH (permanece neste repo)

O `RHPortal.Api` continua consumindo tokens SSO emitidos pelo Hub via `HubSso__SigningKey` (mesmo valor de `HUB_STATE_SIGNING_KEY` no Hub). Ver `docs/env.hmg.example` e configuração `HubSso` em produção/homologação.
