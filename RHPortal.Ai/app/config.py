import json
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
TENANT_ID = os.getenv("TENANT_ID", "").strip()

# Modelo para embeddings (bom custo/qualidade)
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")

# Modelo para avaliação de critérios (LLM)
OPENAI_CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")

# Máximo de candidatos a retornar no matching
MATCH_TOP_K = int(os.getenv("MATCH_TOP_K", "100"))

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
