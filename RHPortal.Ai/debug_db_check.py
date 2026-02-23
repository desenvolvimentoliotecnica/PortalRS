
import psycopg2
import sys
from app.config import get_database_url, TENANT_ID

def log(msg):
    print(msg)
    sys.stdout.flush()

def check():
    log("Checking DB counts...")
    url = get_database_url(TENANT_ID)
    conn = psycopg2.connect(url)
    
    with conn.cursor() as cur:
        # Check Candidates
        cur.execute('SELECT COUNT(*) FROM "Candidatos" WHERE embedding IS NOT NULL')
        c = cur.fetchone()[0]
        log(f"Candidatos with embedding: {c}")

        # Check Talentos
        try:
            cur.execute('SELECT COUNT(*) FROM "Talentos" WHERE "Embedding" IS NOT NULL')
            t = cur.fetchone()[0]
            log(f"Talentos with embedding: {t}")
        except Exception as e:
            log(f"Talentos error: {e}")

        # Check Vagas
        log("Checking recent vagas...")
        cur.execute('SELECT "Id", "Titulo", (embedding IS NOT NULL) FROM "Vagas" ORDER BY "CreatedAtUtc" DESC LIMIT 3')
        for row in cur.fetchall():
            log(f"Vaga: {row[0]} | {row[1]} | HasEmb: {row[2]}")

    conn.close()

if __name__ == "__main__":
    check()
