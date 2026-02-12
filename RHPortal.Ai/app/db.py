"""
Consulta ao PostgreSQL: vagas (requisitos + filtros matching) e candidatos (perfil).
Tabelas: Vagas, VagaRequisitos, Candidatos, CandidatoCompetencias.
"""
from typing import Any

import psycopg2
from psycopg2.extras import RealDictCursor

from app.config import DATABASE_URL, TENANT_ID


def _conn(tenant_id: str | None = None):
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL não configurada")
    return psycopg2.connect(DATABASE_URL)


def get_vaga_perfil(vaga_id: str, tenant_id: str | None = None) -> dict[str, Any] | None:
    """Retorna título, MatchingFiltrosRaw e lista de requisitos (Nome, SinonimosRaw) da vaga."""
    tid = tenant_id or TENANT_ID
    with _conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, "TenantId", "Codigo", "Titulo", "MatchingFiltrosRaw"
                FROM "Vagas"
                WHERE id = %s AND ("TenantId" = %s OR %s = '')
                """,
                (vaga_id, tid, tid or ""),
            )
            row = cur.fetchone()
            if not row:
                return None
            vaga = dict(row)

            cur.execute(
                """
                SELECT "Nome", "SinonimosRaw", "Obrigatorio"
                FROM "VagaRequisitos"
                WHERE "VagaId" = %s
                ORDER BY "Ordem", "Nome"
                """,
                (vaga_id,),
            )
            requisitos = [dict(r) for r in cur.fetchall()]
            vaga["requisitos"] = requisitos
            return vaga


def get_candidato_perfil(candidato_id: str, tenant_id: str | None = None) -> dict[str, Any] | None:
    """
    Retorna um único candidato com perfil para matching:
    id, Nome, Email, cv_text, resumo_profissional, cidade, uf, competencias (texto).
    """
    tid = tenant_id or TENANT_ID
    with _conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            where = 'c.id = %s AND c."TenantId" = %s' if tid else "c.id = %s"
            params: list[Any] = [candidato_id, tid] if tid else [candidato_id]
            cur.execute(
                f"""
                SELECT c.id, c."Nome", c."Email", c."CvText", c."ResumoProfissional", c."Cidade", c."Uf"
                FROM "Candidatos" c
                WHERE {where}
                """,
                params,
            )
            row = cur.fetchone()
            if not row:
                return None
            c = dict(row)
            c["cv_text"] = c.pop("CvText", None) or ""
            c["resumo_profissional"] = c.pop("ResumoProfissional", None) or ""
            c["cidade"] = c.pop("Cidade", None) or ""
            c["uf"] = c.pop("Uf", None) or ""
            cur.execute(
                """
                SELECT "Nome" FROM "CandidatoCompetencias"
                WHERE "CandidatoId" = %s ORDER BY "Nome"
                """,
                (candidato_id,),
            )
            comps = [(r["Nome"] or "").strip() for r in cur.fetchall()]
            c["competencias"] = " ".join(x for x in comps if x)
            return c


def get_candidatos_perfis(tenant_id: str | None = None) -> list[dict[str, Any]]:
    """
    Retorna lista de candidatos do tenant com perfil para matching:
    id, nome, email, cv_text, resumo_profissional, cidade, uf, competencias (texto).
    A IA fará a filtragem por similaridade com a vaga.
    """
    tid = tenant_id or TENANT_ID
    with _conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            where = 'WHERE c."TenantId" = %s' if tid else "WHERE 1=1"
            params: list[Any] = [tid] if tid else []

            cur.execute(
                f"""
                SELECT c.id, c."Nome", c."Email", c."CvText", c."ResumoProfissional", c."Cidade", c."Uf"
                FROM "Candidatos" c
                {where}
                ORDER BY c."Nome"
                """,
                params,
            )
            rows = cur.fetchall()
            candidatos = []
            for r in rows:
                c = dict(r)
                c["cv_text"] = c.pop("CvText", None) or ""
                c["resumo_profissional"] = c.pop("ResumoProfissional", None) or ""
                c["cidade"] = c.pop("Cidade", None) or ""
                c["uf"] = c.pop("Uf", None) or ""
                candidatos.append(c)

            if not candidatos:
                return []

            ids = [str(c["id"]) for c in candidatos]
            cur.execute(
                """
                SELECT "CandidatoId", "Nome", "Tipo", "Nivel"
                FROM "CandidatoCompetencias"
                WHERE "CandidatoId" = ANY(%s)
                ORDER BY "CandidatoId", "Nome"
                """,
                (ids,),
            )
            comps = cur.fetchall()
            by_cand: dict[str, list[str]] = {}
            for row in comps:
                cid = str(row["CandidatoId"])
                by_cand.setdefault(cid, []).append((row["Nome"] or "").strip())
            for c in candidatos:
                c["competencias"] = " ".join(by_cand.get(str(c["id"]), []))
            return candidatos
