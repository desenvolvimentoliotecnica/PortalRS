"""
Logging estruturado em JSON para produção.
Substitui os print() espalhados pelo código por logs rastreáveis.
"""
import json
import logging
import sys
from datetime import datetime, timezone


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        for k, v in getattr(record, "ctx", {}).items():
            payload[k] = v
        return json.dumps(payload, ensure_ascii=False, default=str)


def _make(name: str) -> logging.Logger:
    lg = logging.getLogger(name)
    lg.setLevel(logging.INFO)
    if not lg.handlers:
        h = logging.StreamHandler(sys.stdout)
        h.setFormatter(_JsonFormatter())
        lg.addHandler(h)
    lg.propagate = False
    return lg


matching = _make("rh.matching")
embeddings = _make("rh.embeddings")
db = _make("rh.db")
requests = _make("rh.requests")
gemini = _make("rh.gemini")
