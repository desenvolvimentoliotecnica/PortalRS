"""
Contexto de request para overrides de provider/modelo por tenant.

A API .NET (Fase 3 LLM-agnóstico) injeta esses valores no body do request
quando o tenant tem configuração específica. Em vez de carregar essa
configuração por todos os argumentos das funções do pipeline, usamos
`contextvars` — um context-local set/get scoped ao request HTTP atual.

Uso:

    from app.request_context import use_request_overrides
    from app.llm_factory import get_chat_llm

    with use_request_overrides(llm_provider="gemini", llm_model="gemini-2.5-flash"):
        llm = get_chat_llm()    # respeita o override; sem override cai no .env

`get_chat_llm` e `get_embeddings_client` consultam o contexto antes de cair
nas env vars `LLM_PROVIDER` / `EMBEDDING_PROVIDER`.
"""
from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass


@dataclass(frozen=True)
class RequestOverrides:
    llm_provider: str | None = None
    llm_model: str | None = None
    embedding_provider: str | None = None
    embedding_model: str | None = None


_current: ContextVar[RequestOverrides] = ContextVar("ai_request_overrides", default=RequestOverrides())


def get_overrides() -> RequestOverrides:
    """Retorna os overrides do request atual (todos os campos podem ser None)."""
    return _current.get()


@contextmanager
def use_request_overrides(
    llm_provider: str | None = None,
    llm_model: str | None = None,
    embedding_provider: str | None = None,
    embedding_model: str | None = None,
):
    """Define overrides para a duração do bloco. Strings vazias são tratadas como None."""
    def _norm(s: str | None) -> str | None:
        return s.strip() if isinstance(s, str) and s.strip() else None

    overrides = RequestOverrides(
        llm_provider=_norm(llm_provider),
        llm_model=_norm(llm_model),
        embedding_provider=_norm(embedding_provider),
        embedding_model=_norm(embedding_model),
    )
    token = _current.set(overrides)
    try:
        yield overrides
    finally:
        _current.reset(token)
