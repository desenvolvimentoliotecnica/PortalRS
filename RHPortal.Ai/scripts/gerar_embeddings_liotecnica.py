"""
Gera embeddings da VAGA DE TESTE e de TODOS os talentos do tenant liotecnica,
para o matching retornar a lista de candidatos/talentos mais adequados à vaga.

Com 918 talentos no banco, o cálculo de matching usa:
  - embedding da vaga (similaridade com cada talento/candidato)
  - embeddings dos talentos e candidatos

Sem embeddings, a busca vetorial retorna vazia e "não dá match com ninguém".

Execute a partir da pasta RHPortal.Ai (com OPENAI_API_KEY e .env configurado):
  python scripts/gerar_embeddings_liotecnica.py

Requisitos: TENANT_DATABASE_TEMPLATE no .env (ex: .../dev_render_{0}).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

TENANT_ID = "liotecnica"
VAGA_ID = "f783b9ec-e213-47fd-b3fe-7aba9b72cc6a"
BATCH_SIZE = 100


def run():
    from app.config import get_database_url, OPENAI_API_KEY
    from app.db import get_vaga_perfil, get_talento_perfil, get_talentos_ids_sem_embedding
    from app.embeddings import (
        generate_vaga_embedding,
        generate_talento_embedding,
        save_vaga_embedding,
        save_talento_embedding,
        get_vaga_embedding,
    )

    if not OPENAI_API_KEY:
        print("ERRO: OPENAI_API_KEY não configurada no .env")
        return 1

    url = get_database_url(TENANT_ID)
    if not url:
        print("ERRO: Não foi possível obter URL do banco para tenant", TENANT_ID)
        print("Configure TENANT_DATABASE_TEMPLATE no .env (ex: .../dev_render_{0})")
        return 1

    print("Tenant:", TENANT_ID)
    print("Vaga de teste:", VAGA_ID)
    print()

    # 1) Embedding da vaga (obrigatório para o matching calcular similaridade)
    vaga = get_vaga_perfil(VAGA_ID, TENANT_ID)
    if not vaga:
        print("ERRO: Vaga não encontrada. Verifique o Id da vaga no tenant", TENANT_ID)
        return 1

    if get_vaga_embedding(VAGA_ID, TENANT_ID) is None:
        print("Gerando embedding da vaga...")
        emb = generate_vaga_embedding(vaga)
        save_vaga_embedding(VAGA_ID, emb, TENANT_ID)
        print("  -> Embedding da vaga salvo.")
    else:
        print("Vaga já possui embedding.")

    # 2) Embeddings dos talentos (em lotes)
    total_gerados = 0
    while True:
        ids = get_talentos_ids_sem_embedding(TENANT_ID, limit=BATCH_SIZE)
        if not ids:
            break
        print(f"Processando lote de {len(ids)} talentos sem embedding...")
        lote_ok = 0
        for tid in ids:
            try:
                talento = get_talento_perfil(tid, TENANT_ID)
                if not talento:
                    continue
                embedding = generate_talento_embedding(talento)
                if save_talento_embedding(tid, embedding, TENANT_ID):
                    lote_ok += 1
                    total_gerados += 1
            except Exception as e:
                print(f"  Erro talento {tid[:8]}...: {e}")
        print(f"  -> Lote: {lote_ok} gerados. Total acumulado: {total_gerados}")

    print()
    print(f"Pronto. Total de embeddings de talentos gerados nesta execução: {total_gerados}")
    print("Agora abra a vaga no Portal RH e clique em Matching para ver a lista de candidatos/talentos mais adequados.")
    return 0


if __name__ == "__main__":
    sys.exit(run())
