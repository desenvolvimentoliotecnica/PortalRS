
import sys
import psycopg2
from app.config import get_database_url, TENANT_ID

def log(msg):
    print(msg)
    sys.stdout.flush()

def check_vaga_tenant():
    url = get_database_url(TENANT_ID)
    log(f"Connecting to: {url.split('@')[-1]}")
    
    conn = psycopg2.connect(url)
    with conn.cursor() as cur:
        cur.execute('SELECT "Id", "Titulo", "TenantId" FROM "Vagas" WHERE "Id" = \'a0000001-0000-4000-8000-000000000001\'')
        row = cur.fetchone()
        if row:
            log(f"Vaga Found: {row[0]} | TenantId: '{row[2]}'")
        else:
            log("Vaga NOT found in this DB.")
    conn.close()

if __name__ == "__main__":
    check_vaga_tenant()
