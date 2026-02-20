"""
API FastAPI para matching por IA unificado.
Pipeline: embeddings (OpenAI) → pré-filtro vetorial (pgvector) → LLM scoring (80% filtros, 20% requisitos).
"""
from typing import Any
import time
import threading

from fastapi import BackgroundTasks, FastAPI, HTTPException
from pydantic import BaseModel, Field

from app.config import DATABASE_URL, OPENAI_API_KEY, DEFAULT_RANKING_SIZE
from app.db import (
    get_vaga_perfil,
    get_candidatos_perfis,
    get_candidato_perfil,
    get_talento_perfil,
    get_talentos_ids,
    get_talentos_ids_sem_embedding,
)
from app.embeddings import (
    generate_vaga_embedding,
    generate_candidato_embedding,
    generate_talento_embedding,
    save_vaga_embedding,
    save_candidato_embedding,
    save_talento_embedding,
    get_vaga_embedding,
    get_candidato_embedding,
    get_talento_embedding,
)
from app.vector_search import search_all_by_similarity, search_candidates_by_similarity, get_similarity_score
from app.unified_matching import (
    run_unified_matching,
    evaluate_single_person,
    ensure_person_embedding,
)

# Legacy (mantido para retrocompatibilidade)
from app.matching import run_matching

# Backfill state: avoid repeated parallel backfills per tenant
BACKFILL_LAST_RUN: dict[str, float] = {}
BACKFILL_RUNNING: set[str] = set()
_backfill_state_lock = threading.Lock()


app = FastAPI(
    title="RHPortal.Ai",
    description="Matching unificado: embeddings + pgvector + LLM (80% filtros, 20% requisitos)",
    version="2.0.0",
)


# ─── Models ────────────────────────────────────────────────────────────────

class MatchRequest(BaseModel):
    """Payload para solicitar matching de uma vaga."""
    vaga_id: str = Field(..., description="ID da vaga (UUID)")
    tenant_id: str | None = Field(None, description="ID do tenant (opcional)")
    limit: int | None = Field(None, ge=10, le=100, description="Tamanho do ranking (10-100, default: 20)")


class MatchItem(BaseModel):
    person_id: str
    nome: str
    email: str
    source: str = Field(..., description="'candidato' ou 'talento'")
    similaridade_vetorial: int = Field(..., ge=0, le=100, description="Score vetorial pré-filtro")
    score_filtros: int = Field(..., ge=0, le=100, description="Score filtros (peso 80%)")
    score_requisitos: int = Field(..., ge=0, le=100, description="Score requisitos (peso 20%)")
    score_final: int = Field(..., ge=0, le=100, description="Score final ponderado")
    justificativa: str = Field("", description="Justificativa da avaliação")


class MatchResponse(BaseModel):
    vaga_id: str
    vaga_titulo: str | None
    ranking_size: int
    total_avaliados: int
    matching: list[MatchItem]


class EvaluateOneRequest(BaseModel):
    """Payload para avaliar uma única pessoa contra uma vaga."""
    vaga_id: str = Field(..., description="ID da vaga (UUID)")
    person_id: str = Field(..., description="ID do candidato ou talento (UUID)")
    source: str = Field(..., description="'candidato' ou 'talento'")
    tenant_id: str | None = Field(None, description="ID do tenant (opcional)")


class EvaluateOneResponse(BaseModel):
    person_id: str
    source: str
    score_filtros: int = Field(..., ge=0, le=100)
    score_requisitos: int = Field(..., ge=0, le=100)
    score_final: int = Field(..., ge=0, le=100)
    justificativa: str = ""


class GenerateEmbeddingResponse(BaseModel):
    """Resposta de geração de embedding."""
    success: bool
    entity_id: str
    message: str | None = None


class BatchTalentosEmbeddingsRequest(BaseModel):
    """Payload para geração em lote de embeddings de talentos."""
    tenant_id: str | None = Field(None, description="ID do tenant")
    limit: int = Field(100, ge=1, le=1000, description="Máximo de talentos a processar por request (até 1000)")


class BatchTalentosEmbeddingsResponse(BaseModel):
    """Resposta do batch de embeddings de talentos."""
    generated: int
    total_processed: int
    message: str | None = None


class SimilarityRequest(BaseModel):
    vaga_id: str
    candidato_id: str
    tenant_id: str | None = None


class SimilarityResponse(BaseModel):
    vaga_id: str
    candidato_id: str
    similaridade: int | None = Field(None, description="Score 0-100 ou None se não houver embeddings")


# ─── Legacy Models (retrocompatibilidade) ──────────────────────────────────

class LegacyMatchRequest(BaseModel):
    vaga_id: str = Field(..., description="ID da vaga (UUID)")
    tenant_id: str | None = Field(None, description="ID do tenant (opcional)")
    limit: int | None = Field(100, ge=1, le=200, description="Máximo de candidatos no retorno")


class LegacyMatchItem(BaseModel):
    candidato_id: str
    nome: str
    email: str
    similaridade: int = Field(..., ge=0, le=100, description="Score de similaridade 0-100")


class LegacyMatchResponse(BaseModel):
    vaga_id: str
    vaga_titulo: str | None
    total_candidatos: int
    matching: list[LegacyMatchItem]


class LegacyMatchOneRequest(BaseModel):
    vaga_id: str
    candidato_id: str
    tenant_id: str | None = None


class LegacyMatchOneResponse(BaseModel):
    candidato_id: str
    nome: str
    email: str
    similaridade: int = Field(..., ge=0, le=100)


# ─── Endpoints: Health ─────────────────────────────────────────────────────

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "rhportal-ai", "version": "2.0.0"}


# ─── Backfill automático de embeddings (background) ──────────────────────────

def _backfill_embeddings_for_tenant(tenant_id: str, vaga_id: str, limit: int = 150) -> None:
    """
    Executado em background quando o matching retorna vazio.
    Gera embedding da vaga (se faltar) e de um lote de talentos sem embedding,
    para que na próxima vez que o operador abrir Matching já haja resultados.
    Não levanta exceção (evita quebrar o worker).
    """
    if not tenant_id or not OPENAI_API_KEY:
        return
    # mark running status handled externally
    try:
        # Garantir embedding da vaga
        vaga = get_vaga_perfil(vaga_id, tenant_id)
        if vaga and get_vaga_embedding(vaga_id, tenant_id) is None:
            emb = generate_vaga_embedding(vaga)
            save_vaga_embedding(vaga_id, emb, tenant_id)
            print(f"[backfill] vaga {vaga_id} embedding gerado para tenant {tenant_id}")
        # Lote de talentos sem embedding
        ids = get_talentos_ids_sem_embedding(tenant_id, limit=limit)
        print(f"[backfill] encontrado {len(ids)} talentos sem embedding (tenant={tenant_id}), processando até {limit}")
        processed = 0
        for tid in ids:
            try:
                talento = get_talento_perfil(tid, tenant_id)
                if not talento:
                    continue
                embedding = generate_talento_embedding(talento)
                save_talento_embedding(tid, embedding, tenant_id)
                processed += 1
                if processed % 10 == 0:
                    print(f"[backfill] processados {processed}/{len(ids)} talentos para tenant {tenant_id}")
            except Exception:
                continue
        print(f"[backfill] terminado lote: {processed} embeddings gerados para tenant {tenant_id}")
    except Exception:
        pass
    finally:
        # release running flag and record last run time
        try:
            with _backfill_state_lock:
                BACKFILL_RUNNING.discard(tenant_id)
                BACKFILL_LAST_RUN[tenant_id] = time.time()
        except Exception:
            pass


# ─── Endpoints: Matching Unificado (NOVOS) ─────────────────────────────────

@app.post("/matching/run", response_model=MatchResponse)
def run_matching_endpoint(req: MatchRequest, background_tasks: BackgroundTasks) -> MatchResponse:
    """
    Executa matching unificado completo para uma vaga:
    1. Pré-filtro vetorial (Candidatos + Talentos)
    2. LLM scoring (80% filtros, 20% requisitos)
    3. Retorna ranking ordenado.

    Se o resultado for vazio (ex.: talentos ainda sem embedding), dispara em
    background a geração de embeddings da vaga e de um lote de talentos, para
    que na próxima abertura do Matching já haja candidatos/talentos na lista.
    """
    _check_dependencies()

    vaga = get_vaga_perfil(req.vaga_id, req.tenant_id)
    if not vaga:
        raise HTTPException(status_code=404, detail="Vaga não encontrada")

    ranking_size = req.limit or DEFAULT_RANKING_SIZE

    try:
        items = run_unified_matching(
            req.vaga_id,
            req.tenant_id,
            top_n=ranking_size,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no matching unificado: {e!s}")

    # Schedule controlled backfill (one-shot per tenant window) to avoid repeated heavy work.
    if req.tenant_id:
        try:
            now = time.time()
            with _backfill_state_lock:
                last = BACKFILL_LAST_RUN.get(req.tenant_id, 0)
                running = req.tenant_id in BACKFILL_RUNNING
                # cooldown: longer when there were no items (more expensive)
                cooldown = 3600 if not items else 60
                if not running and (now - last) > cooldown:
                    BACKFILL_RUNNING.add(req.tenant_id)
                    batch = 150 if not items else 20
                    background_tasks.add_task(
                        _backfill_embeddings_for_tenant,
                        req.tenant_id,
                        req.vaga_id,
                        batch,
                    )
        except Exception:
            # best-effort scheduling; don't fail the request if scheduling fails
            pass

    return MatchResponse(
        vaga_id=req.vaga_id,
        vaga_titulo=vaga.get("Titulo"),
        ranking_size=ranking_size,
        total_avaliados=len(items),
        matching=[MatchItem(**x) for x in items],
    )


@app.post("/matching/evaluate-one", response_model=EvaluateOneResponse)
def evaluate_one_endpoint(req: EvaluateOneRequest) -> EvaluateOneResponse:
    """
    Avalia uma única pessoa (candidato ou talento) contra uma vaga.
    Usado para atualização incremental do ranking.
    """
    _check_dependencies()

    vaga = get_vaga_perfil(req.vaga_id, req.tenant_id)
    if not vaga:
        raise HTTPException(status_code=404, detail="Vaga não encontrada")

    try:
        result = evaluate_single_person(
            req.vaga_id,
            req.person_id,
            req.source,
            req.tenant_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na avaliação: {e!s}")

    if result is None:
        raise HTTPException(status_code=404, detail="Pessoa não encontrada ou dados insuficientes")

    return EvaluateOneResponse(**result)


# ─── Endpoints: Embeddings ─────────────────────────────────────────────────

@app.post("/embeddings/vaga/{vaga_id}", response_model=GenerateEmbeddingResponse)
def generate_vaga_embedding_endpoint(vaga_id: str, tenant_id: str | None = None):
    """Gera e salva embedding para uma vaga."""
    try:
        vaga = get_vaga_perfil(vaga_id, tenant_id)
        if not vaga:
            raise HTTPException(status_code=404, detail="Vaga não encontrada")

        embedding = generate_vaga_embedding(vaga)
        success = save_vaga_embedding(vaga_id, embedding, tenant_id)

        if not success:
            raise HTTPException(status_code=500, detail="Erro ao salvar embedding")

        return GenerateEmbeddingResponse(
            success=True, entity_id=vaga_id, message="Embedding da vaga gerado com sucesso"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar embedding: {str(e)}")


@app.post("/embeddings/candidato/{candidato_id}", response_model=GenerateEmbeddingResponse)
def generate_candidato_embedding_endpoint(candidato_id: str, tenant_id: str | None = None):
    """Gera e salva embedding para um candidato."""
    try:
        candidato = get_candidato_perfil(candidato_id, tenant_id)
        if not candidato:
            raise HTTPException(status_code=404, detail="Candidato não encontrado")

        embedding = generate_candidato_embedding(candidato)
        success = save_candidato_embedding(candidato_id, embedding, tenant_id)

        if not success:
            raise HTTPException(status_code=500, detail="Erro ao salvar embedding")

        return GenerateEmbeddingResponse(
            success=True, entity_id=candidato_id, message="Embedding do candidato gerado com sucesso"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar embedding: {str(e)}")


@app.post("/embeddings/talento/{talento_id}", response_model=GenerateEmbeddingResponse)
def generate_talento_embedding_endpoint(talento_id: str, tenant_id: str | None = None):
    """Gera e salva embedding para um talento."""
    try:
        talento = get_talento_perfil(talento_id, tenant_id)
        if not talento:
            raise HTTPException(status_code=404, detail="Talento não encontrado")

        embedding = generate_talento_embedding(talento)
        success = save_talento_embedding(talento_id, embedding, tenant_id)

        if not success:
            raise HTTPException(status_code=500, detail="Erro ao salvar embedding")

        return GenerateEmbeddingResponse(
            success=True, entity_id=talento_id, message="Embedding do talento gerado com sucesso"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar embedding: {str(e)}")


@app.post("/embeddings/talentos/batch", response_model=BatchTalentosEmbeddingsResponse)
def batch_talentos_embeddings_endpoint(req: BatchTalentosEmbeddingsRequest):
    """
    Gera embeddings para talentos do tenant que ainda não têm.
    Útil ao abrir vaga para garantir base vetorial do banco de talentos.
    """
    _check_dependencies()
    ids = get_talentos_ids_sem_embedding(req.tenant_id, limit=req.limit)
    generated = 0
    for tid in ids:
        try:
            talento = get_talento_perfil(tid, req.tenant_id)
            if not talento:
                continue
            embedding = generate_talento_embedding(talento)
            if save_talento_embedding(tid, embedding, req.tenant_id):
                generated += 1
        except Exception:
            continue
    return BatchTalentosEmbeddingsResponse(
        generated=generated,
        total_processed=len(ids),
        message=f"Gerados {generated} embeddings de {len(ids)} talentos sem embedding.",
    )


# ─── Endpoints: Busca Vetorial ─────────────────────────────────────────────

@app.post("/similarity", response_model=SimilarityResponse)
def get_similarity_endpoint(req: SimilarityRequest) -> SimilarityResponse:
    """Calcula score de similaridade vetorial entre uma vaga e um candidato."""
    score = get_similarity_score(req.vaga_id, req.candidato_id)
    return SimilarityResponse(
        vaga_id=req.vaga_id, candidato_id=req.candidato_id, similaridade=score
    )


# ─── Endpoints LEGADOS (retrocompatibilidade C#) ──────────────────────────

@app.post("/match", response_model=LegacyMatchResponse)
def match_candidatos_legacy(req: LegacyMatchRequest) -> LegacyMatchResponse:
    """
    [LEGADO] Matching por filtros (mantido para retrocompatibilidade).
    Preferir /matching/run para o novo sistema unificado.
    """
    _check_dependencies()

    vaga = get_vaga_perfil(req.vaga_id, req.tenant_id)
    if not vaga:
        raise HTTPException(status_code=404, detail="Vaga não encontrada")

    candidatos = get_candidatos_perfis(req.tenant_id)
    if not candidatos:
        return LegacyMatchResponse(
            vaga_id=req.vaga_id, vaga_titulo=vaga.get("Titulo"),
            total_candidatos=0, matching=[],
        )

    limit = req.limit if req.limit else 200
    try:
        items = run_matching(vaga, candidatos, algorithm="filters", limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no matching: {e!s}")

    return LegacyMatchResponse(
        vaga_id=req.vaga_id, vaga_titulo=vaga.get("Titulo"),
        total_candidatos=len(items),
        matching=[LegacyMatchItem(**x) for x in items[:limit]],
    )


@app.post("/match-one", response_model=LegacyMatchOneResponse)
def match_one_candidato_legacy(req: LegacyMatchOneRequest) -> LegacyMatchOneResponse:
    """[LEGADO] Score de um único candidato por filtros."""
    _check_dependencies()

    vaga = get_vaga_perfil(req.vaga_id, req.tenant_id)
    if not vaga:
        raise HTTPException(status_code=404, detail="Vaga não encontrada")

    candidato = get_candidato_perfil(req.candidato_id, req.tenant_id)
    if not candidato:
        raise HTTPException(status_code=404, detail="Candidato não encontrado")

    try:
        items = run_matching(vaga, [candidato], algorithm="filters", limit=1)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no matching: {e!s}")

    if items:
        one = items[0]
        return LegacyMatchOneResponse(
            candidato_id=one["candidato_id"],
            nome=one.get("nome", ""), email=one.get("email", ""),
            similaridade=one.get("similaridade", 0),
        )
    return LegacyMatchOneResponse(
        candidato_id=req.candidato_id,
        nome=candidato.get("Nome", ""), email=candidato.get("Email", ""),
        similaridade=0,
    )


@app.post("/match-hybrid", response_model=LegacyMatchResponse)
def match_candidatos_hybrid_legacy(req: LegacyMatchRequest) -> LegacyMatchResponse:
    """
    [LEGADO] Matching híbrido. Agora redireciona para o sistema unificado
    e converte o resultado para o formato legado.
    """
    _check_dependencies()

    vaga = get_vaga_perfil(req.vaga_id, req.tenant_id)
    if not vaga:
        raise HTTPException(status_code=404, detail="Vaga não encontrada")

    try:
        ranking_size = min(req.limit or DEFAULT_RANKING_SIZE, 100)
        items = run_unified_matching(req.vaga_id, req.tenant_id, top_n=ranking_size)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no matching: {e!s}")

    # Converter para formato legado
    legacy_items = [
        LegacyMatchItem(
            candidato_id=item["person_id"],
            nome=item["nome"],
            email=item["email"],
            similaridade=item["score_final"],
        )
        for item in items
    ]

    return LegacyMatchResponse(
        vaga_id=req.vaga_id, vaga_titulo=vaga.get("Titulo"),
        total_candidatos=len(legacy_items), matching=legacy_items,
    )


# ─── Helpers ───────────────────────────────────────────────────────────────

def _check_dependencies():
    if not DATABASE_URL:
        raise HTTPException(status_code=503, detail="DATABASE_URL não configurada")
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY não configurada")


if __name__ == "__main__":
    import uvicorn
    from app.config import HOST, PORT
    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=True)
