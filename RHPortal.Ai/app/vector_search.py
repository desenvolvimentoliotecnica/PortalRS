"""
Módulo para busca vetorial usando pgvector.
Usa distância de cosseno para encontrar candidatos e talentos similares a uma vaga.
Faz UNION entre tabelas Candidatos e Talentos para busca unificada.
"""
from typing import Any, Optional

from app.config import TENANT_ID
from app.database_pool import db_conn, pgvector_conn
from app.log import db as log


def ensure_pgvector_extension(conn) -> None:
    """
    Garante extensão pgvector + colunas e índices de embedding no banco (por tenant).
    Idempotente: usa IF NOT EXISTS em todas as DDLs.
    """
    with conn.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector")
        # Vagas: colunas embedding
        cur.execute("""
            ALTER TABLE "Vagas"
            ADD COLUMN IF NOT EXISTS embedding vector(1536),
            ADD COLUMN IF NOT EXISTS embedding_generated_at_utc timestamp with time zone
        """)
        # Candidatos: colunas embedding
        cur.execute("""
            ALTER TABLE "Candidatos"
            ADD COLUMN IF NOT EXISTS embedding vector(1536),
            ADD COLUMN IF NOT EXISTS embedding_generated_at_utc timestamp with time zone
        """)
        # Índices para busca vetorial (podem falhar se tabela vazia; ignora)
        try:
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_vagas_embedding
                ON "Vagas" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
            """)
        except Exception:
            pass
        try:
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_candidatos_embedding
                ON "Candidatos" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
            """)
        except Exception:
            pass
        # Talentos (tabela pode não existir em alguns tenants)
        try:
            cur.execute("""
                ALTER TABLE "Talentos"
                ADD COLUMN IF NOT EXISTS "Embedding" vector(1536),
                ADD COLUMN IF NOT EXISTS "EmbeddingGeneratedAtUtc" timestamp with time zone
            """)
        except Exception:
            pass
    conn.commit()


def search_all_by_similarity(
    vaga_id: str,
    tenant_id: Optional[str] = None,
    limit: int = 40,
    min_score: int = 0
) -> list[dict[str, Any]]:
    """
    Busca UNIFICADA: candidatos + talentos por similaridade vetorial com uma vaga.
    Retorna top N com campo `source` ("candidato" | "talento").
    """
    tid = tenant_id or TENANT_ID
    try:
        with pgvector_conn(tid) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    'SELECT embedding FROM "Vagas" WHERE "Id" = %s',
                    (vaga_id,)
                )
                row = cur.fetchone()

                if not row or row[0] is None:
                    return []

                vaga_embedding = row[0]

                if tid:
                    query = """
                        WITH all_people AS (
                            SELECT
                                c."Id" AS person_id,
                                c."Nome" AS nome,
                                c."Email" AS email,
                                (1 - (c.embedding <=> %s::vector)) * 100 AS similaridade,
                                'candidato' AS source
                            FROM "Candidatos" c
                            WHERE c."TenantId" = %s
                              AND c.embedding IS NOT NULL
                              AND c."Status" != 3

                            UNION ALL

                            SELECT
                                t."Id" AS person_id,
                                p."Nome" AS nome,
                                p."Email" AS email,
                                (1 - (t."Embedding" <=> %s::vector)) * 100 AS similaridade,
                                'talento' AS source
                            FROM "Talentos" t
                            JOIN "Pessoas" p ON p."Id" = t."PessoaId" AND p."TenantId" = t."TenantId"
                            WHERE t."TenantId" = %s AND t."Embedding" IS NOT NULL
                            AND NOT EXISTS (
                                SELECT 1 FROM "Candidatos" cx
                                WHERE cx."TalentoId" = t."Id"
                            )
                        )
                        SELECT person_id, nome, email, similaridade, source
                        FROM all_people
                        WHERE similaridade >= %s
                        ORDER BY similaridade DESC
                        LIMIT %s
                    """
                    params = [vaga_embedding, tid, vaga_embedding, tid, min_score, limit]
                else:
                    query = """
                        WITH all_people AS (
                            SELECT
                                c."Id" AS person_id,
                                c."Nome" AS nome,
                                c."Email" AS email,
                                (1 - (c.embedding <=> %s::vector)) * 100 AS similaridade,
                                'candidato' AS source
                            FROM "Candidatos" c
                            WHERE c.embedding IS NOT NULL
                              AND c."Status" != 3

                            UNION ALL

                            SELECT
                                t."Id" AS person_id,
                                p."Nome" AS nome,
                                p."Email" AS email,
                                (1 - (t."Embedding" <=> %s::vector)) * 100 AS similaridade,
                                'talento' AS source
                            FROM "Talentos" t
                            JOIN "Pessoas" p ON p."Id" = t."PessoaId"
                            WHERE t."Embedding" IS NOT NULL
                            AND NOT EXISTS (
                                SELECT 1 FROM "Candidatos" cx
                                WHERE cx."TalentoId" = t."Id"
                            )
                        )
                        SELECT person_id, nome, email, similaridade, source
                        FROM all_people
                        WHERE similaridade >= %s
                        ORDER BY similaridade DESC
                        LIMIT %s
                    """
                    params = [vaga_embedding, vaga_embedding, min_score, limit]

                cur.execute(query, params)
                rows = cur.fetchall()

        results = []
        for row in rows:
            similarity = max(0, min(100, int(row[3])))
            results.append({
                "person_id": str(row[0]),
                "nome": row[1] or "",
                "email": row[2] or "",
                "similaridade": similarity,
                "source": row[4],
            })

        return results

    except Exception as e:
        log.error("vector_search_unified_failed", extra={"ctx": {"vaga_id": vaga_id, "error": str(e)}})
        return []


def search_candidates_by_similarity(
    vaga_id: str,
    tenant_id: Optional[str] = None,
    limit: int = 100,
    min_score: int = 0
) -> list[dict[str, Any]]:
    """
    Busca candidatos por similaridade vetorial com uma vaga.
    (Mantida para retrocompatibilidade)
    """
    tid = tenant_id or TENANT_ID
    try:
        with pgvector_conn(tid) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    'SELECT embedding FROM "Vagas" WHERE "Id" = %s',
                    (vaga_id,)
                )
                row = cur.fetchone()

                if not row or row[0] is None:
                    return []

                vaga_embedding = row[0]

                where_clause = 'WHERE c."TenantId" = %s AND c.embedding IS NOT NULL' if tid else 'WHERE c.embedding IS NOT NULL'
                params = [vaga_embedding]
                if tid:
                    params.append(tid)
                params.extend([vaga_embedding, limit])

                query = f"""
                    SELECT
                        c."Id",
                        c."Nome",
                        c."Email",
                        (1 - (c.embedding <=> %s::vector)) * 100 AS similaridade
                    FROM "Candidatos" c
                    {where_clause}
                    ORDER BY c.embedding <=> %s::vector
                    LIMIT %s
                """

                cur.execute(query, params)
                rows = cur.fetchall()

        results = []
        for row in rows:
            similarity = max(0, min(100, int(row[3])))
            if similarity >= min_score:
                results.append({
                    "candidato_id": str(row[0]),
                    "nome": row[1] or "",
                    "email": row[2] or "",
                    "similaridade": similarity
                })

        return results

    except Exception as e:
        log.error("vector_search_candidatos_failed", extra={"ctx": {"vaga_id": vaga_id, "error": str(e)}})
        return []


def get_similarity_score(vaga_id: str, candidato_id: str, tenant_id: Optional[str] = None) -> Optional[int]:
    """
    Calcula score de similaridade entre uma vaga e um candidato específico.
    Returns: Score 0-100 ou None se não houver embeddings
    """
    tid = tenant_id or TENANT_ID
    try:
        with pgvector_conn(tid) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                        v.embedding AS vaga_emb,
                        c.embedding AS candidato_emb
                    FROM "Vagas" v
                    CROSS JOIN "Candidatos" c
                    WHERE v."Id" = %s AND c."Id" = %s
                    """,
                    (vaga_id, candidato_id)
                )
                row = cur.fetchone()

                if not row or row[0] is None or row[1] is None:
                    return None

                vaga_emb = row[0]
                candidato_emb = row[1]

                cur.execute(
                    "SELECT %s::vector <=> %s::vector AS distance",
                    (vaga_emb, candidato_emb)
                )
                distance = cur.fetchone()[0]

        similarity = (1 - float(distance)) * 100
        return max(0, min(100, int(similarity)))

    except Exception as e:
        log.error("similarity_score_failed", extra={"ctx": {"vaga_id": vaga_id, "candidato_id": candidato_id, "error": str(e)}})
        return None


def count_people_with_embeddings(tenant_id: Optional[str] = None) -> dict[str, int]:
    """
    Conta quantos candidatos e talentos têm embeddings gerados.
    Retorna dict com 'candidatos' e 'talentos'.
    """
    tid = tenant_id or TENANT_ID
    try:
        with db_conn(tid) as conn:
            with conn.cursor() as cur:
                where = 'WHERE "TenantId" = %s AND' if tid else 'WHERE'
                params = [tid] if tid else []

                cur.execute(
                    f'SELECT COUNT(*) FROM "Candidatos" {where} embedding IS NOT NULL',
                    params
                )
                count_cand = cur.fetchone()[0]

                cur.execute(
                    f'SELECT COUNT(*) FROM "Talentos" {where} "Embedding" IS NOT NULL',
                    params
                )
                count_tal = cur.fetchone()[0]

        return {"candidatos": count_cand, "talentos": count_tal}

    except Exception as e:
        log.error("count_embeddings_failed", extra={"ctx": {"tenant_id": tid, "error": str(e)}})
        return {"candidatos": 0, "talentos": 0}
