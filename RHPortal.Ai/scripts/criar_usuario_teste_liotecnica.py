"""
Cria usuário de teste no tenant liotecnica (banco dev_render_liotecnica)
para login no Portal RH e testar a vaga "Vaga Teste Matching IA TESTE".

Uso: python scripts/criar_usuario_teste_liotecnica.py

Credenciais criadas:
  Email: teste@liotecnica.com.br
  Senha: Teste@123
"""
import base64
import hashlib
import secrets
import struct
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import psycopg2
from psycopg2.extras import RealDictCursor

from app.config import get_database_url

TENANT_ID = "liotecnica"
EMAIL = "teste@liotecnica.com.br"
PASSWORD = "Teste@123"
FULL_NAME = "Usuário Teste Matching"
NOW = datetime.now(timezone.utc)


def identity_v3_hash(password: str) -> str:
    """
    Gera hash no formato ASP.NET Core Identity V3:
    PBKDF2 com HMAC-SHA512, 100000 iterações, salt 16 bytes, subkey 32 bytes.
    Formato: 0x01, prf (4), iter (4), saltLen (4), salt, subkey -> Base64.
    """
    salt = secrets.token_bytes(16)
    subkey = hashlib.pbkdf2_hmac(
        "sha512",
        password.encode("utf-8"),
        salt,
        100_000,
        dklen=32,
    )
    # KeyDerivationPrf.HMACSHA512 = 3
    buf = (
        b"\x01"
        + struct.pack(">I", 3)
        + struct.pack(">I", 100_000)
        + struct.pack(">I", len(salt))
        + salt
        + subkey
    )
    return base64.b64encode(buf).decode("ascii")


def run():
    url = get_database_url(TENANT_ID)
    if not url:
        print("ERRO: Configure TENANT_DATABASE_TEMPLATE no .env")
        return 1

    print("Conectando ao banco liotecnica...")
    conn = psycopg2.connect(url)
    conn.autocommit = False

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Verifica se já existe
            cur.execute(
                'SELECT "Id" FROM "Users" WHERE "TenantId" = %s AND "NormalizedEmail" = %s',
                (TENANT_ID, EMAIL.upper()),
            )
            if cur.fetchone():
                print(f"Usuário {EMAIL} já existe no tenant liotecnica.")
                print("Use: Email =", EMAIL, "| Senha =", PASSWORD)
                return 0

            # Role Admin: usa existente ou cria
            cur.execute(
                '''SELECT "Id" FROM "Roles" WHERE "TenantId" = %s AND ("NormalizedName" = %s OR "Name" = %s) LIMIT 1''',
                (TENANT_ID, "ADMIN", "Admin"),
            )
            row = cur.fetchone()
            if not row:
                role_id = str(uuid.uuid4())
                cur.execute(
                    """
                    INSERT INTO "Roles" (
                        "Id", "TenantId", "Name", "NormalizedName", "Description",
                        "IsActive", "CreatedAtUtc", "UpdatedAtUtc", "ConcurrencyStamp"
                    ) VALUES (%s, %s, %s, %s, %s, true, %s, %s, %s)
                    """,
                    (role_id, TENANT_ID, "Admin", "ADMIN", "Administrador do tenant", NOW, NOW, uuid.uuid4().hex),
                )
                print("Role 'Admin' criada no tenant (não existia).")
            else:
                role_id = row["Id"]
                if hasattr(role_id, "hex"):
                    role_id = str(role_id)

            user_id = str(uuid.uuid4())
            normalized = EMAIL.upper()
            password_hash = identity_v3_hash(PASSWORD)
            stamp = uuid.uuid4().hex

            cur.execute(
                """
                INSERT INTO "Users" (
                    "Id", "TenantId", "UserName", "NormalizedUserName",
                    "Email", "NormalizedEmail", "EmailConfirmed",
                    "PasswordHash", "SecurityStamp", "ConcurrencyStamp",
                    "FullName", "IsActive",
                    "PhoneNumber", "PhoneNumberConfirmed", "TwoFactorEnabled",
                    "LockoutEnabled", "LockoutEnd", "AccessFailedCount",
                    "CreatedAtUtc", "UpdatedAtUtc"
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, true,
                    %s, %s, %s, %s, true,
                    NULL, false, false, true, NULL, 0,
                    %s, %s
                )
                """,
                (
                    user_id,
                    TENANT_ID,
                    EMAIL,
                    normalized,
                    EMAIL,
                    normalized,
                    password_hash,
                    stamp,
                    stamp,
                    FULL_NAME,
                    NOW,
                    NOW,
                ),
            )

            cur.execute(
                'INSERT INTO "UserRoles" ("UserId", "RoleId", "TenantId") VALUES (%s, %s, %s)',
                (user_id, role_id, TENANT_ID),
            )

        conn.commit()
        print("Usuário de teste criado com sucesso.")
        print()
        print("  Tenant:    liotecnica")
        print("  Email:    ", EMAIL)
        print("  Senha:    ", PASSWORD)
        print("  Nome:     ", FULL_NAME)
        print()
        print("Use essas credenciais para entrar no Portal RH (tenant Liotecnica)")
        print("e testar a vaga 'Vaga Teste Matching IA TESTE'.")
        return 0
    except Exception as e:
        conn.rollback()
        print("ERRO:", e)
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(run())
