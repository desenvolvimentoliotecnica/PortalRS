"""
Connection pool para PostgreSQL via psycopg2.
Evita abrir uma nova conexão TCP por query — reutiliza conexões do pool.
"""
import threading
from contextlib import contextmanager
from typing import Generator

import psycopg2
import psycopg2.pool
from psycopg2.extensions import connection as PgConnection

from app.config import get_database_url

_pools: dict[str, psycopg2.pool.SimpleConnectionPool] = {}
_lock = threading.Lock()
# Tenants cujo schema pgvector já foi inicializado neste processo
_pgvector_ready: set[str] = set()


def _get_pool(tenant_id: str | None = None) -> psycopg2.pool.SimpleConnectionPool:
    url = get_database_url(tenant_id)
    key = (tenant_id or "default").lower()
    with _lock:
        if key not in _pools:
            _pools[key] = psycopg2.pool.SimpleConnectionPool(
                minconn=2,
                maxconn=10,
                dsn=url,
                connect_timeout=10,
                options="-c statement_timeout=30000",  # 30s max por query
            )
        return _pools[key]


def get_conn(tenant_id: str | None = None) -> PgConnection:
    return _get_pool(tenant_id).getconn()


def put_conn(conn: PgConnection, tenant_id: str | None = None) -> None:
    try:
        _get_pool(tenant_id).putconn(conn)
    except Exception:
        pass


@contextmanager
def db_conn(tenant_id: str | None = None) -> Generator[PgConnection, None, None]:
    """Context manager: pega conexão do pool e devolve ao terminar."""
    conn = get_conn(tenant_id)
    try:
        yield conn
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        put_conn(conn, tenant_id)


@contextmanager
def pgvector_conn(tenant_id: str | None = None) -> Generator[PgConnection, None, None]:
    """
    Context manager que retorna uma conexão do pool com pgvector registrado.
    Chama ensure_pgvector_extension apenas UMA vez por tenant (neste processo).
    """
    # Import local para evitar circular import com vector_search
    from pgvector.psycopg2 import register_vector

    conn = get_conn(tenant_id)
    key = (tenant_id or "default").lower()
    try:
        # Registrar o tipo vector na conexão (necessário por conexão)
        register_vector(conn)

        # Inicializar extensão/colunas apenas uma vez por tenant
        if key not in _pgvector_ready:
            from app.vector_search import ensure_pgvector_extension
            ensure_pgvector_extension(conn)
            _pgvector_ready.add(key)

        yield conn
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        put_conn(conn, tenant_id)


def close_all() -> None:
    """Fecha todos os pools (chamado no shutdown da aplicação)."""
    with _lock:
        for pool in _pools.values():
            try:
                pool.closeall()
            except Exception:
                pass
        _pools.clear()
        _pgvector_ready.clear()
