"""
Módulo para busca vetorial usando pgvector.
Usa distância de cosseno para encontrar candidatos similares a uma vaga.
"""
from typing import Any, Optional
import psycopg2
from pgvector.psycopg2 import register_vector

from app.config import DATABASE_URL, TENANT_ID


def search_candidates_by_similarity(
    vaga_id: str,
    tenant_id: Optional[str] = None,
    limit: int = 100,
    min_score: int = 0
) -> list[dict[str, Any]]:
    """
    Busca candidatos por similaridade vetorial com uma vaga.
    
    Args:
        vaga_id: ID da vaga para usar como referência
        tenant_id: ID do tenant (opcional)
        limit: Máximo de resultados (padrão: 100)
        min_score: Score mínimo (0-100, padrão: 0)
    
    Returns:
        Lista de dicts com candidato_id, nome, email, similaridade (0-100)
    """
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL não configurada")
    
    tid = tenant_id or TENANT_ID
    
    try:
        conn = psycopg2.connect(DATABASE_URL)
        register_vector(conn)
        
        with conn.cursor() as cur:
            # Busca embedding da vaga
            cur.execute(
                'SELECT "Embedding" FROM "Vagas" WHERE id = %s',
                (vaga_id,)
            )
            row = cur.fetchone()
            
            if not row or not row[0]:
                # Vaga não tem embedding
                return []
            
            vaga_embedding = row[0]
            
            # Busca candidatos similares usando distância de cosseno
            # Distância de cosseno: 0 = idênticos, 2 = opostos
            # Similaridade: (1 - distância/2) * 100 = 0 a 100
            where_clause = 'WHERE c."TenantId" = %s AND c."Embedding" IS NOT NULL' if tid else 'WHERE c."Embedding" IS NOT NULL'
            params = [vaga_embedding]
            if tid:
                params.append(tid)
            params.extend([vaga_embedding, limit])
            
            query = f"""
                SELECT 
                    c.id,
                    c."Nome",
                    c."Email",
                    (1 - (c."Embedding" <=> %s::vector)) * 100 AS similaridade
                FROM "Candidatos" c
                {where_clause}
                ORDER BY c."Embedding" <=> %s::vector
                LIMIT %s
            """
            
            cur.execute(query, params)
            rows = cur.fetchall()
        
        conn.close()
        
        results = []
        for row in rows:
            similarity = max(0, min(100, int(row[3])))  # Clamp 0-100
            if similarity >= min_score:
                results.append({
                    "candidato_id": str(row[0]),
                    "nome": row[1] or "",
                    "email": row[2] or "",
                    "similaridade": similarity
                })
        
        return results
        
    except Exception as e:
        print(f"Erro na busca vetorial para vaga {vaga_id}: {e}")
        return []


def get_similarity_score(vaga_id: str, candidato_id: str) -> Optional[int]:
    """
    Calcula score de similaridade entre uma vaga e um candidato específico.
    
    Returns:
        Score 0-100 ou None se não houver embeddings
    """
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL não configurada")
    
    try:
        conn = psycopg2.connect(DATABASE_URL)
        register_vector(conn)
        
        with conn.cursor() as cur:
            # Busca embeddings
            cur.execute(
                """
                SELECT 
                    v."Embedding" as vaga_emb,
                    c."Embedding" as candidato_emb
                FROM "Vagas" v
                CROSS JOIN "Candidatos" c
                WHERE v.id = %s AND c.id = %s
                """,
                (vaga_id, candidato_id)
            )
            row = cur.fetchone()
            
            if not row or not row[0] or not row[1]:
                return None
            
            vaga_emb = row[0]
            candidato_emb = row[1]
            
            # Calcula distância de cosseno
            cur.execute(
                """
                SELECT %s::vector <=> %s::vector AS distance
                """,
                (vaga_emb, candidato_emb)
            )
            distance = cur.fetchone()[0]
        
        conn.close()
        
        # Converte distância em similaridade 0-100
        similarity = (1 - float(distance)) * 100
        return max(0, min(100, int(similarity)))
        
    except Exception as e:
        print(f"Erro ao calcular similaridade {vaga_id} x {candidato_id}: {e}")
        return None


def count_candidates_with_embeddings(tenant_id: Optional[str] = None) -> int:
    """
    Conta quantos candidatos têm embeddings gerados.
    Útil para decidir se vale a pena usar busca vetorial.
    """
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL não configurada")
    
    tid = tenant_id or TENANT_ID
    
    try:
        conn = psycopg2.connect(DATABASE_URL)
        
        with conn.cursor() as cur:
            where_clause = 'WHERE "TenantId" = %s AND "Embedding" IS NOT NULL' if tid else 'WHERE "Embedding" IS NOT NULL'
            params = [tid] if tid else []
            
            cur.execute(
                f'SELECT COUNT(*) FROM "Candidatos" {where_clause}',
                params
            )
            count = cur.fetchone()[0]
        
        conn.close()
        return count
        
    except Exception as e:
        print(f"Erro ao contar candidatos com embeddings: {e}")
        return 0
