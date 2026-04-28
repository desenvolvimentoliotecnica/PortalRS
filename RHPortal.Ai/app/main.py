"""
API FastAPI para matching por IA unificado.
Pipeline: embeddings (OpenAI) → pré-filtro vetorial (pgvector) → LLM scoring (regra versionada).
"""
from contextlib import asynccontextmanager
from typing import Any
import time
import threading
import uuid

from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import (
    DATABASE_URL,
    DEFAULT_RANKING_SIZE,
    EMBEDDING_PROVIDER,
    GEMINI_API_KEY,
    LLM_PROVIDER,
    OPENAI_API_KEY,
)
from app.database_pool import close_all as _close_pools, db_conn as _health_db_conn
from app.log import requests as req_log, matching as match_log
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
from app.request_context import use_request_overrides

# Backfill state: avoid repeated parallel backfills per tenant
BACKFILL_LAST_RUN: dict[str, float] = {}
BACKFILL_RUNNING: set[str] = set()
_backfill_state_lock = threading.Lock()


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    _close_pools()


class _RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        rid = str(uuid.uuid4())[:8]
        t0 = time.perf_counter()
        try:
            resp = await call_next(request)
            req_log.info("req", extra={"ctx": {
                "id": rid,
                "method": request.method,
                "path": request.url.path,
                "status": resp.status_code,
                "ms": round((time.perf_counter() - t0) * 1000),
            }})
            return resp
        except Exception as e:
            req_log.error("req_error", extra={"ctx": {
                "id": rid,
                "path": request.url.path,
                "error": str(e),
            }})
            raise


app = FastAPI(
    title="RHPortal.Ai",
    description="Matching unificado: embeddings + pgvector + LLM (80% filtros, 20% requisitos)",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(_RequestLoggingMiddleware)


# ─── Models ────────────────────────────────────────────────────────────────

class MatchRequest(BaseModel):
    """Payload para solicitar matching de uma vaga."""
    vaga_id: str = Field(..., description="ID da vaga (UUID)")
    tenant_id: str | None = Field(None, description="ID do tenant (opcional)")
    limit: int | None = Field(None, ge=10, le=100, description="Tamanho do ranking (10-100, default: 20)")
    rule_version: str | None = Field(None, description="Versão da regra: v1_80_20 ou v2_65_35_strict")
    # Fase 3 LLM-agnóstico — overrides por tenant injetados pela API .NET.
    # Quando vazios, valem as env vars LLM_PROVIDER / EMBEDDING_PROVIDER.
    llm_provider: str | None = Field(None, description="Override de LLM provider (openai|gemini|ollama)")
    llm_model: str | None = Field(None, description="Override de LLM model (ex: gemini-2.5-flash)")
    embedding_provider: str | None = Field(None, description="Override de embedding provider")
    embedding_model: str | None = Field(None, description="Override de embedding model")


class MatchItem(BaseModel):
    person_id: str
    nome: str
    email: str
    source: str = Field(..., description="'candidato' ou 'talento'")
    similaridade_vetorial: int = Field(..., ge=0, le=100, description="Score vetorial pré-filtro")
    score_competencia: int = Field(0, ge=0, le=100, description="Score competência técnica")
    score_experiencia: int = Field(0, ge=0, le=100, description="Score experiência profissional")
    score_formacao: int = Field(0, ge=0, le=100, description="Score formação acadêmica")
    score_localidade: int = Field(0, ge=0, le=100, description="Score localidade e logística")
    score_filtros: int = Field(0, ge=0, le=100, description="Score filtros (backward compat)")
    score_requisitos: int = Field(0, ge=0, le=100, description="Score requisitos (backward compat)")
    score_final: int = Field(..., ge=0, le=100, description="Score final ponderado")
    mandatory_total: int = Field(0, ge=0, description="Total de requisitos obrigatórios")
    missing_mandatory_count: int = Field(0, ge=0, description="Obrigatórios não atendidos")
    mandatory_coverage: int = Field(100, ge=0, le=100, description="Cobertura de obrigatórios (0-100)")
    hard_penalty: int = Field(0, ge=0, description="Penalidade rígida aplicada ao score final")
    rule_version: str = Field("v1_80_20", description="Versão da regra aplicada")
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
    rule_version: str | None = Field(None, description="Versão da regra: v1_80_20 ou v2_65_35_strict")
    # Fase 3 LLM-agnóstico — overrides por tenant
    llm_provider: str | None = Field(None, description="Override de LLM provider")
    llm_model: str | None = Field(None, description="Override de LLM model")
    embedding_provider: str | None = Field(None, description="Override de embedding provider")
    embedding_model: str | None = Field(None, description="Override de embedding model")


class EvaluateOneResponse(BaseModel):
    person_id: str
    source: str
    score_competencia: int = Field(0, ge=0, le=100)
    score_experiencia: int = Field(0, ge=0, le=100)
    score_formacao: int = Field(0, ge=0, le=100)
    score_localidade: int = Field(0, ge=0, le=100)
    score_filtros: int = Field(0, ge=0, le=100)
    score_requisitos: int = Field(0, ge=0, le=100)
    score_final: int = Field(..., ge=0, le=100)
    mandatory_total: int = Field(0, ge=0)
    missing_mandatory_count: int = Field(0, ge=0)
    mandatory_coverage: int = Field(100, ge=0, le=100)
    hard_penalty: int = Field(0, ge=0)
    rule_version: str = "v1_80_20"
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
@app.get("/health/live")
def health_live() -> dict[str, str]:
    """Liveness: serviço está vivo (sem verificar dependências)."""
    return {"status": "ok", "service": "rhportal-ai", "version": "2.0.0"}


@app.get("/health/ready")
def health_ready() -> JSONResponse:
    """Readiness: verifica DB e configuração."""
    checks: dict[str, str] = {}

    # Verifica conexão com o banco
    try:
        with _health_db_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        checks["db"] = "ok"
    except Exception as e:
        checks["db"] = f"error: {e}"

    # Valida a chave do provider ATIVO (não mais hardcode de OpenAI).
    checks["llm_provider"] = LLM_PROVIDER
    checks["embedding_provider"] = EMBEDDING_PROVIDER
    providers_in_use = {LLM_PROVIDER, EMBEDDING_PROVIDER}
    if "openai" in providers_in_use:
        checks["openai_key"] = "ok" if bool(OPENAI_API_KEY) else "missing"
    if "gemini" in providers_in_use:
        checks["gemini_key"] = "ok" if bool(GEMINI_API_KEY) else "missing"
    # Ollama não exige chave — se estiver em uso, o health check de runtime
    # acontecerá naturalmente na primeira chamada LLM.

    ok = all(v == "ok" for k, v in checks.items() if k.endswith("_key") or k == "db")
    return JSONResponse(content={"status": "ok" if ok else "degraded", **checks}, status_code=200 if ok else 503)


# ─── Backfill automático de embeddings (background) ──────────────────────────

def _backfill_embeddings_for_tenant(tenant_id: str, vaga_id: str, limit: int = 150) -> None:
    """
    Executado em background quando o matching retorna vazio.
    Gera embedding da vaga (se faltar) e de um lote de talentos sem embedding,
    para que na próxima vez que o operador abrir Matching já haja resultados.
    Não levanta exceção (evita quebrar o worker).
    """
    # Backfill só faz sentido se tiver a chave do embedding provider ativo.
    if not tenant_id:
        return
    if EMBEDDING_PROVIDER == "openai" and not OPENAI_API_KEY:
        return
    if EMBEDDING_PROVIDER == "gemini" and not GEMINI_API_KEY:
        return
    # mark running status handled externally
    try:
        # Garantir embedding da vaga
        vaga = get_vaga_perfil(vaga_id, tenant_id)
        if vaga and get_vaga_embedding(vaga_id, tenant_id) is None:
            emb = generate_vaga_embedding(vaga)
            save_vaga_embedding(vaga_id, emb, tenant_id)
            match_log.info("backfill_vaga_done", extra={"ctx": {"vaga_id": vaga_id, "tenant": tenant_id}})
        # Lote de talentos sem embedding
        ids = get_talentos_ids_sem_embedding(tenant_id, limit=limit)
        match_log.info("backfill_talentos_start", extra={"ctx": {"count": len(ids), "tenant": tenant_id, "limit": limit}})
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
                    match_log.info("backfill_progress", extra={"ctx": {"processed": processed, "total": len(ids), "tenant": tenant_id}})
            except Exception:
                continue
        match_log.info("backfill_done", extra={"ctx": {"processed": processed, "tenant": tenant_id}})
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
    2. LLM scoring (regra v1/v2)
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
        # Fase 3: aplica overrides de provider/modelo do tenant durante a chamada.
        with use_request_overrides(
            llm_provider=req.llm_provider,
            llm_model=req.llm_model,
            embedding_provider=req.embedding_provider,
            embedding_model=req.embedding_model,
        ):
            items = run_unified_matching(
                req.vaga_id,
                req.tenant_id,
                top_n=ranking_size,
                rule_version=req.rule_version,
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
        # Fase 3: aplica overrides do tenant.
        with use_request_overrides(
            llm_provider=req.llm_provider,
            llm_model=req.llm_model,
            embedding_provider=req.embedding_provider,
            embedding_model=req.embedding_model,
        ):
            result = evaluate_single_person(
                req.vaga_id,
                req.person_id,
                req.source,
                req.tenant_id,
                rule_version=req.rule_version,
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
    providers_in_use = {LLM_PROVIDER, EMBEDDING_PROVIDER}
    if "openai" in providers_in_use and not OPENAI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail=f"OPENAI_API_KEY não configurada (requerida por LLM_PROVIDER={LLM_PROVIDER}, EMBEDDING_PROVIDER={EMBEDDING_PROVIDER})",
        )
    if "gemini" in providers_in_use and not GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail=f"GEMINI_API_KEY não configurada (requerida por LLM_PROVIDER={LLM_PROVIDER}, EMBEDDING_PROVIDER={EMBEDDING_PROVIDER})",
        )


# ─── Gemini v2: Models ─────────────────────────────────────────────────────

from app.gemini_config import GEMINI_API_KEY as _GEMINI_KEY, GEMINI_ENABLED, GEMINI_RANKING_SIZE
from app.gemini_matching import (
    run_gemini_matching,
    evaluate_new_person,
    trigger_matching_on_vaga_approved,
)
from app.gemini_embeddings import (
    generate_vaga_embedding_v2,
    generate_candidato_embedding_v2,
    generate_talento_embedding_v2,
)
from app.gemini_vector_search import (
    save_gemini_embedding,
    get_gemini_embedding,
    count_gemini_embeddings,
    get_talentos_sem_gemini_embedding,
)


class GeminiMatchRequest(BaseModel):
    """Payload para matching Gemini v2."""
    vaga_id: str = Field(..., description="ID da vaga (UUID)")
    tenant_id: str | None = Field(None, description="ID do tenant")
    top_n: int | None = Field(None, ge=5, le=100, description="Tamanho do ranking (5-100, default: 20)")


class GeminiMatchItem(BaseModel):
    person_id: str
    nome: str
    email: str
    source: str = Field(..., description="'candidato' ou 'talento'")
    score_embedding: int = Field(..., ge=0, le=100, description="Score de embedding (pontos)")
    score_competencia: int = Field(0, ge=0, le=100, description="Score competência técnica")
    score_experiencia: int = Field(0, ge=0, le=100, description="Score experiência profissional")
    score_formacao: int = Field(0, ge=0, le=100, description="Score formação acadêmica")
    score_localidade: int = Field(0, ge=0, le=100, description="Score localidade e logística")
    score_filtros: int = Field(0, ge=0, le=100, description="Score filtros (compat)")
    score_requisitos: int = Field(0, ge=0, le=100, description="Score requisitos (compat)")
    score_final: int = Field(..., ge=0, le=100, description="Score final (pontos)")
    justificativa: str = Field("", description="Justificativa da avaliação")


class GeminiMatchResponse(BaseModel):
    vaga_id: str
    vaga_titulo: str | None
    ranking_size: int
    total_avaliados: int
    engine: str = "gemini-embedding-002"
    matching: list[GeminiMatchItem]


class GeminiTriggerRequest(BaseModel):
    """Payload para trigger automático quando vaga é aprovada."""
    vaga_id: str = Field(..., description="ID da vaga aprovada/lançada")
    tenant_id: str | None = Field(None, description="ID do tenant")
    batch_size: int = Field(150, ge=10, le=500, description="Tamanho do batch de talentos")


class GeminiTriggerResponse(BaseModel):
    status: str
    vaga_id: str | None = None
    talentos_embeddings_generated: int = 0
    ranking_size: int = 0
    elapsed_seconds: float = 0
    message: str | None = None


class GeminiEvaluatePersonRequest(BaseModel):
    """Payload para avaliar/inserir candidato no ranking."""
    vaga_id: str = Field(..., description="ID da vaga")
    person_id: str = Field(..., description="ID do candidato ou talento")
    source: str = Field(..., description="'candidato' ou 'talento'")
    tenant_id: str | None = Field(None, description="ID do tenant")


class GeminiEvaluatePersonResponse(BaseModel):
    person_id: str
    source: str
    score_embedding: int = Field(0, ge=0, le=100)
    score_competencia: int = Field(0, ge=0, le=100)
    score_experiencia: int = Field(0, ge=0, le=100)
    score_formacao: int = Field(0, ge=0, le=100)
    score_localidade: int = Field(0, ge=0, le=100)
    score_filtros: int = Field(0, ge=0, le=100)
    score_requisitos: int = Field(0, ge=0, le=100)
    score_final: int = Field(0, ge=0, le=100)
    justificativa: str = ""


class GeminiEmbeddingRequest(BaseModel):
    """Payload para gerar embedding Gemini de uma entidade."""
    entity_type: str = Field(..., description="'vaga', 'candidato' ou 'talento'")
    entity_id: str = Field(..., description="ID da entidade (UUID)")
    tenant_id: str | None = Field(None, description="ID do tenant")


class GeminiBatchTalentosRequest(BaseModel):
    tenant_id: str | None = Field(None, description="ID do tenant")
    limit: int = Field(100, ge=1, le=500, description="Máximo de talentos a processar")


class GeminiStatsResponse(BaseModel):
    enabled: bool
    candidatos: int
    talentos: int
    vagas: int


# ─── Gemini v2: Endpoints ──────────────────────────────────────────────────

def _check_gemini():
    if not _GEMINI_KEY:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY não configurada no .env")
    if not GEMINI_ENABLED:
        raise HTTPException(status_code=503, detail="Gemini v2 desabilitado (GEMINI_ENABLED=false)")


@app.post("/v2/matching/run", response_model=GeminiMatchResponse)
def run_gemini_matching_endpoint(req: GeminiMatchRequest) -> GeminiMatchResponse:
    """
    Executa matching completo via Gemini Embedding 2:
    1. Embedding Gemini da vaga
    2. Busca vetorial (Candidatos + Talentos) → top N por pontos
    3. LLM avalia cada um → score final real
    """
    _check_dependencies()
    _check_gemini()

    vaga = get_vaga_perfil(req.vaga_id, req.tenant_id)
    if not vaga:
        raise HTTPException(status_code=404, detail="Vaga não encontrada")

    try:
        items = run_gemini_matching(req.vaga_id, req.tenant_id, top_n=req.top_n)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no matching Gemini: {e!s}")

    return GeminiMatchResponse(
        vaga_id=req.vaga_id,
        vaga_titulo=vaga.get("Titulo"),
        ranking_size=req.top_n or GEMINI_RANKING_SIZE,
        total_avaliados=len(items),
        matching=[GeminiMatchItem(**x) for x in items],
    )


@app.post("/v2/matching/trigger", response_model=GeminiTriggerResponse)
def trigger_matching_endpoint(
    req: GeminiTriggerRequest,
    background_tasks: BackgroundTasks,
) -> GeminiTriggerResponse:
    """
    Trigger automático quando vaga é aprovada/lançada.
    Executa em background: gera embeddings + roda matching.
    Retorna imediatamente com status 'accepted'.
    """
    _check_dependencies()
    _check_gemini()

    vaga = get_vaga_perfil(req.vaga_id, req.tenant_id)
    if not vaga:
        raise HTTPException(status_code=404, detail="Vaga não encontrada")

    background_tasks.add_task(
        trigger_matching_on_vaga_approved,
        req.vaga_id,
        req.tenant_id,
        req.batch_size,
    )

    return GeminiTriggerResponse(
        status="accepted",
        vaga_id=req.vaga_id,
        message="Matching Gemini disparado em background. Resultados estarão disponíveis em breve.",
    )


@app.post("/v2/matching/evaluate-person", response_model=GeminiEvaluatePersonResponse)
def evaluate_person_endpoint(req: GeminiEvaluatePersonRequest) -> GeminiEvaluatePersonResponse:
    """
    Avalia um candidato/talento contra uma vaga.
    Se o score for maior que o menor do ranking, a pessoa entra no top 20.
    """
    _check_dependencies()
    _check_gemini()

    vaga = get_vaga_perfil(req.vaga_id, req.tenant_id)
    if not vaga:
        raise HTTPException(status_code=404, detail="Vaga não encontrada")

    try:
        result = evaluate_new_person(
            req.vaga_id, req.person_id, req.source, req.tenant_id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na avaliação Gemini: {e!s}")

    if result is None:
        raise HTTPException(status_code=404, detail="Pessoa não encontrada ou dados insuficientes")

    return GeminiEvaluatePersonResponse(**result)


@app.post("/v2/embeddings/generate", response_model=GenerateEmbeddingResponse)
def generate_gemini_embedding_endpoint(req: GeminiEmbeddingRequest) -> GenerateEmbeddingResponse:
    """Gera e salva embedding Gemini para uma entidade (vaga, candidato, talento)."""
    _check_gemini()

    try:
        if req.entity_type == "vaga":
            vaga = get_vaga_perfil(req.entity_id, req.tenant_id)
            if not vaga:
                raise HTTPException(status_code=404, detail="Vaga não encontrada")
            emb = generate_vaga_embedding_v2(vaga)
            success = save_gemini_embedding("vaga", req.entity_id, emb, req.tenant_id)
        elif req.entity_type == "candidato":
            candidato = get_candidato_perfil(req.entity_id, req.tenant_id)
            if not candidato:
                raise HTTPException(status_code=404, detail="Candidato não encontrado")
            emb = generate_candidato_embedding_v2(candidato)
            success = save_gemini_embedding("candidato", req.entity_id, emb, req.tenant_id)
        elif req.entity_type == "talento":
            talento = get_talento_perfil(req.entity_id, req.tenant_id)
            if not talento:
                raise HTTPException(status_code=404, detail="Talento não encontrado")
            emb = generate_talento_embedding_v2(talento)
            success = save_gemini_embedding("talento", req.entity_id, emb, req.tenant_id)
        else:
            raise HTTPException(status_code=400, detail="entity_type deve ser 'vaga', 'candidato' ou 'talento'")

        if not success:
            raise HTTPException(status_code=500, detail="Erro ao salvar embedding Gemini")

        return GenerateEmbeddingResponse(
            success=True,
            entity_id=req.entity_id,
            message=f"Embedding Gemini ({req.entity_type}) gerado com sucesso",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar embedding Gemini: {e!s}")


@app.post("/v2/embeddings/batch-talentos")
def batch_gemini_talentos_endpoint(req: GeminiBatchTalentosRequest):
    """Gera embeddings Gemini em lote para talentos sem embedding."""
    _check_gemini()

    ids = get_talentos_sem_gemini_embedding(req.tenant_id, limit=req.limit)
    generated = 0
    for tid in ids:
        try:
            talento = get_talento_perfil(tid, req.tenant_id)
            if not talento:
                continue
            emb = generate_talento_embedding_v2(talento)
            if save_gemini_embedding("talento", tid, emb, req.tenant_id):
                generated += 1
        except Exception:
            continue

    return {
        "generated": generated,
        "total_processed": len(ids),
        "message": f"Gerados {generated} embeddings Gemini de {len(ids)} talentos.",
    }


@app.get("/v2/stats", response_model=GeminiStatsResponse)
def gemini_stats_endpoint(tenant_id: str | None = None) -> GeminiStatsResponse:
    """Retorna estatísticas de embeddings Gemini."""
    counts = count_gemini_embeddings(tenant_id)
    return GeminiStatsResponse(
        enabled=GEMINI_ENABLED and bool(_GEMINI_KEY),
        **counts,
    )


if __name__ == "__main__":
    import uvicorn
    from app.config import HOST, PORT
    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=True)

