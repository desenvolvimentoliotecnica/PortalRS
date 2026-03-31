"""
Location scoring: zone-based scoring using UF adjacency.
No geocoding needed — uses city name matching and UF proximity.
"""

# Adjacency map: each UF -> set of neighboring UFs
UF_ADJACENCY: dict[str, set[str]] = {
    "AC": {"AM", "RO"},
    "AL": {"BA", "PE", "SE"},
    "AM": {"AC", "MT", "PA", "RO", "RR"},
    "AP": {"PA"},
    "BA": {"AL", "ES", "GO", "MG", "PI", "PE", "SE", "TO"},
    "CE": {"PB", "PE", "PI", "RN"},
    "DF": {"GO", "MG"},
    "ES": {"BA", "MG", "RJ"},
    "GO": {"BA", "DF", "MG", "MS", "MT", "TO"},
    "MA": {"PA", "PI", "TO"},
    "MG": {"BA", "DF", "ES", "GO", "MS", "RJ", "SP"},
    "MS": {"GO", "MG", "MT", "PR", "SP"},
    "MT": {"AM", "GO", "MS", "PA", "RO", "TO"},
    "PA": {"AM", "AP", "MA", "MT", "TO"},
    "PB": {"CE", "PE", "RN"},
    "PE": {"AL", "BA", "CE", "PB", "PI"},
    "PI": {"BA", "CE", "MA", "PE", "TO"},
    "PR": {"MS", "SC", "SP"},
    "RJ": {"ES", "MG", "SP"},
    "RN": {"CE", "PB"},
    "RO": {"AC", "AM", "MT"},
    "RR": {"AM"},
    "RS": {"SC"},
    "SC": {"PR", "RS"},
    "SE": {"AL", "BA"},
    "SP": {"MG", "MS", "PR", "RJ"},
    "TO": {"BA", "GO", "MA", "MT", "PA", "PI"},
}


def normalize_location(value: str | None) -> str:
    if not value:
        return ""
    return value.strip().lower()


def calculate_location_score(
    candidato_cidade: str | None,
    candidato_uf: str | None,
    vaga_cidade: str | None,
    vaga_uf: str | None,
    vaga_modalidade: str | None = None,
) -> int:
    """
    Score 0-100 for location compatibility.

    Rules:
    - Remote job: always 100
    - Same city: 100
    - Same UF: 85
    - Neighboring UF: 45
    - Distant UF: 20
    - Missing data: 70 (neutral)
    """
    # Remote = perfect match
    modalidade = normalize_location(vaga_modalidade)
    if modalidade and any(kw in modalidade for kw in ("remoto", "remote", "home office", "anywhere")):
        return 100

    c_cidade = normalize_location(candidato_cidade)
    c_uf = (candidato_uf or "").strip().upper()
    v_cidade = normalize_location(vaga_cidade)
    v_uf = (vaga_uf or "").strip().upper()

    # Missing data
    if not c_uf or not v_uf:
        return 70

    # Same city
    if c_cidade and v_cidade and c_cidade == v_cidade and c_uf == v_uf:
        return 100

    # Same UF
    if c_uf == v_uf:
        return 85

    # Neighboring UF
    neighbors = UF_ADJACENCY.get(v_uf, set())
    if c_uf in neighbors:
        return 45

    # Distant
    return 20
