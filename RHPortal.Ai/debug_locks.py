
import psycopg2
import sys
from app.config import get_database_url, TENANT_ID

def log(msg):
    print(msg)
    sys.stdout.flush()

def check_locks():
    log("Checking active queries and locks...")
    url = get_database_url(TENANT_ID)
    try:
        conn = psycopg2.connect(url)
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("""
                SELECT pid, usename, state, query_start, query
                FROM pg_stat_activity
                WHERE state != 'idle'
                AND pid != pg_backend_pid()
            """)
            rows = cur.fetchall()
            log(f"Active queries ({len(rows)}):")
            for r in rows:
                log(f"PID: {r[0]} | User: {r[1]} | State: {r[2]} | Start: {r[3]} | Query: {r[4]}")
                
            # Check locks
            log("\nChecking locks...")
            cur.execute("""
                SELECT t.relname, l.locktype, l.mode, l.granted, l.pid, a.query
                FROM pg_locks l
                JOIN pg_stat_activity a ON l.pid = a.pid
                JOIN pg_class t ON l.relation = t.oid
                WHERE t.relname IN ('Vagas', 'Candidatos', 'Talentos')
                AND l.granted = true
            """)
            locks = cur.fetchall()
            for l in locks:
                log(f"Rel: {l[0]} | Type: {l[1]} | Mode: {l[2]} | Pid: {l[4]} | Query: {l[5]}")

        conn.close()
    except Exception as e:
        log(f"Error: {e}")

if __name__ == "__main__":
    check_locks()
