"""
Motor de Matching v2 com Gemini Embedding 2.
Coexiste com unified_matching.py (OpenAI) — não o altera.

Pipeline:
1. Vaga aprovada → gera embedding Gemini
2. Busca vetorial UNION (Candidatos + Talentos) → top N por pontos (0-100)
3. LLM (GPT-4o-mini) avalia os top 20 → score_final real (0-100 pontos)
4. Ranking final ordenado por score_final DESC

Entrada incremental:
- Novo candidato/talento → gera embedding Gemini → compara com vaga
- Se score > menor do ranking → entra no top 20 (último sai)
"""
import json
import os
import time
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Optional

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

from app.config import OPENAI_API_KEY, OPENAI_CHAT_MODEL
from app.gemini_config import (
    GEMINI_API_KEY,
    GEMINI_RANKING_SIZE,
    GEMINI_MAX_LLM_WORKERS,
    GEMINI_VECTOR_MULTIPLIER,
    GEMINI_ENABLED,
)
from app.db import (
    get_vaga_perfil,
    get_candidato_perfil,
    get_talento_perfil,
)
from app.gemini_embeddings import (
    generate_vaga_embedding_v2,
    generate_candidato_embedding_v2,
    generate_talento_embedding_v2,
)
from app.gemini_vector_search import (
    save_gemini_embedding,
    get_gemini_embedding,
    search_top_matches,
    get_gemini_similarity,
    get_talentos_sem_gemini_embedding,
)
from app.embeddings import (
    _build_candidato_text_for_embedding,
    _build_talento_text_for_embedding,
)
from app.filtros import parse_matching_filtros_raw, criteria_to_prompt_text
from app.unified_matching import _extract_weights, _build_requisitos_text, DEFAULT_WEIGHTS
from app.log import gemini as log


# ─── Pipeline Principal ────────────────────────────────────────────────────

def run_gemini_matching(
    vaga_id: str,
    tenant_id: str | None = None,
    top_n: int | None = None,
) -> list[dict[str, Any]]:
    """
    Executa matching completo via Gemini Embedding 2:
    1. Garante embedding Gemini da vaga
    2. Busca vetorial → top N por pontos de embedding (0-100)
    3. LLM avalia cada top N → score_final real (0-100 pontos)
    4. Retorna ranking ordenado por score_final DESC

    Returns:
        Lista de dicts com person_id, nome, email, source, score_embedding,
        score_filtros, score_requisitos, score_final, justificativa
    """
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY não configurada")
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY não configurada (necessária para LLM)")

    ranking_size = top_n or GEMINI_RANKING_SIZE
    ranking_size = max(5, min(100, ranking_size))

    # 1. Buscar dados da vaga
    vaga = get_vaga_perfil(vaga_id, tenant_id)
    if not vaga:
        raise ValueError(f"Vaga {vaga_id} não encontrada")

    # 2. Garantir embedding Gemini da vaga
    _ensure_vaga_gemini_embedding(vaga_id, vaga, tenant_id)

    # 3. Busca vetorial → top N (com multiplicador para recall)
    vector_limit = min(300, ranking_size * GEMINI_VECTOR_MULTIPLIER)
    vector_results = search_top_matches(
        vaga_id, tenant_id, limit=vector_limit, min_score=0
    )

    if not vector_results:
        return []

    # 4. LLM avalia cada pessoa do top vetorial
    weights = _extract_weights(vaga)
    vaga_context = _build_vaga_context_v2(vaga, weights)
    ranked = []
    t0 = time.time()

    def _evaluate_one(person: dict) -> dict | None:
        """Avalia uma pessoa com LLM (thread paralela)."""
        person_id = person["person_id"]
        source = person["source"]

        profile_text = _get_person_profile_text_v2(person_id, source, tenant_id)
        if not profile_text:
            return None

        thread_llm = ChatOpenAI(
            model=OPENAI_CHAT_MODEL,
            openai_api_key=OPENAI_API_KEY,
            temperature=0,
        )

        scores = _evaluate_with_llm_v2(thread_llm, vaga_context, profile_text)
        if scores is None:
            return None

        # Score final = média ponderada pelos pesos configurados na vaga
        wc = weights.get("competencia", 40)
        we = weights.get("experiencia", 30)
        wf = weights.get("formacao", 15)
        wl = weights.get("localidade", 15)
        total_w = wc + we + wf + wl or 100
        score_final = round(
            (scores["score_competencia"] * wc + scores["score_experiencia"] * we +
             scores["score_formacao"] * wf + scores["score_localidade"] * wl) / total_w
        )
        score_final = max(0, min(100, score_final))

        # Compat sintéticos
        score_filtros = round((scores["score_localidade"] * wl + scores["score_experiencia"] * we) / max(1, wl + we)) if (wl + we) > 0 else 0
        score_requisitos = round((scores["score_competencia"] * wc + scores["score_formacao"] * wf) / max(1, wc + wf)) if (wc + wf) > 0 else 0

        return {
            "person_id": person_id,
            "nome": person["nome"],
            "email": person["email"],
            "source": source,
            "score_embedding": person["score"],
            "score_competencia": scores["score_competencia"],
            "score_experiencia": scores["score_experiencia"],
            "score_formacao": scores["score_formacao"],
            "score_localidade": scores["score_localidade"],
            "score_filtros": score_filtros,
            "score_requisitos": score_requisitos,
            "score_final": score_final,
            "justificativa": scores.get("justificativa", ""),
        }

    # Paralelizar avaliação LLM
    max_workers = min(GEMINI_MAX_LLM_WORKERS, len(vector_results))
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_evaluate_one, p): p for p in vector_results}
        for future in as_completed(futures):
            try:
                result = future.result()
                if result:
                    ranked.append(result)
            except Exception as e:
                person = futures[future]
                log.error("eval_person_failed", extra={"ctx": {
                    "person_id": person.get("person_id", "?"),
                    "source": person.get("source"),
                    "error": str(e),
                }})

    elapsed = time.time() - t0
    log.info("gemini_matching_done", extra={"ctx": {
        "tenant_id": tenant_id or "-",
        "vaga_id": vaga_id,
        "ranking_size": ranking_size,
        "vector_limit": vector_limit,
        "workers": max_workers,
        "avaliados": len(ranked),
        "total_candidatos": len(vector_results),
        "elapsed_s": round(elapsed, 1),
    }})

    # Ordenar por score_final DESC e limitar ao ranking_size
    ranked.sort(key=lambda x: x["score_final"], reverse=True)
    return ranked[:ranking_size]


# ─── Entrada Incremental ──────────────────────────────────────────────────

def evaluate_new_person(
    vaga_id: str,
    person_id: str,
    source: str,
    tenant_id: str | None = None,
    pdf_bytes: bytes | None = None,
) -> dict[str, Any] | None:
    """
    Avalia um novo candidato/talento contra uma vaga.
    Gera embedding Gemini se necessário e avalia com LLM.

    Returns:
        Dict com scores ou None se não for possível avaliar
    """
    if not GEMINI_API_KEY or not OPENAI_API_KEY:
        raise ValueError("GEMINI_API_KEY e OPENAI_API_KEY necessárias")

    # 1. Garantir embedding da pessoa
    _ensure_person_gemini_embedding(person_id, source, tenant_id, pdf_bytes)

    # 2. Calcular similaridade com a vaga
    similarity = get_gemini_similarity(vaga_id, person_id, source, tenant_id)
    if similarity is None:
        return None

    # 3. Avaliar com LLM
    vaga = get_vaga_perfil(vaga_id, tenant_id)
    if not vaga:
        return None

    profile_text = _get_person_profile_text_v2(person_id, source, tenant_id)
    if not profile_text:
        return None

    weights = _extract_weights(vaga)

    llm = ChatOpenAI(
        model=OPENAI_CHAT_MODEL,
        openai_api_key=OPENAI_API_KEY,
        temperature=0,
    )
    vaga_context = _build_vaga_context_v2(vaga, weights)
    scores = _evaluate_with_llm_v2(llm, vaga_context, profile_text)
    if scores is None:
        return None

    wc = weights.get("competencia", 40)
    we = weights.get("experiencia", 30)
    wf = weights.get("formacao", 15)
    wl = weights.get("localidade", 15)
    total_w = wc + we + wf + wl or 100
    score_final = round(
        (scores["score_competencia"] * wc + scores["score_experiencia"] * we +
         scores["score_formacao"] * wf + scores["score_localidade"] * wl) / total_w
    )
    score_final = max(0, min(100, score_final))

    score_filtros = round((scores["score_localidade"] * wl + scores["score_experiencia"] * we) / max(1, wl + we)) if (wl + we) > 0 else 0
    score_requisitos = round((scores["score_competencia"] * wc + scores["score_formacao"] * wf) / max(1, wc + wf)) if (wc + wf) > 0 else 0

    return {
        "person_id": person_id,
        "source": source,
        "score_embedding": similarity,
        "score_competencia": scores["score_competencia"],
        "score_experiencia": scores["score_experiencia"],
        "score_formacao": scores["score_formacao"],
        "score_localidade": scores["score_localidade"],
        "score_filtros": score_filtros,
        "score_requisitos": score_requisitos,
        "score_final": score_final,
        "justificativa": scores.get("justificativa", ""),
    }


# ─── Auto-trigger (vaga aprovada) ─────────────────────────────────────────

def trigger_matching_on_vaga_approved(
    vaga_id: str,
    tenant_id: str | None = None,
    batch_size: int = 150,
) -> dict[str, Any]:
    """
    Chamado quando uma vaga é aprovada/lançada.
    1. Gera embedding Gemini da vaga
    2. Gera embeddings em batch para talentos sem embedding
    3. Roda matching completo → retorna ranking top 20

    Executa de forma síncrona (pode levar alguns minutos).
    É esperado que seja chamado em background task.
    """
    if not GEMINI_API_KEY:
        return {"status": "error", "message": "GEMINI_API_KEY não configurada"}

    t0 = time.time()

    # 1. Embedding da vaga
    vaga = get_vaga_perfil(vaga_id, tenant_id)
    if not vaga:
        return {"status": "error", "message": f"Vaga {vaga_id} não encontrada"}

    try:
        _ensure_vaga_gemini_embedding(vaga_id, vaga, tenant_id)
    except Exception as e:
        return {"status": "error", "message": f"Erro ao gerar embedding da vaga: {e}"}

    # 2. Batch de talentos sem embedding
    talentos_processed = 0
    try:
        ids = get_talentos_sem_gemini_embedding(tenant_id, limit=batch_size)
        for tid in ids:
            try:
                _ensure_person_gemini_embedding(tid, "talento", tenant_id)
                talentos_processed += 1
                if talentos_processed % 10 == 0:
                    log.info("gemini_batch_progress", extra={"ctx": {
                        "tenant_id": tenant_id, "processed": talentos_processed, "total": len(ids),
                    }})
            except Exception:
                continue
        log.info("gemini_batch_done", extra={"ctx": {
            "tenant_id": tenant_id, "embeddings_generated": talentos_processed,
        }})
    except Exception as e:
        log.error("gemini_batch_failed", extra={"ctx": {"tenant_id": tenant_id, "error": str(e)}})

    # 3. Rodar matching completo
    try:
        ranking = run_gemini_matching(vaga_id, tenant_id, top_n=GEMINI_RANKING_SIZE)
    except Exception as e:
        ranking = []
        log.error("gemini_trigger_matching_failed", extra={"ctx": {"vaga_id": vaga_id, "error": str(e)}})

    elapsed = time.time() - t0
    return {
        "status": "ok",
        "vaga_id": vaga_id,
        "talentos_embeddings_generated": talentos_processed,
        "ranking_size": len(ranking),
        "ranking": ranking,
        "elapsed_seconds": round(elapsed, 1),
    }


# ─── Funções Auxiliares ────────────────────────────────────────────────────

def _ensure_vaga_gemini_embedding(
    vaga_id: str,
    vaga: dict[str, Any],
    tenant_id: str | None = None,
) -> None:
    """Gera e salva embedding Gemini da vaga se não existir."""
    existing = get_gemini_embedding("vaga", vaga_id, tenant_id)
    if existing is not None:
        return
    emb = generate_vaga_embedding_v2(vaga)
    save_gemini_embedding("vaga", vaga_id, emb, tenant_id)


def _ensure_person_gemini_embedding(
    person_id: str,
    source: str,
    tenant_id: str | None = None,
    pdf_bytes: bytes | None = None,
) -> bool:
    """
    Gera e salva embedding Gemini de uma pessoa (candidato ou talento).
    Se pdf_bytes for fornecido, usa embedding multimodal (texto + PDF).
    Retorna True se gerado com sucesso.
    """
    existing = get_gemini_embedding(source, person_id, tenant_id)
    if existing is not None:
        return True

    try:
        if source == "candidato":
            perfil = get_candidato_perfil(person_id, tenant_id)
            if not perfil:
                return False
            emb = generate_candidato_embedding_v2(perfil, pdf_bytes)
            return save_gemini_embedding("candidato", person_id, emb, tenant_id)
        elif source == "talento":
            perfil = get_talento_perfil(person_id, tenant_id)
            if not perfil:
                return False
            emb = generate_talento_embedding_v2(perfil, pdf_bytes)
            return save_gemini_embedding("talento", person_id, emb, tenant_id)
        return False
    except Exception as e:
        log.error("gemini_embedding_gen_failed", extra={"ctx": {
            "source": source, "person_id": person_id, "error": str(e),
        }})
        return False


def _get_person_profile_text_v2(
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


def _build_vaga_context_v2(vaga: dict[str, Any], weights: dict[str, int] | None = None) -> str:
    """Monta contexto completo da vaga para o prompt LLM, organizado por 4 dimensões."""
    titulo = vaga.get("Titulo") or "Sem título"
    w = weights or _extract_weights(vaga)
    wc, we, wf, wl = w["competencia"], w["experiencia"], w["formacao"], w["localidade"]

    # Requisitos
    requisitos = vaga.get("requisitos") or []
    requisitos_text = _build_requisitos_text(requisitos)

    # Keywords
    keywords_raw = (vaga.get("TagsKeywordsRaw") or "").strip()
    keywords_text = keywords_raw.replace(";", ", ") if keywords_raw else ""

    # Filtros parsed para dimensões
    filtros_raw = (vaga.get("MatchingFiltrosRaw") or "").strip()
    _criteria = parse_matching_filtros_raw(filtros_raw) if filtros_raw else []
    parsed: dict[str, str] = {}
    for c in _criteria:
        key = (c.get("label") or "").strip().lower().replace("ç", "c").replace("õ", "o")
        val = (c.get("valor") or "").strip()
        if key and val:
            parsed[key] = val

    # Competência
    comp_lines = []
    if requisitos_text and requisitos_text != "Nenhum requisito técnico definido":
        comp_lines.append(requisitos_text)
    if keywords_text:
        comp_lines.append(f"Palavras-chave: {keywords_text}")
    if parsed.get("habilidades"):
        comp_lines.append(f"Habilidades desejadas: {parsed['habilidades']}")
    comp_section = "\n".join(comp_lines) if comp_lines else "Nenhum requisito definido"

    # Experiência
    exp_lines = []
    senioridade = vaga.get("Senioridade") or ""
    exp_min = vaga.get("ExperienciaMinimaAnos")
    if senioridade:
        exp_lines.append(f"- Senioridade esperada: {senioridade}")
    if exp_min:
        exp_lines.append(f"- Experiência mínima: {exp_min} anos")
    if parsed.get("tempoexperiencia"):
        exp_lines.append(f"- Tempo de experiência: {parsed['tempoexperiencia']}")
    exp_section = "\n".join(exp_lines) if exp_lines else "Nenhum critério de experiência"

    # Formação
    form_lines = []
    escolaridade = vaga.get("Escolaridade") or ""
    formacao_area = vaga.get("FormacaoArea") or ""
    if escolaridade:
        form_lines.append(f"- Escolaridade mínima: {escolaridade}")
    if formacao_area:
        form_lines.append(f"- Área de formação: {formacao_area}")
    form_section = "\n".join(form_lines) if form_lines else "Nenhum critério de formação"

    # Localidade
    loc_lines = []
    modalidade = vaga.get("Modalidade") or ""
    cidade = vaga.get("Cidade") or ""
    uf_val = vaga.get("Uf") or ""
    if modalidade:
        loc_lines.append(f"- Modalidade: {modalidade}")
    if cidade or uf_val:
        loc_lines.append(f"- Cidade/UF: {cidade}/{uf_val}" if cidade else f"- UF: {uf_val}")
    if parsed.get("sexo"):
        loc_lines.append(f"- Sexo: {parsed['sexo']}")
    if parsed.get("pcd"):
        loc_lines.append(f"- PCD: {parsed['pcd']}")
    loc_section = "\n".join(loc_lines) if loc_lines else "Nenhum critério de localidade"

    return f"""VAGA: {titulo}

COMPETÊNCIA TÉCNICA (peso {wc}%):
{comp_section}

EXPERIÊNCIA PROFISSIONAL (peso {we}%):
{exp_section}

FORMAÇÃO ACADÊMICA (peso {wf}%):
{form_section}

LOCALIDADE E LOGÍSTICA (peso {wl}%):
{loc_section}"""


def _evaluate_with_llm_v2(
    llm: ChatOpenAI,
    vaga_context: str,
    profile_text: str,
) -> dict[str, Any] | None:
    """
    Avalia candidato contra vaga usando LLM em 4 dimensões.
    Retorna dict com score_competencia, score_experiencia, score_formacao, score_localidade, justificativa.
    """
    prompt = f"""Você é o sistema de matching do RenderRH (v2 — Gemini).
Avalie este candidato/profissional para a vaga descrita em 4 dimensões.

{vaga_context}

PERFIL DO CANDIDATO:
{profile_text}

INSTRUÇÕES DE AVALIAÇÃO (cada dimensão de 0 a 100 pontos):

1. COMPETÊNCIA TÉCNICA (score_competencia 0-100):
   Avalie requisitos técnicos, skills, habilidades:
   - OBRIGATÓRIOS valem 70% do score
   - Desejáveis valem 30%
   - Sinônimos = match parcial (metade dos pontos)
   - Skills extras NÃO penalizam

2. EXPERIÊNCIA PROFISSIONAL (score_experiencia 0-100):
   Avalie senioridade, anos de experiência, relevância do background:
   - Senioridade adjacente (Júnior→Pleno) = aceitável com desconto
   - ±1 ano de experiência é tolerável

3. FORMAÇÃO ACADÊMICA (score_formacao 0-100):
   Avalie escolaridade, área de formação, certificações.
   Se a vaga não define critérios de formação, dê 80.

4. LOCALIDADE E LOGÍSTICA (score_localidade 0-100):
   Avalie modalidade, localização, PCD, CNH.
   Modalidade Remoto = localização irrelevante → 100.

REGRAS GERAIS:
- Se informações insuficientes, dê 20-30 (não zero)
- Se a vaga não define critérios para uma dimensão, dê 80

Responda APENAS com JSON válido (sem markdown, sem comentários):
{{"score_competencia": <0-100>, "score_experiencia": <0-100>, "score_formacao": <0-100>, "score_localidade": <0-100>, "justificativa": "<1-2 frases>"}}"""

    try:
        msg = llm.invoke([HumanMessage(content=prompt)])
        response_text = msg.content if hasattr(msg, "content") else str(msg)

        text = response_text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text
        if text.endswith("```"):
            text = text.rsplit("```", 1)[0]
        text = text.strip()

        result = json.loads(text)
        return {
            "score_competencia": max(0, min(100, int(result.get("score_competencia", 0)))),
            "score_experiencia": max(0, min(100, int(result.get("score_experiencia", 0)))),
            "score_formacao": max(0, min(100, int(result.get("score_formacao", 0)))),
            "score_localidade": max(0, min(100, int(result.get("score_localidade", 0)))),
            "justificativa": str(result.get("justificativa", "")),
        }
    except Exception as e:
        log.error("gemini_llm_eval_failed", extra={"ctx": {"error": str(e)}})
        return None
