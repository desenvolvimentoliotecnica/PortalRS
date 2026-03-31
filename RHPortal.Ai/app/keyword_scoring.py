"""
Keyword-based scoring: port of MatchingService.CalculateScore from .NET.
Used as hybrid pre-filter before sending candidates to LLM.
"""
import unicodedata
from typing import Any


def normalize_text(value: str | None) -> str:
    if not value or not value.strip():
        return ""
    s = value.strip()
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    s = unicodedata.normalize("NFC", s).lower()
    allowed = []
    for c in s:
        if c.isalnum() or c in (" ", "+", "#"):
            allowed.append(c)
    result = " ".join("".join(allowed).split())
    return result


def split_sinonimos(raw: str | None) -> list[str]:
    if not raw or not raw.strip():
        return []
    items = []
    for part in raw.replace(";", ",").split(","):
        part = part.strip()
        if part:
            items.append(part)
    seen = set()
    unique = []
    for item in items:
        low = item.lower()
        if low not in seen:
            seen.add(low)
            unique.append(item)
    return unique


def calculate_keyword_score(
    profile_text_normalized: str,
    requisitos: list[dict[str, Any]],
) -> int:
    """
    Score 0-100 based on keyword matching (same formula as .NET MatchingService).
    """
    if not requisitos:
        return 0

    total_peso = 0
    hit_peso = 0
    miss_mandatory = 0

    for r in requisitos:
        peso_raw = r.get("Peso", 1)
        peso = max(0, min(10, int(peso_raw) if peso_raw is not None else 1))
        total_peso += peso

        nome = normalize_text(r.get("Nome"))
        syns_raw = r.get("SinonimosRaw") or ""
        syns = [normalize_text(s) for s in split_sinonimos(syns_raw)]
        syns = [s for s in syns if s]

        bag = []
        if nome:
            bag.append(nome)
        bag.extend(syns)

        found = any(t and t in profile_text_normalized for t in bag)

        if found:
            hit_peso += peso
        elif r.get("Obrigatorio"):
            miss_mandatory += 1

    if total_peso <= 0:
        return 0

    score = round((hit_peso * 100) / total_peso)
    if miss_mandatory > 0:
        score = max(0, score - min(40, miss_mandatory * 15))
        score = min(score, 60)

    return score


def compute_hybrid_pre_score(
    vector_similarity: float,
    keyword_score: int,
    vector_weight: float = 0.6,
    keyword_weight: float = 0.4,
) -> float:
    """
    Hybrid pre-LLM score combining vector similarity and keyword matching.
    """
    return vector_similarity * vector_weight + keyword_score * keyword_weight
