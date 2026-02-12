"""
Módulo para geração e gerenciamento de embeddings.
Usa OpenAI text-embedding-3-small para gerar vetores de 1536 dimensões.
"""
from typing import Any, Optional
import psycopg2
from pgvector.psycopg2 import register_vector
from langchain_openai import OpenAIEmbeddings

from app.config import DATABASE_URL, OPENAI_API_KEY, EMBEDDING_MODEL


def get_embeddings_model() -> OpenAIEmbeddings:
    """Retorna modelo de embeddings configurado."""
    return OpenAIEmbeddings(
        model=EMBEDDING_MODEL,
        openai_api_key=OPENAI_API_KEY,
    )


def _build_vaga_text_for_embedding(vaga: dict[str, Any]) -> str:
    """
    Monta texto representativo da vaga para gerar embedding.
    Inclui: título, filtros de matching, requisitos.
    """
    parts = []
    
    if vaga.get("Titulo"):
        parts.append(f"Vaga: {vaga['Titulo']}")
    
    if vaga.get("MatchingFiltrosRaw"):
        parts.append(f"Requisitos: {vaga['MatchingFiltrosRaw']}")
    
    # Requisitos adicionais
    reqs = vaga.get("requisitos") or []
    if reqs:
        req_texts = []
        for r in reqs:
            nome = (r.get("Nome") or "").strip()
            syn = (r.get("SinonimosRaw") or "").strip()
            if nome:
                req_texts.append(nome if not syn else f"{nome} ({syn})")
        if req_texts:
            parts.append("Habilidades: " + ", ".join(req_texts))
    
    return "\n".join(parts) if parts else "Vaga sem descrição"


def _build_candidato_text_for_embedding(candidato: dict[str, Any]) -> str:
    """
    Monta texto representativo do candidato para gerar embedding.
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


def generate_vaga_embedding(vaga: dict[str, Any]) -> list[float]:
    """
    Gera embedding para uma vaga.
    Retorna vetor de 1536 dimensões.
    """
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY não configurada")
    
    embeddings = get_embeddings_model()
    text = _build_vaga_text_for_embedding(vaga)
    return embeddings.embed_query(text)


def generate_candidato_embedding(candidato: dict[str, Any]) -> list[float]:
    """
    Gera embedding para um candidato.
    Retorna vetor de 1536 dimensões.
    """
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY não configurada")
    
    embeddings = get_embeddings_model()
    text = _build_candidato_text_for_embedding(candidato)
    return embeddings.embed_query(text)


def save_vaga_embedding(vaga_id: str, embedding: list[float]) -> bool:
    """
    Salva embedding de uma vaga no banco de dados.
    Retorna True se sucesso.
    """
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL não configurada")
    
    try:
        conn = psycopg2.connect(DATABASE_URL)
        register_vector(conn)
        
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE "Vagas" 
                SET "Embedding" = %s::vector,
                    "EmbeddingGeneratedAtUtc" = NOW()
                WHERE id = %s
                """,
                (embedding, vaga_id)
            )
            conn.commit()
        
        conn.close()
        return True
    except Exception as e:
        print(f"Erro ao salvar embedding da vaga {vaga_id}: {e}")
        return False


def save_candidato_embedding(candidato_id: str, embedding: list[float]) -> bool:
    """
    Salva embedding de um candidato no banco de dados.
    Retorna True se sucesso.
    """
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL não configurada")
    
    try:
        conn = psycopg2.connect(DATABASE_URL)
        register_vector(conn)
        
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE "Candidatos" 
                SET "Embedding" = %s::vector,
                    "EmbeddingGeneratedAtUtc" = NOW()
                WHERE id = %s
                """,
                (embedding, candidato_id)
            )
            conn.commit()
        
        conn.close()
        return True
    except Exception as e:
        print(f"Erro ao salvar embedding do candidato {candidato_id}: {e}")
        return False


def get_vaga_embedding(vaga_id: str) -> Optional[list[float]]:
    """
    Busca embedding de uma vaga no banco.
    Retorna None se não encontrado ou ainda não gerado.
    """
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL não configurada")
    
    try:
        conn = psycopg2.connect(DATABASE_URL)
        register_vector(conn)
        
        with conn.cursor() as cur:
            cur.execute(
                'SELECT "Embedding" FROM "Vagas" WHERE id = %s',
                (vaga_id,)
            )
            row = cur.fetchone()
        
        conn.close()
        return row[0] if row and row[0] else None
    except Exception as e:
        print(f"Erro ao buscar embedding da vaga {vaga_id}: {e}")
        return None


def get_candidato_embedding(candidato_id: str) -> Optional[list[float]]:
    """
    Busca embedding de um candidato no banco.
    Retorna None se não encontrado ou ainda não gerado.
    """
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL não configurada")
    
    try:
        conn = psycopg2.connect(DATABASE_URL)
        register_vector(conn)
        
        with conn.cursor() as cur:
            cur.execute(
                'SELECT "Embedding" FROM "Candidatos" WHERE id = %s',
                (candidato_id,)
            )
            row = cur.fetchone()
        
        conn.close()
        return row[0] if row and row[0] else None
    except Exception as e:
        print(f"Erro ao buscar embedding do candidato {candidato_id}: {e}")
        return None
