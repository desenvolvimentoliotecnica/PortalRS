
import os
import sys
import psycopg2
import time
from app.config import get_database_url, TENANT_ID

def log(msg):
    print(msg)
    sys.stdout.flush()

def check_db_status():
    log("Starting check_db_status...")
    url = get_database_url(TENANT_ID)
    log(f"Connecting to DB: {url.split('@')[-1]}") 
    
    try:
        conn = psycopg2.connect(url)
        conn.autocommit = True
        log("Connected.")
        
        with conn.cursor() as cur:
            # 1. Check Vagas
            log("\n--- Recent Vagas ---")
            cur.execute("""
                SELECT "Id", "Titulo", "Codigo", 
                       (embedding IS NOT NULL) as has_embedding,
                       embedding_generated_at_utc
                FROM "Vagas"
                ORDER BY "CreatedAtUtc" DESC
                LIMIT 5
            """)
            vagas = cur.fetchall()
            log(f"Found {len(vagas)} vagas.")
            
            target_vaga_id = None
            for v in vagas:
                vid, title, code, has_emb, gen_at = v
                log(f"ID: {vid} | Title: {title} | Code: {code} | Has Embedding: {has_emb} | Generated At: {gen_at}")
                if not target_vaga_id:
                    target_vaga_id = vid

            # 2. Check counts
            log("\n--- Embedding Counts ---")
            cur.execute('SELECT COUNT(*) FROM "Candidatos" WHERE embedding IS NOT NULL')
            cand_count = cur.fetchone()[0]
            log(f"Candidatos with embedding: {cand_count}")
            
            try:
                cur.execute('SELECT COUNT(*) FROM "Talentos" WHERE "Embedding" IS NOT NULL')
                tal_count = cur.fetchone()[0]
                log(f"Talentos with embedding: {tal_count}")
            except Exception as e:
                log(f"Talentos check failed: {e}")

            # 3. Test Search if vaga exists
            if target_vaga_id:
                log(f"\n--- Test Search for Vaga {target_vaga_id} ---")
                # Import here to isolate errors
                try:
                    from app.vector_search import search_all_by_similarity
                    log("Imported search_all_by_similarity.")
                    
                    results = search_all_by_similarity(str(target_vaga_id), TENANT_ID, limit=5, min_score=0)
                    log(f"Search Results Count: {len(results)}")
                    for r in results:
                        log(f" - {r['nome']} ({r['source']}): {r['similaridade']}%")
                except Exception as e:
                    log(f"Search failed: {e}")
                    import traceback
                    traceback.print_exc()

        conn.close()
        log("\nDone.")

    except Exception as e:
        log(f"DB Connection or Execution failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_db_status()
