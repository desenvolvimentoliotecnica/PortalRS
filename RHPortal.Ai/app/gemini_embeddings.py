"""
Geração de embeddings via Gemini Embedding 2 (multimodal: texto + PDF nativo).
Coexiste com o módulo embeddings.py (OpenAI) — não o altera.

Usa o SDK google-genai para gerar embeddings de:
- Texto puro (vagas, perfis textuais)
- PDFs nativos (currículos, documentos — sem OCR)
- Combinação texto + PDF em uma única request
"""
import io
from typing import Any, Optional

from google import genai
from google.genai import types

from app.gemini_config import (
    GEMINI_API_KEY,
    GEMINI_EMBEDDING_MODEL,
    GEMINI_EMBEDDING_DIMS,
)
# Reutiliza construtores de texto canônico do módulo existente
from app.embeddings import (
    _build_vaga_text_for_embedding,
    _build_candidato_text_for_embedding,
    _build_talento_text_for_embedding,
)


def _get_client() -> genai.Client:
    """Retorna cliente Gemini autenticado."""
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY não configurada no .env")
    return genai.Client(api_key=GEMINI_API_KEY)


# ─── Embedding de Texto ───────────────────────────────────────────────────

def generate_text_embedding(text: str) -> list[float]:
    """
    Gera embedding de texto puro via Gemini Embedding 2.
    Retorna vetor de GEMINI_EMBEDDING_DIMS dimensões (padrão: 3072).
    """
    if not text or not text.strip():
        raise ValueError("Texto vazio para gerar embedding")

    client = _get_client()
    result = client.models.embed_content(
        model=GEMINI_EMBEDDING_MODEL,
        contents=text,
        config=types.EmbedContentConfig(
            output_dimensionality=GEMINI_EMBEDDING_DIMS,
        ),
    )
    return list(result.embeddings[0].values)


# ─── Embedding de PDF ─────────────────────────────────────────────────────

def generate_pdf_embedding(pdf_bytes: bytes) -> list[float]:
    """
    Gera embedding nativo de PDF via Gemini Embedding 2.
    O PDF é enviado diretamente ao modelo — sem OCR, sem extração de texto.
    Suporta até 6 páginas.
    """
    if not pdf_bytes:
        raise ValueError("PDF vazio para gerar embedding")

    client = _get_client()
    pdf_part = types.Part(
        inline_data=types.Blob(
            mime_type="application/pdf",
            data=pdf_bytes,
        )
    )
    result = client.models.embed_content(
        model=GEMINI_EMBEDDING_MODEL,
        contents=types.Content(parts=[pdf_part]),
        config=types.EmbedContentConfig(
            output_dimensionality=GEMINI_EMBEDDING_DIMS,
        ),
    )
    return list(result.embeddings[0].values)


# ─── Embedding Multimodal (Texto + PDF) ───────────────────────────────────

def generate_multimodal_embedding(text: str, pdf_bytes: bytes | None = None) -> list[float]:
    """
    Gera embedding combinando texto + PDF na mesma request.
    Se pdf_bytes for None, usa apenas texto.
    Isso permite capturar informações de ambas as fontes num único vetor.
    """
    if not text and not pdf_bytes:
        raise ValueError("Texto e PDF vazios para gerar embedding")

    client = _get_client()
    parts: list[types.Part] = []

    if text and text.strip():
        parts.append(types.Part(text=text))

    if pdf_bytes:
        parts.append(types.Part(
            inline_data=types.Blob(
                mime_type="application/pdf",
                data=pdf_bytes,
            )
        ))

    result = client.models.embed_content(
        model=GEMINI_EMBEDDING_MODEL,
        contents=types.Content(parts=parts),
        config=types.EmbedContentConfig(
            output_dimensionality=GEMINI_EMBEDDING_DIMS,
        ),
    )
    return list(result.embeddings[0].values)


# ─── Embedding de Entidades ───────────────────────────────────────────────

def generate_vaga_embedding_v2(vaga: dict[str, Any]) -> list[float]:
    """
    Gera embedding Gemini para uma vaga.
    Usa o mesmo texto canônico do módulo existente (embeddings.py).
    """
    text = _build_vaga_text_for_embedding(vaga)
    return generate_text_embedding(text)


def generate_candidato_embedding_v2(
    candidato: dict[str, Any],
    pdf_bytes: bytes | None = None,
) -> list[float]:
    """
    Gera embedding Gemini para um candidato.
    Se pdf_bytes for fornecido, combina texto do perfil + PDF (multimodal).
    """
    text = _build_candidato_text_for_embedding(candidato)
    if pdf_bytes:
        return generate_multimodal_embedding(text, pdf_bytes)
    return generate_text_embedding(text)


def generate_talento_embedding_v2(
    talento: dict[str, Any],
    pdf_bytes: bytes | None = None,
) -> list[float]:
    """
    Gera embedding Gemini para um talento.
    Se pdf_bytes for fornecido, combina texto do perfil + PDF (multimodal).
    """
    text = _build_talento_text_for_embedding(talento)
    if pdf_bytes:
        return generate_multimodal_embedding(text, pdf_bytes)
    return generate_text_embedding(text)
