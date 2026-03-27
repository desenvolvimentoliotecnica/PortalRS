"""
Motor de Matching Unificado: Vetorização (pgvector) + LLM (GPT-4o-mini).

Pipeline:
1. Pré-filtro vetorial → top N (Candidatos UNION Talentos)
2. LLM avalia cada top N em 4 dimensões ponderáveis:
   score_competencia, score_experiencia, score_formacao, score_localidade
3. Score final = média ponderada pelos pesos configurados na vaga (default 40/30/15/15)
4. V2 aplica gates rígidos para requisitos obrigatórios faltando
5. Retorna ranking ordenado (candidatos + talentos)
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

DEFAULT_WEIGHTS = {"competencia": 40, "experiencia": 30, "formacao": 15, "localidade": 15}

PENALTY_PER_MISSING_MANDATORY_V2 = 20
PENALTY_MAX_V2 = 60
MANDATORY_CAP_IF_MISSING_V2 = 89
MANDATORY_CAP_IF_COVERAGE_LT_70_V2 = 79
MANDATORY_CAP_IF_COVERAGE_LT_50_V2 = 69

MAX_LLM_WORKERS = max(1, min(12, int(os.getenv("MATCHING_MAX_LLM_WORKERS", "5"))))
VECTOR_LIMIT_MULTIPLIER = max(2, min(6, int(os.getenv("MATCHING_VECTOR_LIMIT_MULTIPLIER", "3"))))
VECTOR_LIMIT_MAX = max(30, int(os.getenv("MATCHING_VECTOR_LIMIT_MAX", "300")))


def _extract_weights(vaga: dict[str, Any]) -> dict[str, int]:
    """Extrai pesos de matching da vaga; fallback para defaults se todos forem zero."""
    wc = int(vaga.get("PesoCompetencia") or 0)
    we = int(vaga.get("PesoExperiencia") or 0)
    wf = int(vaga.get("PesoFormacao") or 0)
    wl = int(vaga.get("PesoLocalidade") or 0)
    if wc + we + wf + wl == 0:
        return dict(DEFAULT_WEIGHTS)
    return {"competencia": wc, "experiencia": we, "formacao": wf, "localidade": wl}


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

    # Extrair pesos configurados pelo RH
    weights = _extract_weights(vaga)

    # Preparar contexto da vaga para o prompt
    filtros_raw = (vaga.get("MatchingFiltrosRaw") or "").strip()
    criteria = parse_matching_filtros_raw(filtros_raw)
    filtros_text = criteria_to_prompt_text(criteria) if criteria else ""
    keywords_raw = (vaga.get("TagsKeywordsRaw") or "").strip()
    keywords_text = keywords_raw.replace(";", ", ") if keywords_raw else ""

    requisitos = vaga.get("requisitos") or []
    requisitos_text = _build_requisitos_text(requisitos)

    vaga_context = _build_vaga_context(vaga, filtros_text, keywords_text, requisitos_text, weights)

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
            scores["score_competencia"],
            scores["score_experiencia"],
            scores["score_formacao"],
            scores["score_localidade"],
            weights,
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
            "score_competencia": scores["score_competencia"],
            "score_experiencia": scores["score_experiencia"],
            "score_formacao": scores["score_formacao"],
            "score_localidade": scores["score_localidade"],
            "score_filtros": score_meta["score_filtros"],
            "score_requisitos": score_meta["score_requisitos"],
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

    weights = _extract_weights(vaga)

    filtros_raw = (vaga.get("MatchingFiltrosRaw") or "").strip()
    criteria = parse_matching_filtros_raw(filtros_raw)
    filtros_text = criteria_to_prompt_text(criteria) if criteria else ""
    keywords_raw = (vaga.get("TagsKeywordsRaw") or "").strip()
    keywords_text = keywords_raw.replace(";", ", ") if keywords_raw else ""
    requisitos = vaga.get("requisitos") or []
    requisitos_text = _build_requisitos_text(requisitos)
    vaga_context = _build_vaga_context(vaga, filtros_text, keywords_text, requisitos_text, weights)

    scores = _evaluate_with_llm(llm, vaga_context, profile_text)
    if scores is None:
        return None

    normalized_rule = _normalize_rule(rule_version)
    mandatory_total, mandatory_missing = _estimate_mandatory_coverage(
        profile_text, requisitos
    )
    score_meta = _compute_final_score(
        scores["score_competencia"],
        scores["score_experiencia"],
        scores["score_formacao"],
        scores["score_localidade"],
        weights,
        mandatory_total,
        mandatory_missing,
        normalized_rule,
    )

    return {
        "person_id": person_id,
        "source": source,
        "score_competencia": scores["score_competencia"],
        "score_experiencia": scores["score_experiencia"],
        "score_formacao": scores["score_formacao"],
        "score_localidade": scores["score_localidade"],
        "score_filtros": score_meta["score_filtros"],
        "score_requisitos": score_meta["score_requisitos"],
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
    score_competencia: int,
    score_experiencia: int,
    score_formacao: int,
    score_localidade: int,
    weights: dict[str, int],
    mandatory_total: int,
    mandatory_missing: int,
    rule_version: str,
) -> dict[str, int]:
    sc = max(0, min(100, int(score_competencia)))
    se = max(0, min(100, int(score_experiencia)))
    sf = max(0, min(100, int(score_formacao)))
    sl = max(0, min(100, int(score_localidade)))
    total = max(0, int(mandatory_total))
    missing = max(0, min(total, int(mandatory_missing)))
    coverage = 100 if total == 0 else round(((total - missing) / total) * 100)

    wc = weights.get("competencia", 40)
    we = weights.get("experiencia", 30)
    wf = weights.get("formacao", 15)
    wl = weights.get("localidade", 15)
    total_w = wc + we + wf + wl
    if total_w == 0:
        total_w = 100

    base = round((sc * wc + se * we + sf * wf + sl * wl) / total_w)

    # Scores de compat (agregados sintéticos para backward compatibility)
    score_filtros_compat = round((sl * wl + se * we) / max(1, wl + we)) if (wl + we) > 0 else 0
    score_requisitos_compat = round((sc * wc + sf * wf) / max(1, wc + wf)) if (wc + wf) > 0 else 0

    if rule_version == RULE_V2:
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
        if not (missing == 0 and sc >= 95 and se >= 95 and sf >= 95 and sl >= 95):
            score = min(score, 99)
    else:
        hard_penalty = 0
        score = max(0, min(100, base))

    return {
        "score_final": score,
        "score_filtros": score_filtros_compat,
        "score_requisitos": score_requisitos_compat,
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
    weights: dict[str, int],
) -> str:
    """Monta contexto completo da vaga para o prompt LLM, organizado por dimensão."""
    titulo = vaga.get("Titulo") or "Sem título"
    modalidade = vaga.get("Modalidade") or ""
    senioridade = vaga.get("Senioridade") or ""
    cidade = vaga.get("Cidade") or ""
    uf = vaga.get("Uf") or ""
    exp_min = vaga.get("ExperienciaMinimaAnos")
    escolaridade = vaga.get("Escolaridade") or ""
    formacao_area = vaga.get("FormacaoArea") or ""
    aceita_pcd = vaga.get("AceitaPcd")
    exige_cnh = vaga.get("ExigeCnh")

    # Extrair filtros parsed para organizar por dimensão
    filtros_raw = (vaga.get("MatchingFiltrosRaw") or "").strip()
    _criteria = parse_matching_filtros_raw(filtros_raw) if filtros_raw else []
    parsed: dict[str, str] = {}
    for c in _criteria:
        key = (c.get("label") or "").strip().lower().replace("ç", "c").replace("õ", "o")
        val = (c.get("valor") or "").strip()
        if key and val:
            parsed[key] = val

    wc = weights.get("competencia", 40)
    we = weights.get("experiencia", 30)
    wf = weights.get("formacao", 15)
    wl = weights.get("localidade", 15)

    # ── Competência técnica ──
    comp_lines = []
    if requisitos_text and requisitos_text != "Nenhum requisito técnico definido":
        comp_lines.append(requisitos_text)
    if keywords_text:
        comp_lines.append(f"Palavras-chave: {keywords_text}")
    if parsed.get("habilidades"):
        comp_lines.append(f"Habilidades desejadas: {parsed['habilidades']}")
    comp_section = "\n".join(comp_lines) if comp_lines else "Nenhum requisito definido"

    # ── Experiência ──
    exp_lines = []
    if senioridade:
        exp_lines.append(f"- Senioridade esperada: {senioridade}")
    if exp_min:
        exp_lines.append(f"- Experiência mínima: {exp_min} anos")
    if parsed.get("tempoexperiencia"):
        exp_lines.append(f"- Tempo de experiência (filtro): {parsed['tempoexperiencia']}")
    exp_section = "\n".join(exp_lines) if exp_lines else "Nenhum critério de experiência definido"

    # ── Formação ──
    form_lines = []
    if escolaridade:
        form_lines.append(f"- Escolaridade mínima: {escolaridade}")
    if formacao_area:
        form_lines.append(f"- Área de formação: {formacao_area}")
    if parsed.get("escolaridade") and parsed["escolaridade"] != escolaridade:
        form_lines.append(f"- Escolaridade (filtro): {parsed['escolaridade']}")
    if parsed.get("formacao") and parsed["formacao"] != formacao_area:
        form_lines.append(f"- Formação (filtro): {parsed['formacao']}")
    form_section = "\n".join(form_lines) if form_lines else "Nenhum critério de formação definido"

    # ── Localidade e logística ──
    loc_lines = []
    if modalidade:
        loc_lines.append(f"- Modalidade: {modalidade}")
    if cidade or uf:
        loc_lines.append(f"- Cidade/UF: {cidade}/{uf}" if cidade else f"- UF: {uf}")
    if parsed.get("modalidade") and parsed["modalidade"] != modalidade:
        loc_lines.append(f"- Modalidade (filtro): {parsed['modalidade']}")
    if parsed.get("cidade") and parsed["cidade"] != cidade:
        loc_lines.append(f"- Cidade (filtro): {parsed['cidade']}")
    if parsed.get("uf") and parsed["uf"] != uf:
        loc_lines.append(f"- UF (filtro): {parsed['uf']}")
    if parsed.get("sexo"):
        loc_lines.append(f"- Sexo: {parsed['sexo']}")
    if parsed.get("pcd"):
        loc_lines.append(f"- PCD: {parsed['pcd']}")
    if parsed.get("idademin") or parsed.get("idademax"):
        loc_lines.append(f"- Idade: {parsed.get('idademin', '—')} a {parsed.get('idademax', '—')}")
    if parsed.get("requercnh"):
        cat = parsed.get("categoriacnh") or ""
        loc_lines.append(f"- CNH: exigida{' (' + cat + ')' if cat else ''}")
    if aceita_pcd and not any("PCD" in l for l in loc_lines):
        loc_lines.append("- Aceita PCD: Sim")
    if exige_cnh and not any("CNH" in l for l in loc_lines):
        loc_lines.append("- Exige CNH: Sim")
    loc_section = "\n".join(loc_lines) if loc_lines else "Nenhum critério de localidade definido"

    context = f"""VAGA: {titulo}

COMPETÊNCIA TÉCNICA (peso {wc}%):
{comp_section}

EXPERIÊNCIA PROFISSIONAL (peso {we}%):
{exp_section}

FORMAÇÃO ACADÊMICA (peso {wf}%):
{form_section}

LOCALIDADE E LOGÍSTICA (peso {wl}%):
{loc_section}"""

    return context


def _evaluate_with_llm(
    llm: ChatOpenAI,
    vaga_context: str,
    profile_text: str,
) -> dict[str, Any] | None:
    """
    Avalia candidato contra vaga usando LLM.
    Retorna dict com score_competencia, score_experiencia, score_formacao, score_localidade, justificativa.
    """
    prompt = f"""Você é um sistema de matching candidato-vaga do RenderRH.
Avalie este candidato/profissional para a vaga descrita em 4 dimensões.

{vaga_context}

PERFIL DO CANDIDATO:
{profile_text}

INSTRUÇÕES DE AVALIAÇÃO (cada dimensão de 0 a 100):

1. COMPETÊNCIA TÉCNICA (score_competencia 0-100):
   Avalie requisitos técnicos, skills, habilidades, ferramentas, linguagens:
   - OBRIGATÓRIOS valem 70% do score desta dimensão
   - Desejáveis valem 30%
   - Sinônimos contam como match parcial (metade dos pontos)
   - Skills extras do candidato NÃO penalizam
   - Se não informar, considere NÃO atende

2. EXPERIÊNCIA PROFISSIONAL (score_experiencia 0-100):
   Avalie senioridade, anos de experiência, relevância do background:
   - 100 = match perfeito (mesma senioridade, experiência suficiente)
   - 70 = match razoável (senioridade adjacente: Júnior→Pleno, ±1 ano)
   - 40 = match difícil (senioridade distante, experiência insuficiente)
   - 0 = inviável

3. FORMAÇÃO ACADÊMICA (score_formacao 0-100):
   Avalie escolaridade, área de formação, certificações:
   - 100 = escolaridade atinge ou supera + área compatível
   - 70 = escolaridade próxima ou área adjacente
   - 40 = escolaridade abaixo mas experiência compensa parcialmente
   - Se não há critérios de formação na vaga, dê 80

4. LOCALIDADE E LOGÍSTICA (score_localidade 0-100):
   Avalie modalidade, localização, PCD, CNH, idade, sexo:
   - Modalidade Remoto = localização não importa → 100
   - Mesma cidade = 100; estado vizinho = 70; distante para presencial = 30
   - Se critérios logísticos (PCD/CNH/sexo/idade) não se aplicam, ignore-os

REGRAS GERAIS:
- Se informações insuficientes para avaliar um critério, dê 20-30 (não zero)
- Se a vaga não define critérios para uma dimensão, dê 80

Responda APENAS com um JSON válido (sem markdown, sem comentários):
{{"score_competencia": <0-100>, "score_experiencia": <0-100>, "score_formacao": <0-100>, "score_localidade": <0-100>, "justificativa": "<1-2 frases explicando gaps principais>"}}"""

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

        sc = max(0, min(100, int(result.get("score_competencia", 0))))
        se = max(0, min(100, int(result.get("score_experiencia", 0))))
        sf = max(0, min(100, int(result.get("score_formacao", 0))))
        sl = max(0, min(100, int(result.get("score_localidade", 0))))
        justif = str(result.get("justificativa", ""))

        return {
            "score_competencia": sc,
            "score_experiencia": se,
            "score_formacao": sf,
            "score_localidade": sl,
            "justificativa": justif,
        }
    except Exception as e:
        log.error("llm_eval_failed", extra={"ctx": {"error": str(e)}})
        return None
