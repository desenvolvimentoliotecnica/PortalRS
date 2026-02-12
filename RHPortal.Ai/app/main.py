"""
API FastAPI para matching por IA: recebe vaga_id (e opcionalmente tenant_id),
consulta o banco, executa RAG com busca vetorial e retorna candidatos ordenados por similaridade 0-100.
"""
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from app.config import DATABASE_URL, OPENAI_API_KEY
from app.db import get_vaga_perfil, get_candidatos_perfis, get_candidato_perfil
from app.matching import run_matching
from app.embeddings import (
    generate_vaga_embedding,
    generate_candidato_embedding,
    save_vaga_embedding,
    save_candidato_embedding,
    get_vaga_embedding,
    get_candidato_embedding,
)
from app.vector_search import search_candidates_by_similarity, get_similarity_score


app = FastAPI(
    title="RHPortal.Ai",
    description="Matching de candidatos por IA: requisitos da vaga + filtros matching vs perfil do candidato (busca vetorial + LangChain)",
    version="1.0.0",
)


class MatchRequest(BaseModel):
    """Payload para solicitar matching de uma vaga."""
    vaga_id: str = Field(..., description="ID da vaga (UUID)")
    tenant_id: str | None = Field(None, description="ID do tenant (opcional)")
    limit: int | None = Field(100, ge=1, le=200, description="Máximo de candidatos no retorno")


class MatchItem(BaseModel):
    candidato_id: str
    nome: str
    email: str
    similaridade: int = Field(..., ge=0, le=100, description="Score de similaridade 0-100")


class MatchResponse(BaseModel):
    vaga_id: str
    vaga_titulo: str | None
    total_candidatos: int
    matching: list[MatchItem]


class MatchOneRequest(BaseModel):
    """Payload para score de um único candidato em uma vaga."""
    vaga_id: str = Field(..., description="ID da vaga (UUID)")
    candidato_id: str = Field(..., description="ID do candidato (UUID)")
    tenant_id: str | None = Field(None, description="ID do tenant (opcional)")


class MatchOneResponse(BaseModel):
    candidato_id: str
    nome: str
    email: str
    similaridade: int = Field(..., ge=0, le=100)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "rhportal-ai"}


@app.post("/match", response_model=MatchResponse)
def match_candidatos(req: MatchRequest) -> MatchResponse:
    """
    Executa matching por IA: lê requisitos da vaga e filtros matching no banco,
    compara com todos os candidatos via busca vetorial (embeddings + similaridade)
    e retorna a lista ordenada por similaridade (0 a 100).
    """
    if not DATABASE_URL:
        raise HTTPException(status_code=503, detail="DATABASE_URL não configurada")
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY não configurada")

    vaga = get_vaga_perfil(req.vaga_id, req.tenant_id)
    if not vaga:
        raise HTTPException(status_code=404, detail="Vaga não encontrada")

    candidatos = get_candidatos_perfis(req.tenant_id)
    if not candidatos:
        return MatchResponse(
            vaga_id=req.vaga_id,
            vaga_titulo=vaga.get("Titulo"),
            total_candidatos=0,
            matching=[],
        )

    limit = req.limit if req.limit else 200
    try:
        items = run_matching(vaga, candidatos, algorithm="filters", limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no matching por IA: {e!s}")

    items = items[:limit]

    return MatchResponse(
        vaga_id=req.vaga_id,
        vaga_titulo=vaga.get("Titulo"),
        total_candidatos=len(items),
        matching=[MatchItem(**x) for x in items],
    )


@app.post("/match-one", response_model=MatchOneResponse)
def match_one_candidato(req: MatchOneRequest) -> MatchOneResponse:
    """
    Calcula o score de matching por IA para um único (candidato, vaga).
    Usado quando o candidato se candidata ou é atribuído à vaga.
    """
    if not DATABASE_URL:
        raise HTTPException(status_code=503, detail="DATABASE_URL não configurada")
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY não configurada")

    vaga = get_vaga_perfil(req.vaga_id, req.tenant_id)
    if not vaga:
        raise HTTPException(status_code=404, detail="Vaga não encontrada")
    if not (vaga.get("MatchingFiltrosRaw") or "").strip():
        raise HTTPException(status_code=400, detail="Vaga sem filtros de matching (MatchingFiltrosRaw vazio)")

    candidato = get_candidato_perfil(req.candidato_id, req.tenant_id)
    if not candidato:
        raise HTTPException(status_code=404, detail="Candidato não encontrado")

    try:
        items = run_matching(vaga, [candidato], algorithm="filters", limit=1)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no matching por IA: {e!s}")

    if items:
        one = items[0]
        return MatchOneResponse(
            candidato_id=one["candidato_id"],
            nome=one.get("nome", ""),
            email=one.get("email", ""),
            similaridade=one.get("similaridade", 0),
        )
    # Nenhum critério atendido (score 0 é excluído em run_matching_by_filters)
    return MatchOneResponse(
        candidato_id=req.candidato_id,
        nome=candidato.get("Nome", ""),
        email=candidato.get("Email", ""),
        similaridade=0,
    )


# ===== NOVOS ENDPOINTS: Embeddings e Busca Vetorial =====


class GenerateEmbeddingResponse(BaseModel):
    """Resposta de geração de embedding."""
    success: bool
    entity_id: str
    message: str | None = None


@app.post("/embeddings/vaga/{vaga_id}", response_model=GenerateEmbeddingResponse)
def generate_vaga_embedding_endpoint(vaga_id: str, tenant_id: str | None = None):
    """
    Gera e salva embedding para uma vaga.
    Usado quando uma vaga é criada ou atualizada.
    """
    try:
        vaga = get_vaga_perfil(vaga_id, tenant_id)
        if not vaga:
            raise HTTPException(status_code=404, detail="Vaga não encontrada")
        
        embedding = generate_vaga_embedding(vaga)
        success = save_vaga_embedding(vaga_id, embedding)
        
        if not success:
            raise HTTPException(status_code=500, detail="Erro ao salvar embedding")
        
        return GenerateEmbeddingResponse(
            success=True,
            entity_id=vaga_id,
            message="Embedding gerado e salvo com sucesso"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar embedding: {str(e)}")


@app.post("/embeddings/candidato/{candidato_id}", response_model=GenerateEmbeddingResponse)
def generate_candidato_embedding_endpoint(candidato_id: str, tenant_id: str | None = None):
    """
    Gera e salva embedding para um candidato.
    Usado quando um candidato é cadastrado ou atualizado.
    """
    try:
        candidato = get_candidato_perfil(candidato_id, tenant_id)
        if not candidato:
            raise HTTPException(status_code=404, detail="Candidato não encontrado")
        
        embedding = generate_candidato_embedding(candidato)
        success = save_candidato_embedding(candidato_id, embedding)
        
        if not success:
            raise HTTPException(status_code=500, detail="Erro ao salvar embedding")
        
        return GenerateEmbeddingResponse(
            success=True,
            entity_id=candidato_id,
            message="Embedding gerado e salvo com sucesso"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar embedding: {str(e)}")


@app.post("/match-vector", response_model=MatchResponse)
def match_candidatos_vector(req: MatchRequest) -> MatchResponse:
    """
    Matching SOMENTE por busca vetorial (pgvector) - muito mais rápido que LLM.
    Usa embeddings pré-calculados para encontrar candidatos similares.
    Ideal para vagas SEM filtros específicos ou pré-filtro antes do LLM.
    """
    vaga = get_vaga_perfil(req.vaga_id, req.tenant_id)
    if not vaga:
        raise HTTPException(status_code=404, detail="Vaga não encontrada")
    
    # Verifica se a vaga tem embedding
    vaga_emb = get_vaga_embedding(req.vaga_id)
    if not vaga_emb:
        # Gera embedding agora (lazy generation)
        try:
            vaga_emb = generate_vaga_embedding(vaga)
            save_vaga_embedding(req.vaga_id, vaga_emb)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Erro ao gerar embedding da vaga: {str(e)}")
    
    # Busca vetorial
    items = search_candidates_by_similarity(
        req.vaga_id,
        req.tenant_id,
        limit=req.limit or 100,
        min_score=0
    )
    
    return MatchResponse(
        vaga_id=req.vaga_id,
        vaga_titulo=vaga.get("Titulo"),
        total_candidatos=len(items),
        matching=[MatchItem(**item) for item in items]
    )


class SimilarityRequest(BaseModel):
    """Request para calcular similaridade entre vaga e candidato."""
    vaga_id: str
    candidato_id: str
    tenant_id: str | None = None


class SimilarityResponse(BaseModel):
    """Resposta com score de similaridade vetorial."""
    vaga_id: str
    candidato_id: str
    similaridade: int | None = Field(None, description="Score 0-100 ou None se não houver embeddings")


@app.post("/similarity", response_model=SimilarityResponse)
def get_similarity_endpoint(req: SimilarityRequest) -> SimilarityResponse:
    """
    Calcula score de similaridade vetorial entre uma vaga e um candidato.
    Retorna None se não houver embeddings para um deles.
    """
    score = get_similarity_score(req.vaga_id, req.candidato_id)
    
    return SimilarityResponse(
        vaga_id=req.vaga_id,
        candidato_id=req.candidato_id,
        similaridade=score
    )


@app.post("/match-hybrid", response_model=MatchResponse)
def match_candidatos_hybrid(req: MatchRequest) -> MatchResponse:
    """
    Matching HÍBRIDO: combina busca vetorial (rápida) com LLM (preciso).
    
    Estratégia:
    1. Se vaga tem filtros (MatchingFiltrosRaw) → usa LLM (certeiro)
    2. Se vaga NÃO tem filtros → usa busca vetorial (rápido)
    3. Se tem muitos candidatos (>200) → pré-filtro vetorial + LLM top 100
    """
    vaga = get_vaga_perfil(req.vaga_id, req.tenant_id)
    if not vaga:
        raise HTTPException(status_code=404, detail="Vaga não encontrada")
    
    has_filters = bool(vaga.get("MatchingFiltrosRaw"))
    
    if not has_filters:
        # Sem filtros: usa busca vetorial pura (mais rápido)
        return match_candidatos_vector(req)
    
    # Com filtros: usa LLM (mais certeiro)
    # TODO: implementar pré-filtro vetorial para otimizar
    candidatos = get_candidatos_perfis(req.tenant_id)
    items = run_matching(vaga, candidatos, req.limit or 100)
    
    return MatchResponse(
        vaga_id=req.vaga_id,
        vaga_titulo=vaga.get("Titulo"),
        total_candidatos=len(items),
        matching=[MatchItem(**item) for item in items]
    )



if __name__ == "__main__":
    import uvicorn
    from app.config import HOST, PORT
    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=True)
