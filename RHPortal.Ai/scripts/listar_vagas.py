"""
Lista vagas no banco (Id, Titulo, TenantId, Status) para validar qual vaga existe
e qual tenant_id usar no matching.
Rode: python scripts/listar_vagas.py [tenant_id]
Ex.: python scripts/listar_vagas.py liotecnica  -> lista do banco dev_render_liotecnica
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import psycopg2
from psycopg2.extras import RealDictCursor

from app.config import get_database_url

def run():
    tenant = sys.argv[1].strip() if len(sys.argv) > 1 else None
    url = get_database_url(tenant)
    if not url:
        print("ERRO: DATABASE_URL não configurada")
        return 1
    db_name = url.split("/")[-1].split("?")[0] if "/" in url else "?"
    print(f"Banco: {db_name}\n")
    conn = psycopg2.connect(url)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT "Id", "Titulo", "TenantId", "Status", "Codigo"
                FROM "Vagas"
                ORDER BY "Titulo"
                """
            )
            rows = cur.fetchall()
        print(f"Total de vagas no banco: {len(rows)}\n")
        print(f"{'Id':<38} {'TenantId':<20} {'Status':<6} {'Titulo'}")
        print("-" * 120)
        status_map = {0: "NaoInf", 1: "Rascunho", 2: "Aberta", 3: "Pausada", 4: "Triagem", 5: "Entrevistas", 6: "Oferta", 7: "Encerrada", 8: "Cancelada"}
        for r in rows:
            sid = r["Status"]
            status = status_map.get(sid, str(sid))
            titulo = (r["Titulo"] or "")[:50]
            print(f'{r["Id"]} {str(r["TenantId"]):<20} {status:<6} {titulo}')
        return 0
    finally:
        conn.close()

if __name__ == "__main__":
    sys.exit(run())
