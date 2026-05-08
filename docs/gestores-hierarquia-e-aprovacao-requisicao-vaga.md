# Gestores, hierarquia visual e aprovação de requisição de vaga

Documento de referência para **decisões futuras de produto e arquitetura**. Última revisão conceitual: contexto de alinhamento entre a tela **Admin > Gestores** (`/app/admin/gestores`), a **visão de hierarquia/organograma** (RM) e o **workflow de aprovação** da requisição de pessoal.

## 1. Telas parecidas, papéis diferentes

| Artefato | Rota / componente (referência) | Função |
|----------|----------------------------------|--------|
| **“Gestores” (nome da URL)** | `AdminGestoresScreen` em `/admin/gestores` | Editor em **tabela**: por funcionário, define **gestor direto** e **nível hierárquico** (Portal). Persiste em `PUT /api/funcionarios/{id}/hierarquia` → `GestorDiretoId`, `NivelHierarquicoId`. O título da própria tela no código é **“Hierarquia de Funcionários”** (a URL “gestores” é legado/nomenclatura confusa). |
| **Catálogo de níveis** | `/admin/hierarquia` — `AdminHierarquiaScreen` | CRUD dos **rótulos/ordem** de nível (`NivelHierarquico`), não liga gestor a pessoa. |
| **Organograma / árvore RM** | `/admin/organograma` — ex. `HierarquiaTotvsTree` | **Visualização** (e insumo de negócio) da hierarquia **sincronizada do TOTVS RM** (`/api/hierarquias/tree`). Não substitui, por si só, o campo de gestor direto usado no motor de aprovação. |

Conclusão de UX: **organograma RM** responde “como a empresa está no RM”; a tabela **hierarquia no Portal** responde “**no cadastro do Portal**, quem é o gestor direto de cada um” — usado por regras internas (incl. aprovação).

## 2. Onde o aprovador da requisição de vaga é resolvido (código)

- Serviço: `SolicitacaoVagaService` (re)monta etapas chamando **`ApprovalWorkflowHelper.ResolveEtapasAsync`** com o **`SolicitanteId`** da solicitação e o tipo de fluxo **`RequisicaoPessoal`**.
- Implementação central: **`ApprovalWorkflowHelper`** (`Application/Common/ApprovalWorkflowHelper.cs`).

Para etapas configuradas como **Gestor direto** / **Gestor do gestor**, o motor usa exclusivamente:

- `Funcionario.GestorDiretoId` do **solicitante**;
- navegação `GestorDireto` → `GestorDiretoId` para o “gestor do gestor”;

**não** há consulta em tempo de aprovação à entidade de **árvore organizacional RM** (VHIERARQUIA) nem ao endpoint de tree do organograma.

Outros tipos de etapa (ex.: responsável por **unidade de lotação**, funcionário fixo, fila de perfil, revisão RH) também são resolvidos a partir de **entidades do Portal** + config (`EtapaConfigAprovacao`), não pela árvore RM na hora do clique.

## 3. Papel do RM em relação a `GestorDiretoId`

- O campo **`Funcionario.GestorDiretoId`** é a **fonte que o workflow lê**.
- Esse campo é **preenchido/atualizado** por integração, entre outros:
  - sync RM em massa / bulk (`FuncionariosSyncRmController` e fluxos relacionados);
  - **Totvs** — `TotvsGestorHierarchySyncRunner` (sincronização focada em gestor a partir do RM).

Ou seja: o RM costuma ser a **origem dos dados** de gestor, materializada no Portal; o workflow **não** “percorre o organograma RM” no momento da aprovação — ele lê o **valor já persistido** no funcionário.

## 4. Implicações para decisões futuras

1. **Manter apenas organograma na UI** não altera, por si só, o motor de aprovação: seria preciso **sempre** manter `GestorDiretoId` alinhado via sync (ou mudar o código do `ApprovalWorkflowHelper`).
2. **Eliminar ou ocultar `/admin/gestores`** só é seguro se:
   - o processo de **sync RM → Portal** for confiável e completo para todos os colaboradores relevantes, **e**
   - houver política clara para **exceções** (RH precisa corrigir gestor sem esperar o próximo sync).
3. **“Derivar aprovador só do RM” sem o campo no Portal** exigiria **mudança de arquitetura** (ex.: resolver gestor em runtime a partir da hierarquia RM ou de serviço externo), hoje **não** é o desenho.
4. Renomear rota/menu (“Hierarquia de aprovação”, “Gestor direto (Portal)”, etc.) pode reduzir a sensação de duplicidade com o organograma **sem** mudar backend.

Este arquivo **não** substitui especificação de API; serve para alinhar produto e equipe antes de refatorações ou remoção de telas.
