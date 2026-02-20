
import sys
import psycopg2
from app.config import get_database_url

def log(msg):
    print(msg)
    sys.stdout.flush()

def search_correct():
    log("Starting search_correct...")
    # Force 'dev' as we saw in debug_candidates.py
    tid = "dev"
    url = get_database_url(tid)
    
    try:
        conn = psycopg2.connect(url)
        vaga_id = "a0000001-0000-4000-8000-000000000001"
        limit = 10
        min_score = 0
        
        with conn.cursor() as cur:
            # 1. Get Vaga Embedding
            cur.execute('SELECT embedding FROM "Vagas" WHERE "Id" = %s', (vaga_id,))
            row = cur.fetchone()
            if not row or not row[0]:
                log("Vaga embedding not found.")
                return
            vaga_embedding = row[0]

            # 2. Run Query with correct query for tenant
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
            log(f"Query returned {len(rows)} matching candidates for tenant '{tid}'.")
            for r in rows:
                 log(f"- {r[1]} ({r[4]}): {r[3]}")

        conn.close()

    except Exception as e:
        log(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    search_correct()
