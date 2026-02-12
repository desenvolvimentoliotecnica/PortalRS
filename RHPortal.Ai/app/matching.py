"""
Matching por IA: (1) por filtros da vaga - LLM avalia cada critério, score 0-100 proporcional;
(2) opcional: busca vetorial (algorithm=vector) para testes.
"""
from typing import Any

from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document
from langchain_core.messages import HumanMessage

from app.config import OPENAI_API_KEY, EMBEDDING_MODEL, OPENAI_CHAT_MODEL, MATCH_TOP_K
from app.filtros import parse_matching_filtros_raw, criteria_to_prompt_text


def _build_vaga_text(vaga: dict[str, Any]) -> str:
    """Monta texto único da vaga: título + filtros matching + requisitos."""
    parts = []
    if vaga.get("Titulo"):
        parts.append(f"Vaga: {vaga['Titulo']}")
    if vaga.get("MatchingFiltrosRaw"):
        parts.append(f"Critérios e filtros: {vaga['MatchingFiltrosRaw']}")
    reqs = vaga.get("requisitos") or []
    if reqs:
        req_texts = []
        for r in reqs:
            nome = (r.get("Nome") or "").strip()
            syn = (r.get("SinonimosRaw") or "").strip()
            if nome:
                req_texts.append(nome if not syn else f"{nome} ({syn})")
        if req_texts:
            parts.append("Requisitos: " + "; ".join(req_texts))
    return "\n".join(parts) if parts else ""


def _build_candidato_text(c: dict[str, Any]) -> str:
    """Monta texto único do candidato (perfil para LLM ou embedding)."""
    parts = []
    if c.get("Nome"):
        parts.append(f"Candidato: {c['Nome']}")
    if c.get("resumo_profissional"):
        parts.append(c["resumo_profissional"])
    if c.get("cv_text"):
        parts.append(c["cv_text"])
    if c.get("competencias"):
        parts.append(f"Habilidades: {c['competencias']}")
    if c.get("cidade") or c.get("uf"):
        parts.append(f"Local: {c.get('cidade') or ''} {c.get('uf') or ''}".strip())
    return "\n".join(parts) if parts else c.get("Nome") or "Sem perfil"


def _parse_llm_sim_nao(response: str, total_criteria: int) -> int:
    """
    Extrai da resposta do LLM a quantidade de critérios atendidos (SIM).
    Esperado: linha com SIM e NÃO separados por vírgula, na ordem dos critérios.
    """
    if not response or total_criteria <= 0:
        return 0
    text = response.strip().upper()
    # Pegar primeira linha se houver várias
    if "\n" in text:
        text = text.split("\n")[0]
    # Trocar ; por , e split
    parts = [p.strip() for p in text.replace(";", ",").split(",")]
    count = 0
    for p in parts:
        if p == "SIM" or p == "S":
            count += 1
        elif p in ("NAO", "NÃO", "N"):
            pass
        else:
            # Tentar interpretar como sim (1, true, yes)
            if p in ("1", "TRUE", "YES", "Y"):
                count += 1
    return min(count, total_criteria)


def run_matching_by_filters(
    vaga: dict[str, Any],
    candidatos: list[dict[str, Any]],
    limit: int = 200,
) -> list[dict[str, Any]]:
    """
    Ranking por filtros da vaga: parse de MatchingFiltrosRaw, para cada candidato
    o LLM avalia atendimento a cada critério; score = (atendidos/total)*100.
    Candidatos com score 0 são excluídos. Ordenado por score decrescente.
    """
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY não configurada")
    if not candidatos:
        return []

    raw = (vaga.get("MatchingFiltrosRaw") or "").strip()
    criteria = parse_matching_filtros_raw(raw)
    total_criteria = len(criteria)
    if total_criteria == 0:
        return []

    criteria_block = criteria_to_prompt_text(criteria)
    llm = ChatOpenAI(
        model=OPENAI_CHAT_MODEL,
        openai_api_key=OPENAI_API_KEY,
        temperature=0,
    )

    results: list[dict[str, Any]] = []
    for c in candidatos:
        profile = _build_candidato_text(c)
        prompt = f"""Você é um avaliador de candidatos. A vaga exige os seguintes critérios (cada linha é um critério):

{criteria_block}

Perfil do candidato:
{profile}

Regras: para cada critério na ordem acima, avalie se o candidato ATENDE (SIM) ou NÃO ATENDE (NÃO).
- Experiência mínima: se a vaga exige "5 ou mais anos" e o candidato tem menos, responda NÃO.
- Local (Cidade/UF): confira se o perfil indica a localização compatível.
- Habilidades: o candidato deve ter as habilidades mencionadas no critério (ou equivalentes).
- Se a informação não estiver no perfil, responda NÃO para esse critério.

Responda APENAS com uma única linha: valores SIM ou NÃO separados por vírgula, na mesma ordem dos critérios. Exemplo: SIM, NÃO, SIM, SIM, NÃO"""

        try:
            msg = llm.invoke([HumanMessage(content=prompt)])
            response_text = msg.content if hasattr(msg, "content") else str(msg)
            atendidos = _parse_llm_sim_nao(response_text, total_criteria)
            score = round((atendidos / total_criteria) * 100) if total_criteria else 0
            score = min(100, max(0, score))
        except Exception:
            score = 0

        if score == 0:
            continue
        results.append({
            "candidato_id": str(c["id"]),
            "nome": (c.get("Nome") or "").strip(),
            "email": (c.get("Email") or "").strip(),
            "similaridade": score,
        })

    results.sort(key=lambda x: x["similaridade"], reverse=True)
    return results[:limit]


def run_matching_vector(vaga: dict[str, Any], candidatos: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Busca vetorial por similaridade (comportamento legado). Retorna ranking 0-100.
    """
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY não configurada")
    if not candidatos:
        return []

    vaga_text = _build_vaga_text(vaga)
    if not vaga_text.strip():
        vaga_text = vaga.get("Titulo") or "Vaga"

    embeddings = OpenAIEmbeddings(
        model=EMBEDDING_MODEL,
        openai_api_key=OPENAI_API_KEY,
    )
    docs = []
    for c in candidatos:
        content = _build_candidato_text(c)
        doc = Document(
            page_content=content,
            metadata={
                "candidato_id": str(c["id"]),
                "nome": (c.get("Nome") or "").strip(),
                "email": (c.get("Email") or "").strip(),
            },
        )
        docs.append(doc)
    vectorstore = Chroma.from_documents(
        documents=docs,
        embedding=embeddings,
        collection_name="candidatos_matching",
        persist_directory=None,
    )
    top_k = min(MATCH_TOP_K, len(candidatos))
    results = vectorstore.similarity_search_with_score(vaga_text, k=top_k)
    out = []
    for doc, distance in results:
        raw_score = max(0.0, 100.0 - (float(distance) * 35.0))
        score = round(min(100, max(0, raw_score)))
        out.append({
            "candidato_id": doc.metadata.get("candidato_id"),
            "nome": doc.metadata.get("nome", ""),
            "email": doc.metadata.get("email", ""),
            "similaridade": score,
        })
    return out


def run_matching(
    vaga: dict[str, Any],
    candidatos: list[dict[str, Any]],
    algorithm: str = "filters",
    limit: int = 200,
) -> list[dict[str, Any]]:
    """
    Ponto de entrada único. algorithm="filters" (padrão): score por critérios da vaga;
    algorithm="vector": similaridade vetorial. Exclui score 0 quando algorithm=filters.
    """
    if algorithm == "vector":
        return run_matching_vector(vaga, candidatos)
    return run_matching_by_filters(vaga, candidatos, limit=limit)
