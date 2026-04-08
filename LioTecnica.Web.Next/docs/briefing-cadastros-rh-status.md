# Cadastros TOTVS + Solicitação de vaga — status (breve)

## Como estamos

| Cadastro | Menu / tela | Import | Campos estilo `.p` | Uso na **Solicitação de Nova Vaga** |
|----------|-------------|--------|--------------------|-------------------------------------|
| **Cargo** | `/cargos` | Sim (Excel/TSV) | Parcial (`JobPosition`: código, nome, classificação ocupacional, tipo, similaridade, descrição completa, etc.) | **Parcial**: `jobPositionId` existe, mas é **`<select>`**, sem autocomplete (código+descrição) e **não obrigatório** no front |
| **Categoria salarial** | `/unidades` (aba) e `/totvs-categorias-salariais` | Sim | Básico (código, descrição, ativo) | **Não** |
| **Turno** | Aba + `/totvs-turnos` | Sim | + horários / observações | **Não** |
| **Centro de custo** | Aba + `/totvs-centros-custo` | Sim | + gerente / observações | **Não** |
| **Unidade de lotação** | Aba + `/totvs-unidades-lotacao` | Sim | + local / gerente / observações | **Não** |

**Referência já correta:** formulário de **Vaga** (`VagaFormModal`) usa autocompletes de cargo, categoria, centro de custo, turno e unidade de lotação.

## O que falta (alinhado ao Victor Alves)

1. **Solicitação de Nova Vaga** — espelhar a vaga: autocomplete **obrigatório** para **cargo** (mostrar cargo + descrição); incluir e persistir **categoria salarial, turno, centro de custo, unidade de lotação** (modelo/API/UI hoje só têm cargo/área/unidade organizacional).
2. **Paridade com os `.p`** — checklist formal **campo a campo** (ex.: `apisfcargo` / `cargo_basic` vs `JobPosition`; demais programas vs entidades/telas) para validar nomes e obrigatoriedade.
3. **Backend da solicitação** — estender `SolicitacaoVaga` + contratos se os novos vínculos forem exigidos no fluxo de aprovação → vaga.
