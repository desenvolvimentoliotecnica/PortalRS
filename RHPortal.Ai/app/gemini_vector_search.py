"""
Busca vetorial v2 usando pgvector com embeddings Gemini (3072 dims).
Coexiste com vector_search.py (OpenAI 1536 dims) — colunas separadas no banco.

Colunas adicionadas:
  - Vagas: gemini_embedding vector(N), gemini_embedding_at_utc timestamptz
  - Candidatos: gemini_embedding vector(N), gemini_embedding_at_utc timestamptz
  - Talentos: "GeminiEmbedding" vector(N), "GeminiEmbeddingAtUtc" timestamptz
"""
from contextlib import contextmanager
from typing import Any, Generator

from psycopg2.extensions import connection as PgConnection

from app.config import TENANT_ID
from app.database_pool import pgvector_conn
from app.gemini_config import GEMINI_EMBEDDING_DIMS
from app.log import gemini as log

# Tenants cujas colunas Gemini já foram verificadas neste processo
_gemini_columns_ready: set[str] = set()


# ─── DDL: Colunas e Índices ────────────────────────────────────────────────

def ensure_gemini_columns(conn) -> None:
    """
    Adiciona colunas gemini_embedding nas tabelas Vagas, Candidatos e Talentos.
    Idempotente: usa IF NOT EXISTS.
    A extensão pgvector já está criada via pgvector_conn — não recria aqui.
    """
    dims = GEMINI_EMBEDDING_DIMS
    with conn.cursor() as cur:
        # Vagas
        cur.execute(f"""
            ALTER TABLE "Vagas"
            ADD COLUMN IF NOT EXISTS gemini_embedding vector({dims}),
            ADD COLUMN IF NOT EXISTS gemini_embedding_at_utc timestamp with time zone
        """)
        # Candidatos
        cur.execute(f"""
            ALTER TABLE "Candidatos"
            ADD COLUMN IF NOT EXISTS gemini_embedding vector({dims}),
            ADD COLUMN IF NOT EXISTS gemini_embedding_at_utc timestamp with time zone
        """)
        # Talentos (colunas PascalCase para manter padrão EF)
        try:
            cur.execute(f"""
                ALTER TABLE "Talentos"
                ADD COLUMN IF NOT EXISTS "GeminiEmbedding" vector({dims}),
                ADD COLUMN IF NOT EXISTS "GeminiEmbeddingAtUtc" timestamp with time zone
            """)
        except Exception:
            pass
    conn.commit()


@contextmanager
def _gemini_conn(tenant_id: str | None = None) -> Generator[PgConnection, None, None]:
    """
    Context manager: conexão do pool com pgvector registrado + colunas Gemini garantidas.
    DDL de colunas é executado apenas uma vez por tenant neste processo.
    """
    key = (tenant_id or "default").lower()
    with pgvector_conn(tenant_id) as conn:
        if key not in _gemini_columns_ready:
            ensure_gemini_columns(conn)
            _gemini_columns_ready.add(key)
        yield conn


# ─── Salvar Embedding ──────────────────────────────────────────────────────

def save_gemini_embedding(
    entity_type: str,
    entity_id: str,
    embedding: list[float],
    tenant_id: str | None = None,
) -> bool:
    """
    Salva embedding Gemini no banco.
    entity_type: "vaga" | "candidato" | "talento"
    """
    try:
        col_emb, col_at, table = _entity_columns(entity_type)
        with _gemini_conn(tenant_id) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    UPDATE "{table}"
                    SET {col_emb} = %s::vector,
                        {col_at} = NOW()
                    WHERE "Id" = %s
                    """,
                    (embedding, entity_id),
                )
                conn.commit()
        log.info("gemini_embedding_saved", extra={"ctx": {
            "entity_type": entity_type, "entity_id": entity_id,
        }})
        return True
    except Exception as e:
        log.error("gemini_embedding_save_failed", extra={"ctx": {
            "entity_type": entity_type, "entity_id": entity_id, "error": str(e),
        }})
        return False


def get_gemini_embedding(
    entity_type: str,
    entity_id: str,
    tenant_id: str | None = None,
) -> list[float] | None:
    """Busca embedding Gemini existente no banco."""
    try:
        col_emb, _, table = _entity_columns(entity_type)
        with _gemini_conn(tenant_id) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f'SELECT {col_emb} FROM "{table}" WHERE "Id" = %s',
                    (entity_id,),
                )
                row = cur.fetchone()
        return row[0] if row and row[0] is not None else None
    except Exception as e:
        log.error("gemini_embedding_fetch_failed", extra={"ctx": {
            "entity_type": entity_type, "entity_id": entity_id, "error": str(e),
        }})
        return None


def _entity_columns(entity_type: str) -> tuple[str, str, str]:
    """Retorna (coluna_embedding, coluna_timestamp, tabela) para o entity_type."""
    if entity_type == "vaga":
        return "gemini_embedding", "gemini_embedding_at_utc", "Vagas"
    elif entity_type == "candidato":
        return "gemini_embedding", "gemini_embedding_at_utc", "Candidatos"
    elif entity_type == "talento":
        return '"GeminiEmbedding"', '"GeminiEmbeddingAtUtc"', "Talentos"
    else:
        raise ValueError(f"entity_type inválido: {entity_type}")


# ─── Busca Vetorial Unificada ──────────────────────────────────────────────

def search_top_matches(
    vaga_id: str,
    tenant_id: str | None = None,
    limit: int = 20,
    min_score: int = 0,
) -> list[dict[str, Any]]:
    """
    Busca UNIFICADA por similaridade coseno (Candidatos + Talentos)
    usando embeddings Gemini. Retorna score 0-100 em PONTOS.

    Args:
        vaga_id: ID da vaga (já deve ter gemini_embedding)
        tenant_id: ID do tenant
        limit: Máximo de resultados (padrão: 20)
        min_score: Score mínimo (0-100)

    Returns:
        Lista de dicts com person_id, nome, email, score (0-100), source
    """
    try:
        tid = tenant_id or TENANT_ID
        with _gemini_conn(tenant_id) as conn:
            with conn.cursor() as cur:
                # Buscar embedding Gemini da vaga
                cur.execute(
                    'SELECT gemini_embedding FROM "Vagas" WHERE "Id" = %s',
                    (vaga_id,),
                )
                row = cur.fetchone()
                if not row or row[0] is None:
                    return []

                vaga_emb = row[0]

                if tid:
                    query = """
                        WITH all_people AS (
                            -- Candidatos com embedding Gemini (exclui Reprovados = 3)
                            SELECT
                                c."Id" AS person_id,
                                c."Nome" AS nome,
                                c."Email" AS email,
                                (1 - (c.gemini_embedding <=> %s::vector)) * 100 AS score,
                                'candidato' AS source
                            FROM "Candidatos" c
                            WHERE c."TenantId" = %s
                              AND c.gemini_embedding IS NOT NULL
                              AND c."Status" != 3

                            UNION ALL

                            -- Talentos com embedding Gemini
                            SELECT
                                t."Id" AS person_id,
                                p."Nome" AS nome,
                                p."Email" AS email,
                                (1 - (t."GeminiEmbedding" <=> %s::vector)) * 100 AS score,
                                'talento' AS source
                            FROM "Talentos" t
                            JOIN "Pessoas" p ON p."Id" = t."PessoaId" AND p."TenantId" = t."TenantId"
                            WHERE t."TenantId" = %s AND t."GeminiEmbedding" IS NOT NULL
                            AND NOT EXISTS (
                                SELECT 1 FROM "Candidatos" cx
                                WHERE cx."TalentoId" = t."Id"
                            )
                        )
                        SELECT person_id, nome, email, score, source
                        FROM all_people
                        WHERE score >= %s
                        ORDER BY score DESC
                        LIMIT %s
                    """
                    params = [vaga_emb, tid, vaga_emb, tid, min_score, limit]
                else:
                    query = """
                        WITH all_people AS (
                            SELECT
                                c."Id" AS person_id,
                                c."Nome" AS nome,
                                c."Email" AS email,
                                (1 - (c.gemini_embedding <=> %s::vector)) * 100 AS score,
                                'candidato' AS source
                            FROM "Candidatos" c
                            WHERE c.gemini_embedding IS NOT NULL
                              AND c."Status" != 3

                            UNION ALL

                            SELECT
                                t."Id" AS person_id,
                                p."Nome" AS nome,
                                p."Email" AS email,
                                (1 - (t."GeminiEmbedding" <=> %s::vector)) * 100 AS score,
                                'talento' AS source
                            FROM "Talentos" t
                            JOIN "Pessoas" p ON p."Id" = t."PessoaId"
                            WHERE t."GeminiEmbedding" IS NOT NULL
                            AND NOT EXISTS (
                                SELECT 1 FROM "Candidatos" cx
                                WHERE cx."TalentoId" = t."Id"
                            )
                        )
                        SELECT person_id, nome, email, score, source
                        FROM all_people
                        WHERE score >= %s
                        ORDER BY score DESC
                        LIMIT %s
                    """
                    params = [vaga_emb, vaga_emb, min_score, limit]

                cur.execute(query, params)
                rows = cur.fetchall()

        results = []
        for row in rows:
            s = max(0, min(100, int(row[3])))
            results.append({
                "person_id": str(row[0]),
                "nome": row[1] or "",
                "email": row[2] or "",
                "score": s,
                "source": row[4],
            })
        return results

    except Exception as e:
        log.error("gemini_vector_search_failed", extra={"ctx": {
            "vaga_id": vaga_id, "tenant_id": tenant_id, "error": str(e),
        }})
        return []


def get_gemini_similarity(
    vaga_id: str,
    person_id: str,
    source: str,
    tenant_id: str | None = None,
) -> int | None:
    """Calcula similaridade Gemini entre uma vaga e uma pessoa específica."""
    try:
        with _gemini_conn(tenant_id) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    'SELECT gemini_embedding FROM "Vagas" WHERE "Id" = %s',
                    (vaga_id,),
                )
                vaga_row = cur.fetchone()
                if not vaga_row or vaga_row[0] is None:
                    return None

                vaga_emb = vaga_row[0]

                if source == "candidato":
                    cur.execute(
                        'SELECT gemini_embedding FROM "Candidatos" WHERE "Id" = %s',
                        (person_id,),
                    )
                else:
                    cur.execute(
                        'SELECT "GeminiEmbedding" FROM "Talentos" WHERE "Id" = %s',
                        (person_id,),
                    )
                person_row = cur.fetchone()
                if not person_row or person_row[0] is None:
                    return None

                person_emb = person_row[0]

                cur.execute(
                    "SELECT %s::vector <=> %s::vector AS distance",
                    (vaga_emb, person_emb),
                )
                distance = cur.fetchone()[0]

        similarity = (1 - float(distance)) * 100
        return max(0, min(100, int(similarity)))

    except Exception as e:
        log.error("gemini_similarity_failed", extra={"ctx": {
            "vaga_id": vaga_id, "person_id": person_id, "source": source, "error": str(e),
        }})
        return None


def count_gemini_embeddings(tenant_id: str | None = None) -> dict[str, int]:
    """Conta entidades com embedding Gemini."""
    try:
        tid = tenant_id or TENANT_ID
        with _gemini_conn(tenant_id) as conn:
            with conn.cursor() as cur:
                where = 'WHERE "TenantId" = %s AND' if tid else "WHERE"
                params = [tid] if tid else []

                cur.execute(
                    f'SELECT COUNT(*) FROM "Candidatos" {where} gemini_embedding IS NOT NULL',
                    params,
                )
                count_cand = cur.fetchone()[0]

                cur.execute(
                    f'SELECT COUNT(*) FROM "Talentos" {where} "GeminiEmbedding" IS NOT NULL',
                    params,
                )
                count_tal = cur.fetchone()[0]

                cur.execute(
                    f'SELECT COUNT(*) FROM "Vagas" {where} gemini_embedding IS NOT NULL',
                    params,
                )
                count_vag = cur.fetchone()[0]

        return {"candidatos": count_cand, "talentos": count_tal, "vagas": count_vag}
    except Exception as e:
        log.error("gemini_count_failed", extra={"ctx": {"tenant_id": tenant_id, "error": str(e)}})
        return {"candidatos": 0, "talentos": 0, "vagas": 0}


def get_talentos_sem_gemini_embedding(
    tenant_id: str | None = None,
    limit: int = 50,
) -> list[str]:
    """Retorna IDs de talentos sem embedding Gemini (para batch)."""
    try:
        tid = tenant_id or TENANT_ID
        with _gemini_conn(tenant_id) as conn:
            with conn.cursor() as cur:
                where = 'WHERE "TenantId" = %s AND "GeminiEmbedding" IS NULL' if tid else 'WHERE "GeminiEmbedding" IS NULL'
                params: list = [tid] if tid else []
                cur.execute(f'SELECT "Id" FROM "Talentos" {where} LIMIT %s', params + [limit])
                return [str(row[0]) for row in cur.fetchall()]
    except Exception as e:
        log.error("gemini_talentos_sem_embedding_failed", extra={"ctx": {
            "tenant_id": tenant_id, "error": str(e),
        }})
        return []
