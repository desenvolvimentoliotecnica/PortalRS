
import psycopg2
import sys
from app.config import get_database_url, TENANT_ID

def log(msg):
    print(msg)
    sys.stdout.flush()

def check_candidates():
    log(f"Checking candidates for TENANT_ID: '{TENANT_ID}'")
    url = get_database_url(TENANT_ID)
    try:
        conn = psycopg2.connect(url)
        with conn.cursor() as cur:
            cur.execute('SELECT "Id", "Nome", "TenantId", "Status", (embedding IS NOT NULL) FROM "Candidatos" WHERE embedding IS NOT NULL')
            rows = cur.fetchall()
            log(f"Found {len(rows)} candidates with embedding:")
            for r in rows:
                log(f"ID: {r[0]} | Nome: {r[1]} | TenantId: '{r[2]}' | Status: {r[3]} | Emb: {r[4]}")

        conn.close()
    except Exception as e:
        log(f"Error: {e}")

if __name__ == "__main__":
    check_candidates()
