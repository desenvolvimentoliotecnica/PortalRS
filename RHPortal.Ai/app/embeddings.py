"""
Módulo para geração e gerenciamento de embeddings.
Usa OpenAI text-embedding-3-small para gerar vetores de 1536 dimensões.

Gera "texto canônico" rico a partir de TODOS os dados disponíveis
para maximizar a densidade semântica dos embeddings.
"""
from typing import Any, Optional

from app.config import DATABASE_URL, EMBEDDING_PROVIDER, get_database_url
from app.database_pool import pgvector_conn
from app.llm_factory import get_embeddings_client
from app.log import embeddings as log
from app.retry import openai_retry
from app.vector_search import ensure_pgvector_extension


def get_embeddings_model() -> Any:
    """Retorna modelo de embeddings do provider ativo (openai|gemini|ollama).

    O provider é controlado por `EMBEDDING_PROVIDER` (.env).
    Mantida esta função como wrapper para compat retroativa com chamadores
    externos que já a usavam. Novos usos devem chamar `get_embeddings_client()`
    diretamente.
    """
    return get_embeddings_client()


# ─── Texto Canônico: Vaga ──────────────────────────────────────────────────

def _build_vaga_text_for_embedding(vaga: dict[str, Any]) -> str:
    """
    Monta texto canônico COMPLETO da vaga para gerar embedding.
    Inclui todos os campos estruturados + filtros + requisitos.
    Quanto mais rico o texto, melhor o matching vetorial.
    """
    parts = []

    # Identificação
    titulo = vaga.get("Titulo") or ""
    if titulo:
        parts.append(f"Vaga: {titulo}")

    codigo = vaga.get("Codigo") or ""
    if codigo:
        parts.append(f"Código: {codigo}")

    # Contexto da vaga
    senioridade = vaga.get("Senioridade")
    if senioridade is not None:
        parts.append(f"Senioridade: {_enum_to_text('senioridade', senioridade)}")

    modalidade = vaga.get("Modalidade")
    if modalidade is not None:
        parts.append(f"Modalidade: {_enum_to_text('modalidade', modalidade)}")

    escolaridade = vaga.get("Escolaridade")
    if escolaridade is not None:
        parts.append(f"Escolaridade: {_enum_to_text('escolaridade', escolaridade)}")

    formacao_area = vaga.get("FormacaoArea")
    if formacao_area is not None:
        parts.append(f"Formação: {_enum_to_text('formacao_area', formacao_area)}")

    tipo_contratacao = vaga.get("TipoContratacao")
    if tipo_contratacao is not None:
        parts.append(f"Tipo contratação: {_enum_to_text('tipo_contratacao', tipo_contratacao)}")

    exp_min = vaga.get("ExperienciaMinimaAnos")
    if exp_min is not None:
        parts.append(f"Experiência mínima: {exp_min} anos")

    # Localização
    cidade = vaga.get("Cidade") or ""
    uf = vaga.get("Uf") or ""
    if cidade or uf:
        parts.append(f"Localização: {cidade} {uf}".strip())

    # Descrições
    desc_interna = vaga.get("DescricaoInterna") or ""
    if desc_interna:
        parts.append(f"Descrição: {desc_interna[:2000]}")

    desc_publica = vaga.get("DescricaoPublica") or ""
    if desc_publica and desc_publica != desc_interna:
        parts.append(f"Descrição pública: {desc_publica[:2000]}")

    resumo_pitch = vaga.get("ResumoPitch") or ""
    if resumo_pitch:
        parts.append(f"Resumo: {resumo_pitch}")

    # Stack e idiomas
    stack = vaga.get("TagsStackRaw") or ""
    if stack:
        parts.append(f"Stack tecnológica: {stack.replace(';', ', ')}")

    keywords = vaga.get("TagsKeywordsRaw") or ""
    if keywords:
        parts.append(f"Palavras-chave da vaga: {keywords.replace(';', ', ')}")

    idiomas = vaga.get("TagsIdiomasRaw") or ""
    if idiomas:
        parts.append(f"Idiomas: {idiomas.replace(';', ', ')}")

    diferenciais = vaga.get("Diferenciais") or ""
    if diferenciais:
        parts.append(f"Diferenciais: {diferenciais}")

    # Flags
    flags = []
    if vaga.get("AceitaPcd"):
        flags.append("Aceita PCD")
    if vaga.get("ExigeCnh"):
        flags.append("Exige CNH")
    if vaga.get("Urgente"):
        flags.append("URGENTE")
    if flags:
        parts.append(f"Observações: {', '.join(flags)}")

    # Filtros de matching (texto bruto do operador)
    filtros_raw = vaga.get("MatchingFiltrosRaw") or ""
    if filtros_raw:
        parts.append(f"Filtros de matching: {filtros_raw}")

    # Requisitos detalhados
    reqs = vaga.get("requisitos") or []
    if reqs:
        req_texts = []
        for r in reqs:
            nome = (r.get("Nome") or "").strip()
            if not nome:
                continue
            syn = (r.get("SinonimosRaw") or "").strip()
            obrig = "obrigatório" if r.get("Obrigatorio") else "desejável"
            peso = r.get("Peso", 1)
            nivel = r.get("Nivel") or ""
            text = f"{nome} ({obrig}, peso {peso})"
            if syn:
                text += f" [sinônimos: {syn}]"
            if nivel:
                text += f" [nível: {nivel}]"
            req_texts.append(text)
        if req_texts:
            parts.append("Requisitos:\n" + "\n".join(f"- {rt}" for rt in req_texts))

    return "\n".join(parts) if parts else "Vaga sem descrição"


# ─── Texto Canônico: Candidato ─────────────────────────────────────────────

def _build_candidato_text_for_embedding(candidato: dict[str, Any]) -> str:
    """
    Monta texto canônico do candidato para gerar embedding.
    Inclui: nome, resumo profissional, CV, competências, localização.
    """
    parts = []

    if candidato.get("Nome"):
        parts.append(f"Candidato: {candidato['Nome']}")

    if candidato.get("resumo_profissional"):
        parts.append(candidato["resumo_profissional"])

    if candidato.get("cv_text"):
        # Limita CV a 8000 caracteres para não explodir tokens
        cv = candidato["cv_text"][:8000]
        parts.append(cv)

    if candidato.get("competencias"):
        parts.append(f"Habilidades: {candidato['competencias']}")

    # Localização
    if candidato.get("cidade") or candidato.get("uf"):
        loc = f"{candidato.get('cidade') or ''} {candidato.get('uf') or ''}".strip()
        if loc:
            parts.append(f"Localização: {loc}")

    return "\n".join(parts) if parts else "Candidato sem perfil"


# ─── Texto Canônico: Talento ───────────────────────────────────────────────

def _build_talento_text_for_embedding(talento: dict[str, Any]) -> str:
    """
    Monta texto canônico COMPLETO do talento para gerar embedding.
    Usa dados ricos: Competências (tipo, nível, tempo), Experiências (cargo,
    atividades, senioridade), Formação (curso, instituição) e localização.
    """
    parts = []

    nome = talento.get("Nome") or ""
    if nome:
        parts.append(f"Profissional: {nome}")

    resumo = talento.get("ResumoProfissional") or ""
    if resumo:
        parts.append(resumo)

    # CvProfileJson como texto de apoio
    cv_json = talento.get("CvProfileJson") or ""
    if cv_json:
        parts.append(f"Perfil CV: {cv_json[:4000]}")

    # Competências (dados muito ricos)
    comps = talento.get("competencias") or []
    if comps:
        comp_texts = []
        for c in comps:
            nome_c = (c.get("Nome") or "").strip()
            if not nome_c:
                continue
            tipo = (c.get("Tipo") or "").strip()
            nivel = (c.get("Nivel") or "").strip()
            tempo = (c.get("TempoAtuacao") or "").strip()
            text = nome_c
            if tipo:
                text += f" ({tipo})"
            if nivel:
                text += f" nível {nivel}"
            if tempo:
                text += f" {tempo}"
            comp_texts.append(text)
        if comp_texts:
            parts.append("Competências: " + ", ".join(comp_texts))

    # Experiências profissionais
    exps = talento.get("experiencias") or []
    if exps:
        exp_texts = []
        for e in exps:
            cargo = (e.get("Cargo") or "").strip()
            empresa = (e.get("Empresa") or "").strip()
            if not cargo and not empresa:
                continue
            inicio = (e.get("Inicio") or "").strip()
            fim = (e.get("Fim") or "atual").strip()
            senioridade = (e.get("NivelSenioridade") or "").strip()
            atividades = (e.get("ResumoAtividades") or e.get("Atividades") or "").strip()

            text = f"{cargo} em {empresa}"
            if inicio:
                text += f" ({inicio} - {fim})"
            if senioridade:
                text += f" [{senioridade}]"
            if atividades:
                text += f": {atividades[:500]}"
            exp_texts.append(text)
        if exp_texts:
            parts.append("Experiência profissional:\n" + "\n".join(f"- {et}" for et in exp_texts))

    # Formação acadêmica
    forms = talento.get("formacao") or []
    if forms:
        form_texts = []
        for f in forms:
            curso = (f.get("Curso") or "").strip()
            inst = (f.get("Instituicao") or "").strip()
            tipo = (f.get("Tipo") or "").strip()
            status = (f.get("Status") or "").strip()
            if not curso:
                continue
            text = curso
            if inst:
                text += f" - {inst}"
            if tipo:
                text += f" ({tipo})"
            if status:
                text += f" [{status}]"
            form_texts.append(text)
        if form_texts:
            parts.append("Formação: " + "; ".join(form_texts))

    # Localização
    cidade = talento.get("Cidade") or ""
    uf = talento.get("Uf") or ""
    if cidade or uf:
        parts.append(f"Localização: {cidade} {uf}".strip())

    return "\n".join(parts) if parts else "Talento sem perfil"


# ─── Enum helpers ───────────────────────────────────────────────────────────

_ENUM_MAPS = {
    "senioridade": {0: "Estagiário", 1: "Trainee", 2: "Júnior", 3: "Pleno", 4: "Sênior", 5: "Especialista", 6: "Líder"},
    "modalidade": {0: "Presencial", 1: "Remoto", 2: "Híbrido"},
    "escolaridade": {0: "Fundamental", 1: "Médio", 2: "Técnico", 3: "Superior", 4: "Pós-graduação", 5: "Mestrado", 6: "Doutorado"},
    "formacao_area": {0: "TI", 1: "Engenharia", 2: "Administração", 3: "Direito", 4: "Saúde", 5: "Comunicação", 6: "Educação", 7: "Outro"},
    "tipo_contratacao": {0: "CLT", 1: "PJ", 2: "Temporário", 3: "Estágio", 4: "Freelancer", 5: "Outro"},
}


def _enum_to_text(enum_name: str, value: Any) -> str:
    """Converte valor de enum numérico para texto legível."""
    if value is None:
        return ""
    m = _ENUM_MAPS.get(enum_name, {})
    return m.get(value, str(value))


# ─── Geração de Embeddings ─────────────────────────────────────────────────

@openai_retry
def _embed_text(text: str) -> list[float]:
    """Gera embedding via OpenAI com retry automático."""
    return get_embeddings_model().embed_query(text)


def generate_vaga_embedding(vaga: dict[str, Any]) -> list[float]:
    """Gera embedding para uma vaga via provider configurado."""
    text = _build_vaga_text_for_embedding(vaga)
    return _embed_text(text)


def generate_candidato_embedding(candidato: dict[str, Any]) -> list[float]:
    """Gera embedding para um candidato via provider configurado."""
    text = _build_candidato_text_for_embedding(candidato)
    return _embed_text(text)


def generate_talento_embedding(talento: dict[str, Any]) -> list[float]:
    """Gera embedding para um talento via provider configurado."""
    text = _build_talento_text_for_embedding(talento)
    return _embed_text(text)


# ─── Salvar Embeddings no Banco ────────────────────────────────────────────

def save_vaga_embedding(vaga_id: str, embedding: list[float], tenant_id: Optional[str] = None) -> bool:
    """Salva embedding de uma vaga no banco de dados."""
    tid = tenant_id or None
    try:
        with pgvector_conn(tid) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE "Vagas"
                    SET embedding = %s::vector,
                        embedding_generated_at_utc = NOW()
                    WHERE "Id" = %s
                    """,
                    (embedding, vaga_id)
                )
                conn.commit()
        log.info("embedding_saved", extra={"ctx": {"entity": "vaga", "id": vaga_id}})
        return True
    except Exception as e:
        log.error("embedding_save_failed", extra={"ctx": {"entity": "vaga", "id": vaga_id, "error": str(e)}})
        return False


def save_candidato_embedding(candidato_id: str, embedding: list[float], tenant_id: Optional[str] = None) -> bool:
    """Salva embedding de um candidato no banco de dados."""
    tid = tenant_id or None
    try:
        with pgvector_conn(tid) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE "Candidatos"
                    SET embedding = %s::vector,
                        embedding_generated_at_utc = NOW()
                    WHERE "Id" = %s
                    """,
                    (embedding, candidato_id)
                )
                conn.commit()
        log.info("embedding_saved", extra={"ctx": {"entity": "candidato", "id": candidato_id}})
        return True
    except Exception as e:
        log.error("embedding_save_failed", extra={"ctx": {"entity": "candidato", "id": candidato_id, "error": str(e)}})
        return False


def save_talento_embedding(talento_id: str, embedding: list[float], tenant_id: Optional[str] = None) -> bool:
    """Salva embedding de um talento no banco de dados."""
    tid = tenant_id or None
    try:
        with pgvector_conn(tid) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE "Talentos"
                    SET "Embedding" = %s::vector,
                        "EmbeddingGeneratedAtUtc" = NOW()
                    WHERE "Id" = %s
                    """,
                    (embedding, talento_id)
                )
                conn.commit()
        log.info("embedding_saved", extra={"ctx": {"entity": "talento", "id": talento_id}})
        return True
    except Exception as e:
        log.error("embedding_save_failed", extra={"ctx": {"entity": "talento", "id": talento_id, "error": str(e)}})
        return False


# ─── Buscar Embeddings ─────────────────────────────────────────────────────

def get_vaga_embedding(vaga_id: str, tenant_id: Optional[str] = None) -> Optional[list[float]]:
    """Busca embedding de uma vaga no banco."""
    tid = tenant_id or None
    try:
        with pgvector_conn(tid) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    'SELECT embedding FROM "Vagas" WHERE "Id" = %s',
                    (vaga_id,)
                )
                row = cur.fetchone()
        return row[0] if row and row[0] is not None else None
    except Exception as e:
        log.error("embedding_get_failed", extra={"ctx": {"entity": "vaga", "id": vaga_id, "error": str(e)}})
        return None


def get_candidato_embedding(candidato_id: str, tenant_id: Optional[str] = None) -> Optional[list[float]]:
    """Busca embedding de um candidato no banco."""
    tid = tenant_id or None
    try:
        with pgvector_conn(tid) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    'SELECT embedding FROM "Candidatos" WHERE "Id" = %s',
                    (candidato_id,)
                )
                row = cur.fetchone()
        return row[0] if row and row[0] is not None else None
    except Exception as e:
        log.error("embedding_get_failed", extra={"ctx": {"entity": "candidato", "id": candidato_id, "error": str(e)}})
        return None


def get_talento_embedding(talento_id: str, tenant_id: Optional[str] = None) -> Optional[list[float]]:
    """Busca embedding de um talento no banco."""
    tid = tenant_id or None
    try:
        with pgvector_conn(tid) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    'SELECT "Embedding" FROM "Talentos" WHERE "Id" = %s',
                    (talento_id,)
                )
                row = cur.fetchone()
        return row[0] if row and row[0] is not None else None
    except Exception as e:
        log.error("embedding_get_failed", extra={"ctx": {"entity": "talento", "id": talento_id, "error": str(e)}})
        return None
