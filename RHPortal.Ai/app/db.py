"""
Consulta ao PostgreSQL: vagas (requisitos + filtros matching) e candidatos (perfil).
Tabelas: Vagas, VagaRequisitos, Candidatos, CandidatoCompetencias, Talentos,
TalentoCompetencias, TalentoExperiencias, TalentoFormacoes.
"""
import os
from typing import Any

from psycopg2.extras import RealDictCursor

from app.config import TENANT_ID
from app.database_pool import db_conn as _db_conn
from app.log import db as log

# Evita libpq ler PGPASSWORD etc. do ambiente (Windows).
for _k in ("PGPASSWORD", "PGUSER", "PGDATABASE", "PGHOST", "PGPORT"):
    os.environ.pop(_k, None)
# Força libpq a usar UTF-8 (evita UnicodeDecodeError ao decodificar mensagens no Windows).
os.environ["PGCLIENTENCODING"] = "UTF8"


def _conn(tenant_id: str | None = None):
    """Alias de compatibilidade — retorna context manager do pool."""
    return _db_conn(tenant_id)


# ─── Vaga ───────────────────────────────────────────────────────────────────

def get_vaga_perfil(vaga_id: str, tenant_id: str | None = None) -> dict[str, Any] | None:
    """Retorna perfil completo da vaga para matching: todos os campos + requisitos."""
    tid = tenant_id or TENANT_ID
    with _conn(tid) as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT "Id", "TenantId", "Codigo", "Titulo", "MatchingFiltrosRaw",
                       "Senioridade", "Modalidade", "Escolaridade",
                       "DescricaoInterna", "DescricaoPublica",
                       "Cidade", "Uf",
                       "TagsStackRaw", "TagsIdiomasRaw", "TagsKeywordsRaw", "Diferenciais",
                       "ExperienciaMinimaAnos", "FormacaoArea",
                       "QuantidadeVagas", "TipoContratacao",
                       "AceitaPcd", "ExigeCnh", "Urgente",
                       "ResumoPitch"
                FROM "Vagas"
                WHERE "Id" = %s AND ("TenantId" = %s OR %s = '')
                """,
                (vaga_id, tid, tid or ""),
            )
            row = cur.fetchone()
            if not row:
                return None
            vaga = dict(row)

            cur.execute(
                """
                SELECT "Nome", "SinonimosRaw", "Obrigatorio", "Peso", "AnosMinimos",
                       "Nivel", "Categoria"
                FROM "VagaRequisitos"
                WHERE "VagaId" = %s
                ORDER BY "Ordem", "Nome"
                """,
                (vaga_id,),
            )
            requisitos = [dict(r) for r in cur.fetchall()]
            vaga["requisitos"] = requisitos
            return vaga


# ─── Candidato ──────────────────────────────────────────────────────────────

def get_candidato_perfil(candidato_id: str, tenant_id: str | None = None) -> dict[str, Any] | None:
    """
    Retorna um único candidato com perfil para matching:
    id, Nome, Email, cv_text, resumo_profissional, cidade, uf, competencias (texto).
    """
    tid = tenant_id or TENANT_ID
    with _conn(tid) as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            where = 'c."Id" = %s AND c."TenantId" = %s' if tid else 'c."Id" = %s'
            params: list[Any] = [candidato_id, tid] if tid else [candidato_id]
            cur.execute(
                f"""
                SELECT c."Id", c."Nome", c."Email", c."CvText", c."ResumoProfissional", c."Cidade", c."Uf"
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
    with _conn(tid) as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            where = 'WHERE c."TenantId" = %s' if tid else "WHERE 1=1"
            params: list[Any] = [tid] if tid else []

            cur.execute(
                f"""
                SELECT c."Id", c."Nome", c."Email", c."CvText", c."ResumoProfissional", c."Cidade", c."Uf"
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

            ids = [str(c["Id"]) for c in candidatos]
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
                c["competencias"] = " ".join(by_cand.get(str(c["Id"]), []))
            return candidatos


# ─── Talento (Banco de Talentos) ────────────────────────────────────────────

def get_talento_perfil(talento_id: str, tenant_id: str | None = None) -> dict[str, Any] | None:
    """
    Retorna um talento completo com perfil para matching:
    Pessoa (Nome, Email, Cidade, UF, ResumoProfissional),
    Competências (Nome, Tipo, Nivel, TempoAtuacao),
    Experiências (Empresa, Cargo, Atividades, NivelSenioridade),
    Formação (Curso, Instituição, Tipo, Status).
    """
    tid = tenant_id or TENANT_ID
    with _conn(tid) as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Talento + Pessoa
            cur.execute(
                """
                SELECT t."Id", t."TenantId", t."CvProfileJson",
                       p."Nome", p."Email", p."Cidade", p."Uf",
                       p."ResumoProfissional", p."Fone", p."LinkedinUrl"
                FROM "Talentos" t
                JOIN "Pessoas" p ON p."Id" = t."PessoaId" AND p."TenantId" = t."TenantId"
                WHERE t."Id" = %s AND (t."TenantId" = %s OR %s = '')
                """,
                (talento_id, tid, tid or ""),
            )
            row = cur.fetchone()
            if not row:
                return None
            talento = dict(row)

            # Competências
            cur.execute(
                """
                SELECT "Nome", "Tipo", "Nivel", "TempoAtuacao", "Evidencia"
                FROM "TalentoCompetencias"
                WHERE "TalentoId" = %s
                ORDER BY "Nome"
                """,
                (talento_id,),
            )
            talento["competencias"] = [dict(r) for r in cur.fetchall()]

            # Experiências
            cur.execute(
                """
                SELECT "Empresa", "Cargo", "Inicio", "Fim",
                       "TipoContratacao", "Local", "Atividades",
                       "ResumoAtividades", "NivelSenioridade"
                FROM "TalentoExperiencias"
                WHERE "TalentoId" = %s
                ORDER BY "Inicio" DESC NULLS LAST
                """,
                (talento_id,),
            )
            talento["experiencias"] = [dict(r) for r in cur.fetchall()]

            # Formação
            cur.execute(
                """
                SELECT "Curso", "Instituicao", "Tipo", "Status", "Inicio", "Fim"
                FROM "TalentoFormacoes"
                WHERE "TalentoId" = %s
                ORDER BY "Inicio" DESC NULLS LAST
                """,
                (talento_id,),
            )
            talento["formacao"] = [dict(r) for r in cur.fetchall()]

            return talento


def get_talentos_ids(tenant_id: str | None = None) -> list[str]:
    """Retorna lista de IDs de todos os talentos do tenant (para geração em lote de embeddings)."""
    tid = tenant_id or TENANT_ID
    with _conn(tid) as conn:
        with conn.cursor() as cur:
            where = 'WHERE "TenantId" = %s' if tid else ""
            params: list[Any] = [tid] if tid else []
            cur.execute(f'SELECT "Id" FROM "Talentos" {where}', params)
            return [str(row[0]) for row in cur.fetchall()]


def get_talentos_ids_sem_embedding(tenant_id: str | None = None, limit: int = 50) -> list[str]:
    """Retorna IDs de talentos do tenant que ainda não têm embedding (para batch)."""
    tid = tenant_id or TENANT_ID
    with _conn(tid) as conn:
        with conn.cursor() as cur:
            where = 'WHERE "TenantId" = %s AND "Embedding" IS NULL' if tid else 'WHERE "Embedding" IS NULL'
            params: list[Any] = [tid] if tid else []
            cur.execute(f'SELECT "Id" FROM "Talentos" {where} LIMIT %s', params + [limit])
            return [str(row[0]) for row in cur.fetchall()]


def get_vagas_abertas_ids(tenant_id: str | None = None) -> list[str]:
    """Retorna IDs de vagas com status Aberta do tenant."""
    tid = tenant_id or TENANT_ID
    with _conn(tid) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT "Id" FROM "Vagas"
                WHERE "Status" = 2 AND ("TenantId" = %s OR %s = '')
                """,
                (tid, tid or ""),
            )
            return [str(row[0]) for row in cur.fetchall()]


# ─── Documentos PDF (Gemini v2) ────────────────────────────────────────────

def get_candidato_pdf_url(candidato_id: str, tenant_id: str | None = None) -> str | None:
    """
    Busca a URL do primeiro documento PDF do candidato (CV).
    Procura por Tipo = 0 (CV) ou qualquer documento com ContentType PDF.
    """
    tid = tenant_id or TENANT_ID
    try:
        with _conn(tid) as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT "Url", "StorageFileName", "NomeArquivo", "ContentType"
                    FROM "CandidatoDocumentos"
                    WHERE "CandidatoId" = %s
                      AND ("ContentType" ILIKE '%%pdf%%' OR "NomeArquivo" ILIKE '%%.pdf')
                    ORDER BY "Tipo", "CreatedAtUtc" DESC
                    LIMIT 1
                    """,
                    (candidato_id,),
                )
                row = cur.fetchone()
                if not row:
                    return None
                return row.get("Url") or row.get("StorageFileName") or None
    except Exception as e:
        log.error("get_pdf_failed", extra={"ctx": {"entity": "candidato", "id": candidato_id, "error": str(e)}})
        return None


def get_talento_pdf_url(talento_id: str, tenant_id: str | None = None) -> str | None:
    """
    Busca URL/path do primeiro documento PDF do talento (CV).
    """
    tid = tenant_id or TENANT_ID
    try:
        with _conn(tid) as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT "StorageFileName", "NomeArquivo", "ContentType"
                    FROM "TalentoDocumentos"
                    WHERE "TalentoId" = %s
                      AND ("ContentType" ILIKE '%%pdf%%' OR "NomeArquivo" ILIKE '%%.pdf')
                    ORDER BY "CreatedAtUtc" DESC
                    LIMIT 1
                    """,
                    (talento_id,),
                )
                row = cur.fetchone()
                if not row:
                    return None
                return row.get("StorageFileName") or None
    except Exception as e:
        log.error("get_pdf_failed", extra={"ctx": {"entity": "talento", "id": talento_id, "error": str(e)}})
        return None

