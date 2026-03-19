"""
Motor de Matching Unificado: Vetorização (pgvector) + LLM (GPT-4o-mini).

Pipeline:
1. Pré-filtro vetorial → top N (Candidatos UNION Talentos)
2. LLM avalia cada top N:
   - v1: score_filtros (0-100) × 0.80 + score_requisitos (0-100) × 0.20
   - v2: score_filtros (0-100) × 0.65 + score_requisitos (0-100) × 0.35 + gates rígidos
3. Retorna ranking ordenado (candidatos + talentos)
"""
import json
import os
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Optional

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

from app.config import OPENAI_API_KEY, OPENAI_CHAT_MODEL, DEFAULT_RANKING_SIZE
from app.log import matching as log
from app.db import (
    get_vaga_perfil,
    get_candidato_perfil,
    get_talento_perfil,
    get_vagas_abertas_ids,
)
from app.embeddings import (
    generate_vaga_embedding,
    generate_candidato_embedding,
    generate_talento_embedding,
    save_vaga_embedding,
    save_candidato_embedding,
    save_talento_embedding,
    _build_talento_text_for_embedding,
    _build_candidato_text_for_embedding,
)
from app.vector_search import search_all_by_similarity
from app.filtros import parse_matching_filtros_raw, criteria_to_prompt_text

# ─── Regras de score ────────────────────────────────────────────────────────

RULE_V1 = "v1_80_20"
RULE_V2 = "v2_65_35_strict"

SUPPORTED_RULES = {RULE_V1, RULE_V2}
DEFAULT_RULE = os.getenv("MATCHING_RULE_VERSION", RULE_V1).strip() or RULE_V1

PESO_FILTROS_V1 = 0.80
PESO_REQUISITOS_V1 = 0.20

PESO_FILTROS_V2 = 0.65
PESO_REQUISITOS_V2 = 0.35

PENALTY_PER_MISSING_MANDATORY_V2 = 20
PENALTY_MAX_V2 = 60
MANDATORY_CAP_IF_MISSING_V2 = 89
MANDATORY_CAP_IF_COVERAGE_LT_70_V2 = 79
MANDATORY_CAP_IF_COVERAGE_LT_50_V2 = 69

MAX_LLM_WORKERS = max(1, min(12, int(os.getenv("MATCHING_MAX_LLM_WORKERS", "5"))))
VECTOR_LIMIT_MULTIPLIER = max(2, min(6, int(os.getenv("MATCHING_VECTOR_LIMIT_MULTIPLIER", "3"))))
VECTOR_LIMIT_MAX = max(30, int(os.getenv("MATCHING_VECTOR_LIMIT_MAX", "300")))


# ─── Pipeline Principal ────────────────────────────────────────────────────

def run_unified_matching(
    vaga_id: str,
    tenant_id: str | None = None,
    top_n: int | None = None,
    rule_version: str | None = None,
) -> list[dict[str, Any]]:
    """
    Executa matching completo para uma vaga:
    1. Garante que a vaga tem embedding
    2. Busca vetorial UNION (Candidatos + Talentos) → top N
    3. LLM avalia cada top N → score final pela regra selecionada
    4. Retorna ranking ordenado por score_final

    Args:
        vaga_id: ID da vaga
        tenant_id: ID do tenant
        top_n: Tamanho do ranking (default: DEFAULT_RANKING_SIZE = 20)

    Returns:
        Lista ordenada de dicts com person_id, nome, email, source, scores, justificativa
    """
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY não configurada")

    ranking_size = top_n or DEFAULT_RANKING_SIZE
    ranking_size = max(10, min(100, ranking_size))
    normalized_rule = _normalize_rule(rule_version)

    # 1. Buscar dados completos da vaga
    vaga = get_vaga_perfil(vaga_id, tenant_id)
    if not vaga:
        raise ValueError(f"Vaga {vaga_id} não encontrada")

    # 2. Garantir embedding da vaga (no banco do tenant)
    _ensure_vaga_embedding(vaga_id, vaga, tenant_id)

    # 3. Pré-filtro vetorial → top N
    # Usa multiplicador configurável para equilibrar recall e latência.
    vector_limit = min(VECTOR_LIMIT_MAX, ranking_size * VECTOR_LIMIT_MULTIPLIER)
    vector_results = search_all_by_similarity(
        vaga_id, tenant_id, limit=vector_limit, min_score=0
    )

    if not vector_results:
        return []

    # 4. LLM avalia cada candidato/talento do top vetorial
    llm = ChatOpenAI(
        model=OPENAI_CHAT_MODEL,
        openai_api_key=OPENAI_API_KEY,
        temperature=0,
    )

    # Preparar contexto da vaga para o prompt
    filtros_raw = (vaga.get("MatchingFiltrosRaw") or "").strip()
    criteria = parse_matching_filtros_raw(filtros_raw)
    filtros_text = criteria_to_prompt_text(criteria) if criteria else "Nenhum filtro definido"
    keywords_raw = (vaga.get("TagsKeywordsRaw") or "").strip()
    keywords_text = keywords_raw.replace(";", ", ") if keywords_raw else "Nenhuma palavra-chave definida"

    requisitos = vaga.get("requisitos") or []
    requisitos_text = _build_requisitos_text(requisitos)

    vaga_context = _build_vaga_context(vaga, filtros_text, keywords_text, requisitos_text)

    ranked = []
    t0 = time.time()

    def _evaluate_one_person(person: dict) -> dict | None:
        """Avalia uma pessoa com LLM (executada em thread paralela)."""
        person_id = person["person_id"]
        source = person["source"]

        profile_text = _get_person_profile_text(person_id, source, tenant_id)
        if not profile_text:
            return None

        # Cada thread cria seu próprio LLM client (thread-safe)
        thread_llm = ChatOpenAI(
            model=OPENAI_CHAT_MODEL,
            openai_api_key=OPENAI_API_KEY,
            temperature=0,
        )

        scores = _evaluate_with_llm(thread_llm, vaga_context, profile_text)
        if scores is None:
            return None

        mandatory_total, mandatory_missing = _estimate_mandatory_coverage(
            profile_text, requisitos
        )
        score_meta = _compute_final_score(
            scores["score_filtros"],
            scores["score_requisitos"],
            mandatory_total,
            mandatory_missing,
            normalized_rule,
        )

        return {
            "person_id": person_id,
            "nome": person["nome"],
            "email": person["email"],
            "source": source,
            "similaridade_vetorial": person["similaridade"],
            "score_filtros": scores["score_filtros"],
            "score_requisitos": scores["score_requisitos"],
            "score_final": score_meta["score_final"],
            "justificativa": scores.get("justificativa", ""),
            "mandatory_total": score_meta["mandatory_total"],
            "missing_mandatory_count": score_meta["missing_mandatory_count"],
            "mandatory_coverage": score_meta["mandatory_coverage"],
            "hard_penalty": score_meta["hard_penalty"],
            "rule_version": normalized_rule,
        }

    # Paralelizar avaliação LLM com limite configurável
    max_workers = min(MAX_LLM_WORKERS, len(vector_results))
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_evaluate_one_person, p): p for p in vector_results}
        for future in as_completed(futures):
            try:
                result = future.result()
                if result:
                    ranked.append(result)
            except Exception as e:
                person = futures[future]
                log.error("eval_person_failed", extra={"ctx": {"person_id": person.get("person_id", "?"), "error": str(e)}})

    elapsed = time.time() - t0
    log.info("matching_done", extra={"ctx": {
        "tenant": tenant_id or "-",
        "vaga": vaga_id,
        "rule": normalized_rule,
        "ranking_size": ranking_size,
        "vector_limit": vector_limit,
        "workers": max_workers,
        "avaliados": len(ranked),
        "total_vetorial": len(vector_results),
        "elapsed_s": round(elapsed, 1),
    }})

    # Ordenar por score final e limitar ao ranking_size
    ranked.sort(key=lambda x: x["score_final"], reverse=True)
    return ranked[:ranking_size]


# ─── Avaliação Individual (novo candidato/talento) ─────────────────────────

def evaluate_single_person(
    vaga_id: str,
    person_id: str,
    source: str,
    tenant_id: str | None = None,
    rule_version: str | None = None,
) -> dict[str, Any] | None:
    """
    Avalia uma única pessoa contra uma vaga.
    Usado quando um novo candidato/talento chega e precisa entrar no ranking.

    Returns:
        Dict com scores ou None se não for possível avaliar
    """
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY não configurada")

    vaga = get_vaga_perfil(vaga_id, tenant_id)
    if not vaga:
        return None

    profile_text = _get_person_profile_text(person_id, source, tenant_id)
    if not profile_text:
        return None

    llm = ChatOpenAI(
        model=OPENAI_CHAT_MODEL,
        openai_api_key=OPENAI_API_KEY,
        temperature=0,
    )

    filtros_raw = (vaga.get("MatchingFiltrosRaw") or "").strip()
    criteria = parse_matching_filtros_raw(filtros_raw)
    filtros_text = criteria_to_prompt_text(criteria) if criteria else "Nenhum filtro definido"
    keywords_raw = (vaga.get("TagsKeywordsRaw") or "").strip()
    keywords_text = keywords_raw.replace(";", ", ") if keywords_raw else "Nenhuma palavra-chave definida"
    requisitos = vaga.get("requisitos") or []
    requisitos_text = _build_requisitos_text(requisitos)
    vaga_context = _build_vaga_context(vaga, filtros_text, keywords_text, requisitos_text)

    scores = _evaluate_with_llm(llm, vaga_context, profile_text)
    if scores is None:
        return None

    normalized_rule = _normalize_rule(rule_version)
    mandatory_total, mandatory_missing = _estimate_mandatory_coverage(
        profile_text, requisitos
    )
    score_meta = _compute_final_score(
        scores["score_filtros"],
        scores["score_requisitos"],
        mandatory_total,
        mandatory_missing,
        normalized_rule,
    )

    return {
        "person_id": person_id,
        "source": source,
        "score_filtros": scores["score_filtros"],
        "score_requisitos": scores["score_requisitos"],
        "score_final": score_meta["score_final"],
        "mandatory_total": score_meta["mandatory_total"],
        "missing_mandatory_count": score_meta["missing_mandatory_count"],
        "mandatory_coverage": score_meta["mandatory_coverage"],
        "hard_penalty": score_meta["hard_penalty"],
        "rule_version": normalized_rule,
        "justificativa": scores.get("justificativa", ""),
    }


# ─── Geração de Embeddings ─────────────────────────────────────────────────

def _ensure_vaga_embedding(vaga_id: str, vaga: dict[str, Any], tenant_id: str | None = None) -> None:
    """Gera e salva embedding da vaga se não existir (no banco do tenant)."""
    from app.embeddings import get_vaga_embedding
    if get_vaga_embedding(vaga_id, tenant_id) is None:
        emb = generate_vaga_embedding(vaga)
        save_vaga_embedding(vaga_id, emb, tenant_id)


def ensure_person_embedding(
    person_id: str,
    source: str,
    tenant_id: str | None = None,
) -> bool:
    """
    Gera e salva embedding de uma pessoa (candidato ou talento).
    Retorna True se o embedding foi gerado com sucesso.
    """
    try:
        if source == "candidato":
            from app.embeddings import get_candidato_embedding
            if get_candidato_embedding(person_id, tenant_id) is not None:
                return True
            perfil = get_candidato_perfil(person_id, tenant_id)
            if not perfil:
                return False
            emb = generate_candidato_embedding(perfil)
            return save_candidato_embedding(person_id, emb, tenant_id)
        elif source == "talento":
            from app.embeddings import get_talento_embedding
            if get_talento_embedding(person_id, tenant_id) is not None:
                return True
            perfil = get_talento_perfil(person_id, tenant_id)
            if not perfil:
                return False
            emb = generate_talento_embedding(perfil)
            return save_talento_embedding(person_id, emb, tenant_id)
        return False
    except Exception as e:
        log.error("embedding_gen_failed", extra={"ctx": {"source": source, "person_id": person_id, "error": str(e)}})
        return False


# ─── Funções Auxiliares ─────────────────────────────────────────────────────

def _get_person_profile_text(
    person_id: str,
    source: str,
    tenant_id: str | None = None,
) -> str | None:
    """Busca perfil completo e monta texto canônico para avaliação LLM."""
    if source == "candidato":
        perfil = get_candidato_perfil(person_id, tenant_id)
        if not perfil:
            return None
        return _build_candidato_text_for_embedding(perfil)
    elif source == "talento":
        perfil = get_talento_perfil(person_id, tenant_id)
        if not perfil:
            return None
        return _build_talento_text_for_embedding(perfil)
    return None


def _build_requisitos_text(requisitos: list[dict[str, Any]]) -> str:
    """Formata requisitos da vaga para o prompt LLM."""
    if not requisitos:
        return "Nenhum requisito técnico definido"

    lines = []
    for r in requisitos:
        nome = (r.get("Nome") or "").strip()
        if not nome:
            continue
        obrig = "OBRIGATÓRIO" if r.get("Obrigatorio") else "desejável"
        peso = r.get("Peso", 1)
        syn = (r.get("SinonimosRaw") or "").strip()
        anos = r.get("AnosMinimos")
        nivel = r.get("Nivel") or ""

        text = f"- {nome} ({obrig}, peso {peso})"
        if syn:
            text += f" [sinônimos aceitos: {syn}]"
        if anos:
            text += f" [mínimo {anos} anos]"
        if nivel:
            text += f" [nível: {nivel}]"
        lines.append(text)

    return "\n".join(lines) if lines else "Nenhum requisito técnico definido"


def _normalize_text(value: str) -> str:
    s = (value or "").strip().lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    return s


def _normalize_rule(rule_version: str | None) -> str:
    rv = (rule_version or DEFAULT_RULE).strip()
    return rv if rv in SUPPORTED_RULES else RULE_V1


def _extract_requisito_terms(requisito: dict[str, Any]) -> list[str]:
    nome = (requisito.get("Nome") or "").strip()
    syn_raw = (requisito.get("SinonimosRaw") or "").strip()
    terms = [nome]
    if syn_raw:
        terms.extend([t.strip() for t in syn_raw.replace(";", ",").split(",") if t.strip()])
    return [_normalize_text(t) for t in terms if t]


def _estimate_mandatory_coverage(profile_text: str, requisitos: list[dict[str, Any]]) -> tuple[int, int]:
    """
    Heurística leve para cobertura de obrigatórios.
    Usada apenas para gates de rigor na regra v2.
    """
    normalized_profile = _normalize_text(profile_text)
    mandatory = [r for r in requisitos if bool(r.get("Obrigatorio"))]
    total = len(mandatory)
    if total == 0:
        return 0, 0

    missing = 0
    for r in mandatory:
        terms = _extract_requisito_terms(r)
        found = any(term and term in normalized_profile for term in terms)
        if not found:
            missing += 1
    return total, missing


def _compute_final_score(
    score_filtros: int,
    score_requisitos: int,
    mandatory_total: int,
    mandatory_missing: int,
    rule_version: str,
) -> dict[str, int]:
    sf = max(0, min(100, int(score_filtros)))
    sr = max(0, min(100, int(score_requisitos)))
    total = max(0, int(mandatory_total))
    missing = max(0, min(total, int(mandatory_missing)))
    coverage = 100 if total == 0 else round(((total - missing) / total) * 100)

    if rule_version == RULE_V2:
        base = round(sf * PESO_FILTROS_V2 + sr * PESO_REQUISITOS_V2)
        hard_penalty = min(PENALTY_MAX_V2, missing * PENALTY_PER_MISSING_MANDATORY_V2)
        score = max(0, min(100, base - hard_penalty))

        # Gates rígidos para tornar score alto difícil quando há lacunas técnicas.
        if missing > 0:
            score = min(score, MANDATORY_CAP_IF_MISSING_V2)
        if coverage < 70:
            score = min(score, MANDATORY_CAP_IF_COVERAGE_LT_70_V2)
        if coverage < 50:
            score = min(score, MANDATORY_CAP_IF_COVERAGE_LT_50_V2)

        # 100 só em aderência quase perfeita.
        if not (missing == 0 and sf >= 95 and sr >= 95):
            score = min(score, 99)
    else:
        base = round(sf * PESO_FILTROS_V1 + sr * PESO_REQUISITOS_V1)
        hard_penalty = 0
        score = max(0, min(100, base))

    return {
        "score_final": score,
        "mandatory_total": total,
        "missing_mandatory_count": missing,
        "mandatory_coverage": coverage,
        "hard_penalty": hard_penalty,
    }


def _build_vaga_context(
    vaga: dict[str, Any],
    filtros_text: str,
    keywords_text: str,
    requisitos_text: str,
) -> str:
    """Monta contexto completo da vaga para o prompt LLM."""
    titulo = vaga.get("Titulo") or "Sem título"
    modalidade = vaga.get("Modalidade")
    senioridade = vaga.get("Senioridade")
    cidade = vaga.get("Cidade") or ""
    uf = vaga.get("Uf") or ""
    exp_min = vaga.get("ExperienciaMinimaAnos")

    context = f"""VAGA: {titulo}

FILTROS DEMOGRÁFICOS/LOGÍSTICOS (peso 80%):
{filtros_text}

PALAVRAS-CHAVE DA VAGA:
{keywords_text}

REQUISITOS TÉCNICOS (peso 20%):
{requisitos_text}"""

    return context


def _evaluate_with_llm(
    llm: ChatOpenAI,
    vaga_context: str,
    profile_text: str,
) -> dict[str, Any] | None:
    """
    Avalia candidato contra vaga usando LLM.
    Retorna dict com score_filtros, score_requisitos, justificativa.
    """
    prompt = f"""Você é um sistema de matching candidato-vaga do RenderRH.
Avalie este candidato/profissional para a vaga descrita.

{vaga_context}

PERFIL DO CANDIDATO:
{profile_text}

INSTRUÇÕES DE AVALIAÇÃO:

1. FILTROS (score_filtros 0-100):
   Avalie CADA filtro demográfico/logístico:
   - 100 = match perfeito (ex: mora na mesma cidade, mesma senioridade)
   - 70 = match razoável (ex: cidade próxima, senioridade adjacente)
   - 40 = match difícil (ex: cidade distante para presencial)
   - 0 = inviável (ex: candidato presencial em estado diferente, senioridade muito distante)
   Calcule a MÉDIA dos scores de todos os filtros.

   Considere:
   - Modalidade Remoto = localização não importa
   - Senioridade adjacente (Júnior→Pleno, Pleno→Sênior) = aceitável com desconto
   - ±1 ano de experiência é tolerável

2. REQUISITOS (score_requisitos 0-100):
   Avalie os requisitos técnicos:
   - OBRIGATÓRIOS valem 70% do score de requisitos
   - Desejáveis valem 30%
   - Sinônimos contam como match parcial (metade dos pontos)
   - Skills extras do candidato NÃO penalizam
   - Se não informar, considere NÃO atende

3. Se as informações do candidato/profissional forem insuficientes para avaliar um critério, dê score baixo (20-30) para esse critério, não zero.

Responda APENAS com um JSON válido (sem markdown, sem comentários):
{{"score_filtros": <0-100>, "score_requisitos": <0-100>, "justificativa": "<1-2 frases explicando gaps principais>"}}"""

    try:
        msg = llm.invoke([HumanMessage(content=prompt)])
        response_text = msg.content if hasattr(msg, "content") else str(msg)

        # Limpar resposta (remover markdown se houver)
        text = response_text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text
        if text.endswith("```"):
            text = text.rsplit("```", 1)[0]
        text = text.strip()

        result = json.loads(text)

        score_f = max(0, min(100, int(result.get("score_filtros", 0))))
        score_r = max(0, min(100, int(result.get("score_requisitos", 0))))
        justif = str(result.get("justificativa", ""))

        return {
            "score_filtros": score_f,
            "score_requisitos": score_r,
            "justificativa": justif,
        }
    except Exception as e:
        log.error("llm_eval_failed", extra={"ctx": {"error": str(e)}})
        return None
