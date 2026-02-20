"""
Script para criar vaga de teste e candidatos no banco (dev_render).
Execute a partir da pasta RHPortal.Ai: python scripts/seed_test_data.py

Usa o tenant_id "dev" e cria:
- 1 Área (se não existir)
- 1 Vaga em status Aberta (Status=2)
- 3 Candidatos
"""
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Garante que o app seja encontrado ao rodar scripts/seed_test_data.py
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import psycopg2
from psycopg2.extras import RealDictCursor

from app.config import DATABASE_URL

TENANT_ID = "dev"
NOW = datetime.now(timezone.utc)


def run():
    if not DATABASE_URL:
        print("ERRO: DATABASE_URL não configurada. Configure o .env")
        return 1

    tenant_id = TENANT_ID
    print("Conectando ao banco...")
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # 1) Área do tenant (usa uma existente ou cria uma)
            cur.execute(
                'SELECT "Id" FROM "Areas" WHERE "TenantId" = %s LIMIT 1',
                (tenant_id,),
            )
            row = cur.fetchone()
            if row:
                area_id = row["Id"]
                if hasattr(area_id, "hex"):
                    area_id = str(area_id)
                print("Área existente:", area_id)
            else:
                # Tenta qualquer área do banco (outro tenant)
                cur.execute('SELECT "Id", "TenantId" FROM "Areas" LIMIT 1')
                row = cur.fetchone()
                if row:
                    area_id = row["Id"]
                    if hasattr(area_id, "hex"):
                        area_id = str(area_id)
                    tenant_id = str(row["TenantId"])
                    print("Usando área e tenant existentes:", area_id, tenant_id)
                else:
                    area_id = str(uuid.uuid4())
                    cur.execute(
                        """
                        INSERT INTO "Areas" ("Id", "TenantId", "Code", "Name", "IsActive")
                        VALUES (%s, %s, %s, %s, true)
                        """,
                        (area_id, tenant_id, "TI", "Tecnologia",),
                    )
                    print("Área criada:", area_id)

            # 2) Vaga de teste (ID fixo para você sempre usar no matching) — sem Department
            area_id_str = str(area_id) if hasattr(area_id, "hex") else area_id
            vaga_id = uuid.UUID("a0000001-0000-4000-8000-000000000001")
            cur.execute(
                """
                INSERT INTO "Vagas" (
                    "Id", "TenantId", "Codigo", "Titulo", "AreaId", "Status",
                    "QuantidadeVagas", "MatchMinimoPercentual",
                    "Confidencial", "AceitaPcd", "Urgente", "VagaAfirmativa", "LinguagemInclusiva",
                    "CanalLinkedIn", "CanalSiteCarreiras", "CanalIndicacao", "CanalPortaisEmprego",
                    "LgpdSolicitarConsentimentoExplicito", "LgpdCompartilharCurriculoInternamente", "LgpdRetencaoAtiva",
                    "ExigeCnh", "DisponibilidadeParaViagens", "ChecagemAntecedentes",
                    "DescricaoInterna", "DescricaoPublica", "Cidade", "Uf",
                    "MatchingFiltrosRaw", "ResumoPitch",
                    "CreatedAtUtc", "UpdatedAtUtc"
                ) VALUES (
                    %s, %s, %s, %s, %s, 2,
                    1, 70,
                    false, false, false, false, false,
                    false, false, false, false,
                    false, false, false,
                    false, false, false,
                    %s, %s, %s, %s,
                    %s, %s,
                    %s, %s
                )
                ON CONFLICT ("Id") DO UPDATE SET
                    "Titulo" = EXCLUDED."Titulo",
                    "Status" = 2,
                    "TenantId" = EXCLUDED."TenantId",
                    "AreaId" = EXCLUDED."AreaId",
                    "UpdatedAtUtc" = EXCLUDED."UpdatedAtUtc"
                """,
                (
                    str(vaga_id),
                    tenant_id,
                    "TESTE-001",
                    "Desenvolvedor Full Stack (vaga de teste)",
                    area_id_str,
                    "Vaga para testar matching por IA.",
                    "Atuar em projetos web com .NET e React.",
                    "São Paulo",
                    "SP",
                    "Experiência com C# e JavaScript; trabalho remoto ou híbrido.",
                    "Oportunidade para dev que curte stack moderna.",
                    NOW,
                    NOW,
                ),
            )
            print("Vaga criada/atualizada:", vaga_id)
            print("   -> Use no matching: vaga_id =", str(vaga_id), ", tenant_id =", tenant_id)

            # 4) Candidatos de teste (3)
            candidatos = [
                {
                    "nome": "Maria Silva",
                    "email": "maria.silva.teste@email.com",
                    "resumo": "Desenvolvedora com 4 anos de experiência em .NET e React.",
                    "cv": "Experiência em C#, ASP.NET Core, React, SQL Server. Graduação em Ciência da Computação.",
                    "cidade": "São Paulo",
                    "uf": "SP",
                },
                {
                    "nome": "João Santos",
                    "email": "joao.santos.teste@email.com",
                    "resumo": "Full stack developer, 3 anos com Node e React.",
                    "cv": "JavaScript, TypeScript, Node.js, React. Conhecimento em C#. Formação em ADS.",
                    "cidade": "Campinas",
                    "uf": "SP",
                },
                {
                    "nome": "Ana Costa",
                    "email": "ana.costa.teste@email.com",
                    "resumo": "Backend developer C# e cloud, 5 anos.",
                    "cv": "C#, .NET Core, Azure, SQL. Pós em Engenharia de Software. Disponibilidade remota.",
                    "cidade": "São Paulo",
                    "uf": "SP",
                },
            ]
            for c in candidatos:
                cur.execute(
                    'SELECT "Id" FROM "Candidatos" WHERE "TenantId" = %s AND "Email" = %s LIMIT 1',
                    (tenant_id, c["email"]),
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
                        tenant_id,
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

        conn.commit()
        print("\nPronto. Para testar o matching, use:")
        print("  POST /matching/run  com body: { \"vaga_id\": \"" + str(vaga_id) + "\", \"tenant_id\": \"" + tenant_id + "\" }")
        return 0
    except Exception as e:
        conn.rollback()
        print("ERRO:", e)
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(run())
