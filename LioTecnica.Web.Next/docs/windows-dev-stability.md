# Estabilidade do Next.js (Turbopack) no Windows

Este projeto roda `next dev` com **Turbopack**. No Windows/NTFS, é comum ter instabilidade de watcher (rebuild/refresh em loop) quando outros processos mexem em arquivos no disco (antivírus, indexação, builds .NET, logs, etc).

## Checklist rápido (ordem recomendada)

1) **Garanta que o Next não esteja reescrevendo dependências no startup**
- Evite rodar `pnpm install` automaticamente enquanto o dev server está de pé.
- Se precisar reinstalar deps, faça isso manualmente antes de iniciar.

2) **Exclusões no Windows Defender / antivírus**
- Adicione exclusões para:
  - `...\Voltage.RenderRH\LioTecnica.Web.Next\.next`
  - `...\Voltage.RenderRH\LioTecnica.Web.Next\node_modules`
  - (opcional) a pasta inteira do workspace `...\Qualiit RenderRH`

3) **Indexação do Windows**
- Se a pasta do projeto estiver indexada, desabilite indexação para o diretório do workspace.

4) **Evite pastas “sensíveis”**
- Preferir um caminho curto e fora de bibliotecas do usuário quando possível (ex.: `C:\dev\...`).

5) **WSL2 (mais estável)**
- Se ainda houver loop no Turbopack, rode o dev dentro do WSL2 com o código dentro do filesystem Linux (ex.: `~/projects/...`, não em `/mnt/c/...`).

## Validação
- Deixe `http://localhost:3000/app` aberto por 30–60s sem tocar em arquivos.
- O terminal do Next não deve ficar recompilando continuamente.

