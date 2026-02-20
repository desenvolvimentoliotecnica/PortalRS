"""
Cria CANDIDATOS de teste no tenant liotecnica para testar o matching na vaga
"Vaga Teste Matching IA TESTE". Também gera embeddings da vaga e dos candidatos
no banco do tenant, para o matching retornar resultados.

Execute a partir da pasta RHPortal.Ai:
  python scripts/seed_candidatos_teste_liotecnica.py

Requisitos: .env com TENANT_DATABASE_TEMPLATE (ex: postgresql://.../dev_render_{0}),
OPENAI_API_KEY e banco dev_render_liotecnica acessível.
"""
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import psycopg2
from psycopg2.extras import RealDictCursor

from app.config import get_database_url

TENANT_ID = "liotecnica"
VAGA_ID = "f783b9ec-e213-47fd-b3fe-7aba9b72cc6a"
NOW = datetime.now(timezone.utc)

CANDIDATOS_TESTE = [
    {
        "nome": "Maria Silva",
        "email": "maria.silva.teste@liotecnica.com.br",
        "resumo": "Desenvolvedora com 4 anos de experiência em .NET e React.",
        "cv": "Experiência em C#, ASP.NET Core, React, SQL Server. Graduação em Ciência da Computação.",
        "cidade": "São Paulo",
        "uf": "SP",
    },
    {
        "nome": "João Santos",
        "email": "joao.santos.teste@liotecnica.com.br",
        "resumo": "Full stack developer, 3 anos com Node e React.",
        "cv": "JavaScript, TypeScript, Node.js, React. Conhecimento em C#. Formação em ADS.",
        "cidade": "Campinas",
        "uf": "SP",
    },
    {
        "nome": "Ana Costa",
        "email": "ana.costa.teste@liotecnica.com.br",
        "resumo": "Backend developer C# e cloud, 5 anos.",
        "cv": "C#, .NET Core, Azure, SQL. Pós em Engenharia de Software. Disponibilidade remota.",
        "cidade": "São Paulo",
        "uf": "SP",
    },
]


def run():
    url = get_database_url(TENANT_ID)
    if not url:
        print("ERRO: Não foi possível obter URL do banco para tenant", TENANT_ID)
        print("Configure TENANT_DATABASE_TEMPLATE no .env (ex: .../dev_render_{0})")
        return 1

    print("Conectando ao banco do tenant", TENANT_ID, "...")
    conn = psycopg2.connect(url.encode("utf-8") if isinstance(url, str) else url)
    conn.autocommit = False

    ids_criados = []
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Verificar se a vaga existe
            cur.execute(
                'SELECT "Id" FROM "Vagas" WHERE "Id" = %s AND "TenantId" = %s',
                (VAGA_ID, TENANT_ID),
            )
            if not cur.fetchone():
                print("ERRO: Vaga não encontrada no tenant. Id da vaga:", VAGA_ID)
                return 1

            for c in CANDIDATOS_TESTE:
                cur.execute(
                    'SELECT "Id" FROM "Candidatos" WHERE "TenantId" = %s AND "Email" = %s LIMIT 1',
                    (TENANT_ID, c["email"]),
                )
                if cur.fetchone():
                    print("Candidato já existe (pulando):", c["email"])
                    continue
                cand_id = str(uuid.uuid4())
                cur.execute(
                    """
                    INSERT INTO "Candidatos" (
                        "Id", "TenantId", "Nome", "Email", "ResumoProfissional", "CvText",
                        "Cidade", "Uf", "Fonte", "Status", "CreatedAtUtc", "UpdatedAtUtc"
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 0, 0, %s, %s)
                    """,
                    (
                        cand_id,
                        TENANT_ID,
                        c["nome"],
                        c["email"],
                        c["resumo"],
                        c["cv"],
                        c["cidade"],
                        c["uf"],
                        NOW,
                        NOW,
                    ),
                )
                print("Candidato criado:", c["nome"], "->", cand_id)
                ids_criados.append(cand_id)

        conn.commit()
    except Exception as e:
        conn.rollback()
        print("ERRO ao inserir candidatos:", e)
        return 1
    finally:
        conn.close()

    # Gerar embeddings no banco do tenant (vaga + candidatos) para o matching retornar resultados
    if not ids_criados:
        print("Nenhum candidato novo criado. Gerando apenas embedding da vaga (se faltar).")
    print("\nGerando embeddings (vaga + candidatos) no banco do tenant...")

    from app.db import get_vaga_perfil, get_candidato_perfil
    from app.embeddings import (
        generate_vaga_embedding,
        generate_candidato_embedding,
        save_vaga_embedding,
        save_candidato_embedding,
        get_vaga_embedding,
        get_candidato_embedding,
    )

    try:
        vaga = get_vaga_perfil(VAGA_ID, TENANT_ID)
        if vaga and get_vaga_embedding(VAGA_ID, TENANT_ID) is None:
            emb = generate_vaga_embedding(vaga)
            save_vaga_embedding(VAGA_ID, emb, TENANT_ID)
            print("  Embedding da vaga gerado.")
        else:
            print("  Vaga já tem embedding ou perfil não encontrado.")

        for cand_id in ids_criados:
            if get_candidato_embedding(cand_id, TENANT_ID) is not None:
                continue
            perfil = get_candidato_perfil(cand_id, TENANT_ID)
            if not perfil:
                continue
            emb = generate_candidato_embedding(perfil)
            if save_candidato_embedding(cand_id, emb, TENANT_ID):
                print("  Embedding do candidato gerado:", cand_id[:8], "...")
    except Exception as e:
        print("AVISO: Erro ao gerar embeddings (confira OPENAI_API_KEY e banco):", e)
        print("Você pode gerar depois via API: POST /embeddings/vaga/{id}?tenant_id=liotecnica")
        print("  e POST /embeddings/candidato/{id}?tenant_id=liotecnica")

    # Diagnóstico: por que "nenhum talento" no matching?
    try:
        conn2 = psycopg2.connect(url.encode("utf-8") if isinstance(url, str) else url)
        with conn2.cursor() as cur:
            cur.execute(
                'SELECT COUNT(*) FROM "Talentos" WHERE "TenantId" = %s',
                (TENANT_ID,),
            )
            total_t = cur.fetchone()[0]
            cur.execute(
                'SELECT COUNT(*) FROM "Talentos" WHERE "TenantId" = %s AND "Embedding" IS NOT NULL',
                (TENANT_ID,),
            )
            com_emb = cur.fetchone()[0]
        conn2.close()
        print("\nBanco de talentos (tenant", TENANT_ID + "):", total_t, "talento(s),", com_emb, "com embedding.")
        if total_t > 0 and com_emb == 0:
            print("  -> Para talentos aparecerem no matching, gere embeddings: POST /embeddings/talentos/batch com tenant_id =", TENANT_ID)
    except Exception:
        pass

    print("\nPronto. Para testar o matching:")
    print('  POST /matching/run  com body: { "vaga_id": "' + VAGA_ID + '", "tenant_id": "' + TENANT_ID + '" }')
    return 0


if __name__ == "__main__":
    sys.exit(run())
