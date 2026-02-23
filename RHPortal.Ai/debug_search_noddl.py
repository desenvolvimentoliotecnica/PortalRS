
import sys
import psycopg2
from app.config import get_database_url, TENANT_ID

def log(msg):
    print(msg)
    sys.stdout.flush()

def search_noddl():
    log("Starting search_noddl...")
    url = get_database_url(TENANT_ID)
    try:
        conn = psycopg2.connect(url)
        conn.autocommit = True
        
        vaga_id = "a0000001-0000-4000-8000-000000000001"
        limit = 10
        min_score = 0
        tid = TENANT_ID
        
        with conn.cursor() as cur:
            # 1. Get Vaga Embedding
            log("Fetching Vaga embedding...")
            cur.execute('SELECT embedding FROM "Vagas" WHERE "Id" = %s', (vaga_id,))
            row = cur.fetchone()
            if not row or not row[0]:
                log("Vaga embedding not found or null.")
                return
            vaga_embedding = row[0]
            log("Vaga embedding found.")

            # 2. Run Query
            log("Running similarity query...")
            # Query copied from vector_search.py
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
            
            cur.execute(query, params)
            rows = cur.fetchall()
            log(f"Query returned {len(rows)} rows.")
            for r in rows:
                 log(f"- {r[1]} ({r[4]}): {r[3]}")

        conn.close()
        log("Done.")

    except Exception as e:
        log(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    search_noddl()
