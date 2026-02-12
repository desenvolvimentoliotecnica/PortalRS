"""
Parser do texto MatchingFiltrosRaw da vaga para lista de critérios.
Formato gerado pelo front (vagas.js): "Modalidade: X. Senioridade: Y. TempoExperiencia: 5 ou mais anos. ..."
Cada par Label: valor é um critério; Observacoes conta como um critério de texto livre.
"""
import re
from typing import Any


# Labels reconhecidos (case-insensitive); Observacoes/Observações aceitos
_LABEL_PATTERN = re.compile(
    r"^(Modalidade|Senioridade|Escolaridade|Forma[cç]ao|Cidade|UF|"
    r"TempoExperiencia|Sexo|PCD|IdadeMin|IdadeMax|RequerCNH|CategoriaCNH|"
    r"Habilidades|Observacoes|Observações)\s*:\s*(.+)$",
    re.IGNORECASE,
)


def parse_matching_filtros_raw(raw: str | None) -> list[dict[str, str]]:
    """
    Extrai critérios do texto MatchingFiltrosRaw.
    Retorna lista de dicts com chaves 'label' e 'valor' (ex.: {'label': 'TempoExperiencia', 'valor': '5 ou mais anos'}).
    Observação entra como um único critério com label 'Observacoes'.
    """
    if not raw or not isinstance(raw, str):
        return []
    text = raw.strip()
    if not text:
        return []

    criteria: list[dict[str, str]] = []
    parts = re.split(r"\s*\.\s*", text)
    observacoes_parts: list[str] = []

    for part in parts:
        part = part.strip()
        if not part:
            continue
        match = _LABEL_PATTERN.match(part)
        if match:
            label = match.group(1)
            # Normalizar label (primeira letra maiúscula, resto como veio para exibição)
            if label.lower().startswith("formac") or label.lower().startswith("formação"):
                label = "Formacao"
            elif label.lower() == "observações":
                label = "Observacoes"
            value = (match.group(2) or "").strip()
            if value:
                criteria.append({"label": label, "valor": value})
        else:
            observacoes_parts.append(part)

    if observacoes_parts:
        criteria.append({"label": "Observacoes", "valor": " ".join(observacoes_parts)})

    return criteria


def criteria_to_prompt_text(criteria: list[dict[str, Any]]) -> str:
    """Formata a lista de critérios para uso no prompt do LLM (uma linha por critério)."""
    if not criteria:
        return ""
    return "\n".join(f"- {c['label']}: {c['valor']}" for c in criteria)
