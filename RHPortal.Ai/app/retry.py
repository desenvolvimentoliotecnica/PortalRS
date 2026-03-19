"""
Decoradores de retry para OpenAI/Gemini e banco de dados.
Usa Tenacity para backoff exponencial com logging automático.
"""
import logging

from tenacity import (
    before_sleep_log,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

_log = logging.getLogger("rh.retry")

# Retry para chamadas OpenAI (rate limit, connection reset, timeout)
try:
    import openai

    openai_retry = retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((
            openai.RateLimitError,
            openai.APIConnectionError,
            openai.APITimeoutError,
        )),
        before_sleep=before_sleep_log(_log, logging.WARNING),
        reraise=True,
    )
except ImportError:
    # Se openai não instalado, cria decorator passthrough
    def openai_retry(fn):  # type: ignore
        return fn


# Retry genérico para operações de DB (conexão recusada, timeout)
db_retry = retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.5, min=1, max=5),
    retry=retry_if_exception_type(Exception),
    before_sleep=before_sleep_log(_log, logging.WARNING),
    reraise=True,
)
