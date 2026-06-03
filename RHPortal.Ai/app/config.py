import json
import os
import sys
from pathlib import Path
from urllib.parse import quote, unquote, urlparse, urlunparse

from dotenv import load_dotenv

# Carrega .env pelo caminho absoluto (não depende do cwd do processo; worker do --reload pode ter cwd diferente).
# Em produção/container, variáveis injetadas pelo orquestrador devem prevalecer sobre o .env local.
_env_path = Path(__file__).resolve().parent.parent / ".env"
try:
    load_dotenv(_env_path, encoding="utf-8", override=False)
except UnicodeDecodeError:
    load_dotenv(_env_path, encoding="latin-1", override=False)

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


TENANT_ID = os.getenv("TENANT_ID", "").strip()

# ──────────────────── Provider selection (Fase 1 — LUC-100) ────────────────
#
# O serviço é provider-agnóstico. Cada feature (chat LLM e embeddings)
# pode escolher independentemente entre OpenAI, Gemini ou Ollama local.
#
# Env vars de controle:
#   LLM_PROVIDER         = openai | gemini | ollama    (chat)
#   EMBEDDING_PROVIDER   = openai | gemini | ollama    (embeddings)

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai").strip().lower()
EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "openai").strip().lower()

# ── OpenAI ──
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
OPENAI_CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")

# ── Gemini ──
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_CHAT_MODEL = os.getenv("GEMINI_CHAT_MODEL", "gemini-2.5-flash")
# Usado pelo factory (LangChain). O pipeline v2 em `gemini_embeddings.py`
# tem seu próprio nome via GEMINI_EMBEDDING_MODEL (coluna separada no DB).
GEMINI_LANGCHAIN_EMBEDDING_MODEL = os.getenv(
    "GEMINI_LANGCHAIN_EMBEDDING_MODEL", "models/gemini-embedding-001"
)

# ── Ollama (local) ──
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").strip()
OLLAMA_CHAT_MODEL = os.getenv("OLLAMA_CHAT_MODEL", "qwen2.5:7b")
OLLAMA_EMBEDDING_MODEL = os.getenv("OLLAMA_EMBEDDING_MODEL", "bge-m3")

# ── Fail-fast condicional ──
# Só exige a chave do provider que ESTÁ selecionado.
# DATABASE_URL sempre obrigatório.
_missing: list[str] = []
if not DATABASE_URL:
    _missing.append("DATABASE_URL")

_providers_in_use = {LLM_PROVIDER, EMBEDDING_PROVIDER}
if "openai" in _providers_in_use and not OPENAI_API_KEY:
    _missing.append("OPENAI_API_KEY (requerida porque LLM_PROVIDER ou EMBEDDING_PROVIDER = openai)")
if "gemini" in _providers_in_use and not GEMINI_API_KEY:
    _missing.append("GEMINI_API_KEY (requerida porque LLM_PROVIDER ou EMBEDDING_PROVIDER = gemini)")
# Ollama: não há chave; se selecionado, apenas checamos URL (já tem default).

if _missing:
    print(
        f"[FATAL] Variáveis de ambiente obrigatórias ausentes: {_missing}. "
        f"(LLM_PROVIDER={LLM_PROVIDER!r}, EMBEDDING_PROVIDER={EMBEDDING_PROVIDER!r}). "
        "Configure o arquivo .env ou injete via variáveis de ambiente.",
        file=sys.stderr,
    )
    sys.exit(1)

# Máximo de candidatos a retornar no matching
MATCH_TOP_K = int(os.getenv("MATCH_TOP_K", "100"))

# Ranking size padrão (configurável por tenant, min 10, max 100)
DEFAULT_RANKING_SIZE = max(10, min(100, int(os.getenv("DEFAULT_RANKING_SIZE", "20"))))

# Habilitar pgvector (busca vetorial)
ENABLE_PGVECTOR = os.getenv("ENABLE_PGVECTOR", "true").strip().lower() in ("true", "1", "yes")


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
