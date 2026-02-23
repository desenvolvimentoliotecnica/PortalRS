"""
Motor de Matching Unificado: Vetorização (pgvector) + LLM (GPT-4o-mini).

Pipeline:
1. Pré-filtro vetorial → top N (Candidatos UNION Talentos)
2. LLM avalia cada top N:
   - score_filtros (0-100) × 0.80
   - score_requisitos (0-100) × 0.20
3. Persiste ranking em CandidatoVagaMatchingScore
"""
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Optional

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

from app.config import OPENAI_API_KEY, OPENAI_CHAT_MODEL, DEFAULT_RANKING_SIZE
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

# ─── Pesos fixos ────────────────────────────────────────────────────────────

PESO_FILTROS = 0.80
PESO_REQUISITOS = 0.20


# ─── Pipeline Principal ────────────────────────────────────────────────────

def run_unified_matching(
    vaga_id: str,
    tenant_id: str | None = None,
    top_n: int | None = None,
) -> list[dict[str, Any]]:
    """
    Executa matching completo para uma vaga:
    1. Garante que a vaga tem embedding
    2. Busca vetorial UNION (Candidatos + Talentos) → top N
    3. LLM avalia cada top N → score final 80/20
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

    # 1. Buscar dados completos da vaga
    vaga = get_vaga_perfil(vaga_id, tenant_id)
    if not vaga:
        raise ValueError(f"Vaga {vaga_id} não encontrada")

    # 2. Garantir embedding da vaga (no banco do tenant)
    _ensure_vaga_embedding(vaga_id, vaga, tenant_id)

    # 3. Pré-filtro vetorial → top N
    # Buscamos 2x o ranking para ter margem (o LLM pode descartar alguns)
    vector_limit = ranking_size * 2
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

        score_final = round(
            scores["score_filtros"] * PESO_FILTROS
            + scores["score_requisitos"] * PESO_REQUISITOS
        )
        score_final = max(0, min(100, score_final))

        return {
            "person_id": person_id,
            "nome": person["nome"],
            "email": person["email"],
            "source": source,
            "similaridade_vetorial": person["similaridade"],
            "score_filtros": scores["score_filtros"],
            "score_requisitos": scores["score_requisitos"],
            "score_final": score_final,
            "justificativa": scores.get("justificativa", ""),
        }

    # Paralelizar avaliação LLM com até 5 workers
    max_workers = min(5, len(vector_results))
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_evaluate_one_person, p): p for p in vector_results}
        for future in as_completed(futures):
            try:
                result = future.result()
                if result:
                    ranked.append(result)
            except Exception as e:
                person = futures[future]
                print(f"Erro ao avaliar {person.get('person_id', '?')}: {e}")

    elapsed = time.time() - t0
    print(f"[matching] LLM avaliou {len(ranked)}/{len(vector_results)} pessoas em {elapsed:.1f}s ({max_workers} workers)")

    # Ordenar por score final e limitar ao ranking_size
    ranked.sort(key=lambda x: x["score_final"], reverse=True)
    return ranked[:ranking_size]


# ─── Avaliação Individual (novo candidato/talento) ─────────────────────────

def evaluate_single_person(
    vaga_id: str,
    person_id: str,
    source: str,
    tenant_id: str | None = None,
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

    score_final = round(
        scores["score_filtros"] * PESO_FILTROS
        + scores["score_requisitos"] * PESO_REQUISITOS
    )
    score_final = max(0, min(100, score_final))

    return {
        "person_id": person_id,
        "source": source,
        "score_filtros": scores["score_filtros"],
        "score_requisitos": scores["score_requisitos"],
        "score_final": score_final,
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
        print(f"Erro ao gerar embedding para {source} {person_id}: {e}")
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
        print(f"Erro na avaliação LLM: {e}")
        return None
