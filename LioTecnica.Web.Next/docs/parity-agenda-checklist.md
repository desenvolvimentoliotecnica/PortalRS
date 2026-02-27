# Checklist de paridade — Agenda (Razor ↔ Next)

## 1) Agenda interna (`/agendas`)

- [ ] **Carregamento inicial**
  - [ ] Tipos carregam (`GET /Agendas/_api/types`)
  - [ ] Candidatos/Vagas carregam (`GET /api/candidatos`, `GET /api/vagas`)
  - [ ] Eventos carregam por range (`GET /Agendas/_api/events?start=&end=`) ao abrir a tela
- [ ] **Calendário**
  - [ ] Botões Prev/Hoje/Next funcionam
  - [ ] Toggle **Dia/Semana** funciona
  - [ ] **Título do período** (ex.: “fev de 2026”) atualiza ao navegar
  - [ ] Drag/drop move evento e mostra toast “Evento movido.”
  - [ ] Resize altera duração e mostra toast “Duração atualizada.”
- [ ] **CRUD**
  - [ ] Criar evento pelo botão “Novo evento”
  - [ ] Criar evento por seleção no calendário (arrastar/selecionar)
  - [ ] Editar evento
  - [ ] Excluir evento (com confirmação)
  - [ ] **Duplicar +7d** salva diretamente (cria novo evento) e fecha modal
- [ ] **Detalhes**
  - [ ] Modal de detalhes mostra **Tipo (label + ícone)** + **Status**
  - [ ] Modal de detalhes mostra **range** (início–fim)
- [ ] **Laterais/KPIs**
  - [ ] KPIs (Hoje/Semana/Pendente/Entrevistas) batem com o legado
  - [ ] Lista “Próximos” mostra tipo (label+ícone), status e candidato
- [ ] **Import/Export**
  - [ ] Export gera JSON com `types`, `events` e `settings`
  - [ ] Import aceita `{ events: [...] }` e cria eventos

## 2) Portal Vagas — Disponibilidade & Agenda

- [ ] **Carregamento**
  - [ ] `GET /PortalVagas/Agenda` carrega preferências + bloqueios
  - [ ] Caso não autenticado, UI exibe instrução e link para autenticar
- [ ] **Preferências**
  - [ ] Salvar formato de entrevista
  - [ ] Salvar data de início disponível (debounced)
  - [ ] Salvar aviso prévio
  - [ ] Salvar observações (debounced)
  - [ ] Salvar dias preferidos (Seg–Dom)
  - [ ] Salvar períodos (manhã/tarde/noite)
  - [ ] Salvar horário preferido (debounced)
  - [ ] Salvar fuso horário
- [ ] **Bloqueios**
  - [ ] Criar bloqueio (`POST /PortalVagas/Agenda/Blocks`)
  - [ ] Editar bloqueio (`PUT /PortalVagas/Agenda/Blocks/{id}`)
  - [ ] Remover bloqueio (`DELETE /PortalVagas/Agenda/Blocks/{id}`)
  - [ ] Buscar, ordenar e filtrar por tipo
- [ ] **Limpar**
  - [ ] Limpar preferências e remover bloqueios (equivalente ao legado)

