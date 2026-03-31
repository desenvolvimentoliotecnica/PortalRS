import json
import os
import sys
from pathlib import Path
from urllib.parse import quote, unquote, urlparse, urlunparse

from dotenv import load_dotenv

# Remove qualquer DATABASE_URL/PG* herdada do shell ou do processo pai (uvicorn --reload).
for _k in list(os.environ):
    if _k == "DATABASE_URL" or (len(_k) > 2 and _k.startswith("PG") and _k[2:].isupper()):
        os.environ.pop(_k, None)

# Carrega .env pelo caminho absoluto (não depende do cwd do processo; worker do --reload pode ter cwd diferente).
_env_path = Path(__file__).resolve().parent.parent / ".env"
try:
    load_dotenv(_env_path, encoding="utf-8", override=True)
except UnicodeDecodeError:
    load_dotenv(_env_path, encoding="latin-1", override=True)

_raw_url = os.getenv("DATABASE_URL", "").strip()


def _ensure_ascii(s: str) -> str:
    """Converte qualquer caractere não-ASCII para percent-encoding (UTF-8), garantindo string só ASCII."""
    if not s:
        return s
    return "".join(quote(c, safe="") if ord(c) > 127 else c for c in s)


def _normalize_database_url(url: str) -> str:
    """Garante URL só com ASCII (percent-encode user/password) para evitar UnicodeDecodeError no psycopg2/libpq no Windows."""
    if not url or "://" not in url:
        return _ensure_ascii(url) if url else url
    try:
        parsed = urlparse(url)
        if not parsed.hostname:
            return _ensure_ascii(url)
        user = parsed.username or ""
        password = parsed.password or ""
        user_enc = quote(user, safe="") if user else ""
        password_enc = quote(password, safe="") if password else ""
        if not user_enc and not password_enc:
            netloc = parsed.hostname
        elif user_enc and password_enc:
            netloc = f"{user_enc}:{password_enc}@{parsed.hostname}"
        elif user_enc:
            netloc = f"{user_enc}@{parsed.hostname}"
        else:
            netloc = parsed.hostname
        if parsed.port is not None:
            netloc += f":{parsed.port}"
        result = urlunparse((parsed.scheme, netloc, parsed.path or "", parsed.params, parsed.query, parsed.fragment))
        return _ensure_ascii(result)
    except Exception:
        return _ensure_ascii(url)


DATABASE_URL = _normalize_database_url(_raw_url)
# Força o ambiente a ter só a URL ASCII, para libpq não ler valor em encoding errado no Windows.
os.environ["DATABASE_URL"] = DATABASE_URL

# Template para banco por tenant (igual à API: dev_render_{tenantId}). Se vazio, usa sempre DATABASE_URL.
_tenant_template = os.getenv("TENANT_DATABASE_TEMPLATE", "").strip()
if _tenant_template and "{0}" not in _tenant_template:
    _tenant_template = ""


def get_database_url(tenant_id: str | None) -> str:
    """
    Retorna a URL do banco para o tenant.
    - owner/system/vazio: usa DATABASE_URL (dev_render).
    - Se TENANT_DATABASE_TEMPLATE estiver configurado: usa dev_render_{tenant_id}.
    """
    tid = (tenant_id or "").strip()
    if tid.lower() in ("owner", "system") or not tid:
        return DATABASE_URL
    if _tenant_template:
        return _normalize_database_url(_tenant_template.format(tid))
    return DATABASE_URL


def _parse_db_params(url: str) -> dict | None:
    """Extrai host, port, user, password, dbname da URL para passar como kwargs ao psycopg2 (evita libpq ler DSN em encoding errado no Windows)."""
    if not url or "://" not in url:
        return None
    try:
        p = urlparse(url)
        if not p.hostname:
            return None
        dbname = (p.path or "").strip("/") or None
        return {
            "host": p.hostname,
            "port": p.port or 5432,
            "user": unquote(p.username) if p.username else None,
            "password": unquote(p.password) if p.password else None,
            "dbname": dbname,
        }
    except Exception:
        return None


DATABASE_PARAMS = _parse_db_params(DATABASE_URL)


def get_db_connect_kwargs() -> dict | None:
    """Retorna kwargs para psycopg2.connect(**kwargs), ou None para usar DSN. Evita libpq ler URI em encoding errado (Windows)."""
    if not DATABASE_PARAMS:
        return None
    return {k: v for k, v in DATABASE_PARAMS.items() if v is not None}


OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
TENANT_ID = os.getenv("TENANT_ID", "").strip()

# --- Validação de startup (fail-fast) ---
_REQUIRED_VARS = {"OPENAI_API_KEY": OPENAI_API_KEY, "DATABASE_URL": DATABASE_URL}
_missing = [k for k, v in _REQUIRED_VARS.items() if not v]
if _missing:
    print(
        f"[FATAL] Variáveis de ambiente obrigatórias ausentes: {_missing}. "
        "Configure o arquivo .env ou injete via variáveis de ambiente.",
        file=sys.stderr,
    )
    sys.exit(1)

# Modelo para embeddings (bom custo/qualidade)
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")

# Modelo para avaliação de critérios (LLM)
OPENAI_CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")

# Máximo de candidatos a retornar no matching
MATCH_TOP_K = int(os.getenv("MATCH_TOP_K", "100"))

# Ranking size padrão (configurável por tenant, min 10, max 100)
DEFAULT_RANKING_SIZE = max(10, min(100, int(os.getenv("DEFAULT_RANKING_SIZE", "20"))))

# Habilitar pgvector (busca vetorial)
ENABLE_PGVECTOR = os.getenv("ENABLE_PGVECTOR", "true").strip().lower() in ("true", "1", "yes")

# Embedding provider: "openai" (default) or "gemini"
EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "openai").strip().lower()


# Host e porta do servidor (podem vir do .env ou do appsettings da Integration.RM)
_default_port = os.getenv("PORT", "").strip()
HOST = os.getenv("HOST", "").strip() or "0.0.0.0"
PORT = int(_default_port) if _default_port.isdigit() else 8000


def _load_appsettings() -> dict:
    """Tenta carregar host/porta do appsettings.Development.json da Liotecnica.Integration.RM."""
    try:
        # Caminho relativo: RHPortal.Ai -> ../Liotecnica.Integration.RM/appsettings.Development.json
        base = Path(__file__).resolve().parent.parent
        path = base / ".." / "Liotecnica.Integration.RM" / "appsettings.Development.json"
        path = path.resolve()
        if path.exists():
            with open(path, encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return {}


_settings = _load_appsettings()
_ai = _settings.get("AiService") or {}
if not os.getenv("HOST") and _ai.get("Host"):
    HOST = str(_ai["Host"]).strip()
if not os.getenv("PORT") and _ai.get("Port") is not None:
    try:
        PORT = int(_ai["Port"])
    except (TypeError, ValueError):
        pass
