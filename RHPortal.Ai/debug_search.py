
import sys
from app.config import get_database_url, TENANT_ID

def log(msg):
    print(msg)
    sys.stdout.flush()

def search():
    log("Importing vector_search...")
    try:
        from app.vector_search import search_all_by_similarity
        log("Imported.")
        
        vaga_id = "a0000001-0000-4000-8000-000000000001" # Extracted from previous run
        log(f"Searching for {vaga_id}...")
        
        results = search_all_by_similarity(vaga_id, TENANT_ID, limit=10, min_score=0)
        log(f"Results: {len(results)}")
        for r in results:
            log(f" - {r['nome']} ({r['source']}): {r['similaridade']}%")
            
    except Exception as e:
        log(f"Error during search: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    search()
