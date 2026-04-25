"""
Factory provider-agnóstica para LLMs (chat) e embeddings.

Permite trocar OpenAI / Gemini / Ollama via env var sem mudar o código
dos pipelines. Fase 1 do épico LUC-100 / "LLM-agnóstico" (docs: lucasIA_RAG.md).

Uso:

    from app.llm_factory import get_chat_llm, get_embeddings_client

    llm = get_chat_llm(temperature=0)          # respeita LLM_PROVIDER do .env
    emb = get_embeddings_client()              # respeita EMBEDDING_PROVIDER do .env

Overrides por chamada (ex.: forçar OpenAI num ponto específico):

    llm = get_chat_llm(provider="openai", model="gpt-4o-mini")

Providers suportados:

| Provider | Chat                       | Embeddings                       |
|----------|----------------------------|----------------------------------|
| openai   | ChatOpenAI (gpt-4o-mini)   | OpenAIEmbeddings (te-3-small)    |
| gemini   | ChatGoogleGenerativeAI     | GoogleGenerativeAIEmbeddings     |
| ollama   | ChatOllama (qwen2.5:7b)    | OllamaEmbeddings (bge-m3)        |

Imports de provedores não-padrão são lazy para que só se pague o custo
quando o provedor for realmente usado (e o pacote correspondente esteja
instalado).
"""
from __future__ import annotations

from typing import Any

from app import config


# ─────────────────────────── Chat LLM ──────────────────────────────────────


def get_chat_llm(
    provider: str | None = None,
    model: str | None = None,
    temperature: float = 0.0,
    request_timeout: int = 60,
    max_retries: int = 1,
    **kwargs: Any,
) -> Any:
    """Retorna um client LangChain de chat para o provider escolhido.

    A escolha do provider segue (nesta ordem):
      1. argumento `provider` (se passado explicitamente)
      2. `config.LLM_PROVIDER` (lido de env var `LLM_PROVIDER`)
      3. fallback "openai"
    """
    p = (provider or config.LLM_PROVIDER or "openai").strip().lower()

    if p == "openai":
        from langchain_openai import ChatOpenAI

        if not config.OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY ausente para LLM_PROVIDER=openai")
        return ChatOpenAI(
            model=model or config.OPENAI_CHAT_MODEL,
            openai_api_key=config.OPENAI_API_KEY,
            temperature=temperature,
            request_timeout=request_timeout,
            max_retries=max_retries,
            **kwargs,
        )

    if p == "gemini":
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
        except ImportError as e:
            raise RuntimeError(
                "Pacote 'langchain-google-genai' não instalado. "
                "Rode: pip install langchain-google-genai"
            ) from e

        if not config.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY ausente para LLM_PROVIDER=gemini")
        return ChatGoogleGenerativeAI(
            model=model or config.GEMINI_CHAT_MODEL,
            google_api_key=config.GEMINI_API_KEY,
            temperature=temperature,
            max_retries=max_retries,
            **kwargs,
        )

    if p == "ollama":
        try:
            from langchain_ollama import ChatOllama
        except ImportError as e:
            raise RuntimeError(
                "Pacote 'langchain-ollama' não instalado. "
                "Rode: pip install langchain-ollama"
            ) from e

        return ChatOllama(
            model=model or config.OLLAMA_CHAT_MODEL,
            base_url=config.OLLAMA_BASE_URL,
            temperature=temperature,
            **kwargs,
        )

    raise ValueError(
        f"LLM_PROVIDER desconhecido: '{p}'. Valores válidos: openai | gemini | ollama."
    )


# ─────────────────────────── Embeddings ────────────────────────────────────


def get_embeddings_client(
    provider: str | None = None,
    model: str | None = None,
    **kwargs: Any,
) -> Any:
    """Retorna um client LangChain de embeddings para o provider escolhido.

    A escolha do provider segue:
      1. argumento `provider` (se passado)
      2. `config.EMBEDDING_PROVIDER` (env var `EMBEDDING_PROVIDER`)
      3. fallback "openai"

    Obs: o pipeline Gemini v2 (`app/gemini_embeddings.py`) usa o SDK
    `google-genai` diretamente para persistir numa coluna separada
    (`gemini_embedding vector(768)`). Esse caminho é mantido como está
    e NÃO passa por este factory — aqui é apenas o caminho "padrão"
    (coluna `embedding` 1536-dim) que respeita LangChain.
    """
    p = (provider or config.EMBEDDING_PROVIDER or "openai").strip().lower()

    if p == "openai":
        from langchain_openai import OpenAIEmbeddings

        if not config.OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY ausente para EMBEDDING_PROVIDER=openai")
        return OpenAIEmbeddings(
            model=model or config.EMBEDDING_MODEL,
            openai_api_key=config.OPENAI_API_KEY,
            **kwargs,
        )

    if p == "gemini":
        try:
            from langchain_google_genai import GoogleGenerativeAIEmbeddings
        except ImportError as e:
            raise RuntimeError(
                "Pacote 'langchain-google-genai' não instalado. "
                "Rode: pip install langchain-google-genai"
            ) from e

        if not config.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY ausente para EMBEDDING_PROVIDER=gemini")
        return GoogleGenerativeAIEmbeddings(
            model=model or config.GEMINI_LANGCHAIN_EMBEDDING_MODEL,
            google_api_key=config.GEMINI_API_KEY,
            **kwargs,
        )

    if p == "ollama":
        try:
            from langchain_ollama import OllamaEmbeddings
        except ImportError as e:
            raise RuntimeError(
                "Pacote 'langchain-ollama' não instalado. "
                "Rode: pip install langchain-ollama"
            ) from e

        return OllamaEmbeddings(
            model=model or config.OLLAMA_EMBEDDING_MODEL,
            base_url=config.OLLAMA_BASE_URL,
            **kwargs,
        )

    raise ValueError(
        f"EMBEDDING_PROVIDER desconhecido: '{p}'. Valores válidos: openai | gemini | ollama."
    )


# ─────────────────────────── Introspecção ──────────────────────────────────


def active_providers() -> dict[str, str]:
    """Retorna um dict com os providers ativos — útil para logs/health."""
    return {
        "llm": (config.LLM_PROVIDER or "openai").lower(),
        "embeddings": (config.EMBEDDING_PROVIDER or "openai").lower(),
    }
