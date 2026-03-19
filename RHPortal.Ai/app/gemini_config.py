"""
Configuração do Gemini Embedding 2.
Lê GEMINI_API_KEY do .env e define constantes do modelo.
"""
import os

# Importar config para garantir que o .env já foi carregado via python-dotenv.
import app.config  # noqa: F401

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()

# Modelo de embeddings multimodal
GEMINI_EMBEDDING_MODEL = os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-2-preview")

# Dimensões do vetor (3072 padrão, 1536 ou 768 via MRL)
GEMINI_EMBEDDING_DIMS = int(os.getenv("GEMINI_EMBEDDING_DIMS", "3072"))

# Tamanho fixo do ranking (top 20)
GEMINI_RANKING_SIZE = max(5, min(100, int(os.getenv("GEMINI_RANKING_SIZE", "20"))))

# Feature flag para ativar/desativar gradualmente
GEMINI_ENABLED = os.getenv("GEMINI_ENABLED", "true").strip().lower() in ("true", "1", "yes")

# Workers paralelos para avaliação LLM (max 12)
GEMINI_MAX_LLM_WORKERS = max(1, min(12, int(os.getenv("GEMINI_MAX_LLM_WORKERS", "5"))))

# Multiplicador para busca vetorial (pega N * multiplicador para garantir recall)
GEMINI_VECTOR_MULTIPLIER = max(2, min(6, int(os.getenv("GEMINI_VECTOR_MULTIPLIER", "3"))))
