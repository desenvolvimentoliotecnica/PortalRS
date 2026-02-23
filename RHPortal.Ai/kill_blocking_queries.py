
import psycopg2
import sys
from app.config import get_database_url, TENANT_ID

def log(msg):
    print(msg)
    sys.stdout.flush()

def kill_blocking():
    log("Checking for blocking queries to kill...")
    url = get_database_url(TENANT_ID)
    try:
        conn = psycopg2.connect(url)
        conn.autocommit = True
        with conn.cursor() as cur:
            # Find PIDs blocking Vagas/Candidatos/Talentos
            # Actually just kill any active query older than 1 minute or specific stuck ones
            # But let's be specific to our problem tables
            
            query = """
                SELECT pid, usename, state, query_start, query
                FROM pg_stat_activity
                WHERE state != 'idle'
                AND pid != pg_backend_pid()
                AND query ILIKE '%Vagas%'
            """
            cur.execute(query)
            rows = cur.fetchall()
            
            for r in rows:
                pid = r[0]
                q_text = r[4]
                log(f"Killing PID {pid} running: {q_text[:100]}...")
                try:
                    cur.execute(f"SELECT pg_terminate_backend({pid})")
                    log("Killed.")
                except Exception as e:
                    log(f"Failed to kill {pid}: {e}")

        conn.close()
        log("Done.")
    except Exception as e:
        log(f"Error: {e}")

if __name__ == "__main__":
    kill_blocking()
