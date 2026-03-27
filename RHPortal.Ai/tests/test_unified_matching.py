"""
Testes para o motor de matching unificado com pesos dinâmicos.
Testa: _extract_weights, _compute_final_score, _build_vaga_context, _evaluate_with_llm (mock).
"""
import json
import sys
import os
from unittest.mock import MagicMock, patch

import pytest

# Adicionar o diretório pai ao path para importar app.*
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Mock do módulo de log antes de importar unified_matching
sys.modules.setdefault("app.log", MagicMock())

# Mock de dependências pesadas (DB, embeddings, vector search)
for mod in [
    "app.database_pool",
    "app.db",
    "app.embeddings",
    "app.vector_search",
    "app.config",
    "psycopg2",
    "psycopg2.extras",
    "psycopg2.pool",
    "langchain_openai",
    "langchain_core",
    "langchain_core.messages",
    "chromadb",
    "pgvector",
]:
    sys.modules.setdefault(mod, MagicMock())

# Configurar variáveis que o módulo precisa
os.environ.setdefault("OPENAI_API_KEY", "test-key")
os.environ.setdefault("OPENAI_CHAT_MODEL", "gpt-4o-mini")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")

# Agora importar o módulo
from app.unified_matching import (
    _extract_weights,
    _compute_final_score,
    _build_vaga_context,
    DEFAULT_WEIGHTS,
    RULE_V1,
    RULE_V2,
)
from app.filtros import parse_matching_filtros_raw


# ═══════════════════════════════════════════════════════════════════════════
# _extract_weights
# ═══════════════════════════════════════════════════════════════════════════

class TestExtractWeights:
    def test_returns_defaults_when_all_zero(self):
        vaga = {"PesoCompetencia": 0, "PesoExperiencia": 0, "PesoFormacao": 0, "PesoLocalidade": 0}
        w = _extract_weights(vaga)
        assert w == {"competencia": 40, "experiencia": 30, "formacao": 15, "localidade": 15}

    def test_returns_defaults_when_keys_missing(self):
        vaga = {}
        w = _extract_weights(vaga)
        assert w == DEFAULT_WEIGHTS

    def test_returns_defaults_when_none_values(self):
        vaga = {"PesoCompetencia": None, "PesoExperiencia": None, "PesoFormacao": None, "PesoLocalidade": None}
        w = _extract_weights(vaga)
        assert w == DEFAULT_WEIGHTS

    def test_returns_custom_weights(self):
        vaga = {"PesoCompetencia": 25, "PesoExperiencia": 25, "PesoFormacao": 25, "PesoLocalidade": 25}
        w = _extract_weights(vaga)
        assert w == {"competencia": 25, "experiencia": 25, "formacao": 25, "localidade": 25}

    def test_returns_custom_unbalanced_weights(self):
        vaga = {"PesoCompetencia": 60, "PesoExperiencia": 20, "PesoFormacao": 10, "PesoLocalidade": 10}
        w = _extract_weights(vaga)
        assert w["competencia"] == 60
        assert w["experiencia"] == 20
        assert w["formacao"] == 10
        assert w["localidade"] == 10

    def test_partial_nonzero_uses_custom(self):
        """Se pelo menos um peso é != 0, usa os valores do banco (não o default)."""
        vaga = {"PesoCompetencia": 100, "PesoExperiencia": 0, "PesoFormacao": 0, "PesoLocalidade": 0}
        w = _extract_weights(vaga)
        assert w["competencia"] == 100
        assert w["experiencia"] == 0


# ═══════════════════════════════════════════════════════════════════════════
# _compute_final_score
# ═══════════════════════════════════════════════════════════════════════════

class TestComputeFinalScore:
    """Testa a computação do score final com pesos dinâmicos."""

    def test_default_weights_v1_perfect_scores(self):
        """Score perfeito (100 em tudo) com pesos default deve dar 100."""
        result = _compute_final_score(
            score_competencia=100,
            score_experiencia=100,
            score_formacao=100,
            score_localidade=100,
            weights=dict(DEFAULT_WEIGHTS),
            mandatory_total=0,
            mandatory_missing=0,
            rule_version=RULE_V1,
        )
        assert result["score_final"] == 100

    def test_default_weights_v1_weighted_average(self):
        """Verifica que a média ponderada está correta com pesos default (40/30/15/15)."""
        result = _compute_final_score(
            score_competencia=80,
            score_experiencia=60,
            score_formacao=40,
            score_localidade=100,
            weights={"competencia": 40, "experiencia": 30, "formacao": 15, "localidade": 15},
            mandatory_total=0,
            mandatory_missing=0,
            rule_version=RULE_V1,
        )
        expected = round((80 * 40 + 60 * 30 + 40 * 15 + 100 * 15) / 100)
        assert result["score_final"] == expected

    def test_equal_weights_is_simple_average(self):
        """Pesos iguais (25/25/25/25) = média simples."""
        result = _compute_final_score(
            score_competencia=80,
            score_experiencia=60,
            score_formacao=40,
            score_localidade=20,
            weights={"competencia": 25, "experiencia": 25, "formacao": 25, "localidade": 25},
            mandatory_total=0,
            mandatory_missing=0,
            rule_version=RULE_V1,
        )
        expected = round((80 + 60 + 40 + 20) / 4)
        assert result["score_final"] == expected

    def test_competencia_heavy_weight(self):
        """Peso 100% em competência = score_competencia direto."""
        result = _compute_final_score(
            score_competencia=75,
            score_experiencia=30,
            score_formacao=10,
            score_localidade=90,
            weights={"competencia": 100, "experiencia": 0, "formacao": 0, "localidade": 0},
            mandatory_total=0,
            mandatory_missing=0,
            rule_version=RULE_V1,
        )
        assert result["score_final"] == 75

    def test_v2_mandatory_penalty(self):
        """V2 aplica penalidade por requisitos obrigatórios faltando."""
        result = _compute_final_score(
            score_competencia=80,
            score_experiencia=80,
            score_formacao=80,
            score_localidade=80,
            weights=dict(DEFAULT_WEIGHTS),
            mandatory_total=5,
            mandatory_missing=2,
            rule_version=RULE_V2,
        )
        # Base = 80, penalty = min(60, 2*20) = 40
        # Score = max(0, 80 - 40) = 40
        # Mas cap = min(40, 89) = 40 (já abaixo do cap)
        assert result["score_final"] == 40
        assert result["hard_penalty"] == 40
        assert result["mandatory_coverage"] == 60

    def test_v2_cap_at_89_when_missing(self):
        """V2 cap em 89 quando há mandatory faltando."""
        result = _compute_final_score(
            score_competencia=100,
            score_experiencia=100,
            score_formacao=100,
            score_localidade=100,
            weights=dict(DEFAULT_WEIGHTS),
            mandatory_total=5,
            mandatory_missing=1,
            rule_version=RULE_V2,
        )
        # Base = 100, penalty = 20, score = 80
        # Cap: missing > 0 → min(80, 89) = 80
        assert result["score_final"] == 80
        assert result["missing_mandatory_count"] == 1

    def test_v2_cap_at_79_low_coverage(self):
        """V2 cap em 79 quando cobertura < 70%."""
        result = _compute_final_score(
            score_competencia=100,
            score_experiencia=100,
            score_formacao=100,
            score_localidade=100,
            weights=dict(DEFAULT_WEIGHTS),
            mandatory_total=10,
            mandatory_missing=4,
            rule_version=RULE_V2,
        )
        # Coverage = 60% < 70 → cap at 79
        # Penalty = 60 (max), score = 100 - 60 = 40
        # Cap: min(40, 79) = 40 (already below)
        assert result["score_final"] == 40
        assert result["mandatory_coverage"] == 60

    def test_v1_no_penalty(self):
        """V1 não aplica penalidade nem gates."""
        result = _compute_final_score(
            score_competencia=80,
            score_experiencia=80,
            score_formacao=80,
            score_localidade=80,
            weights=dict(DEFAULT_WEIGHTS),
            mandatory_total=5,
            mandatory_missing=3,
            rule_version=RULE_V1,
        )
        assert result["score_final"] == 80
        assert result["hard_penalty"] == 0

    def test_scores_clamped_0_100(self):
        """Scores são clamped entre 0 e 100."""
        result = _compute_final_score(
            score_competencia=150,
            score_experiencia=-10,
            score_formacao=200,
            score_localidade=100,
            weights=dict(DEFAULT_WEIGHTS),
            mandatory_total=0,
            mandatory_missing=0,
            rule_version=RULE_V1,
        )
        # Clamped: 100, 0, 100, 100
        expected = round((100 * 40 + 0 * 30 + 100 * 15 + 100 * 15) / 100)
        assert result["score_final"] == expected

    def test_compat_scores_generated(self):
        """Verifica que score_filtros e score_requisitos de compat são gerados."""
        result = _compute_final_score(
            score_competencia=80,
            score_experiencia=60,
            score_formacao=90,
            score_localidade=100,
            weights={"competencia": 40, "experiencia": 30, "formacao": 15, "localidade": 15},
            mandatory_total=0,
            mandatory_missing=0,
            rule_version=RULE_V1,
        )
        assert "score_filtros" in result
        assert "score_requisitos" in result
        # score_filtros = (localidade*15 + experiencia*30) / (15+30)
        expected_filtros = round((100 * 15 + 60 * 30) / 45)
        assert result["score_filtros"] == expected_filtros
        # score_requisitos = (competencia*40 + formacao*15) / (40+15)
        expected_req = round((80 * 40 + 90 * 15) / 55)
        assert result["score_requisitos"] == expected_req

    def test_v2_perfect_score_99_cap(self):
        """V2 cap em 99 a menos que todos os scores >= 95 e sem faltantes."""
        result = _compute_final_score(
            score_competencia=90,
            score_experiencia=90,
            score_formacao=90,
            score_localidade=90,
            weights=dict(DEFAULT_WEIGHTS),
            mandatory_total=0,
            mandatory_missing=0,
            rule_version=RULE_V2,
        )
        # Base = 90, penalty = 0
        # 90 < 95 → cap at 99 → min(90, 99) = 90
        assert result["score_final"] == 90

    def test_v2_allows_99_with_high_scores(self):
        result = _compute_final_score(
            score_competencia=96,
            score_experiencia=96,
            score_formacao=96,
            score_localidade=96,
            weights=dict(DEFAULT_WEIGHTS),
            mandatory_total=3,
            mandatory_missing=0,
            rule_version=RULE_V2,
        )
        # All >= 95, missing == 0 → can reach 100
        # Base = 96, no penalty → score = 96
        # But cap check: all >= 95 and missing == 0 → no cap at 99
        assert result["score_final"] == 96


# ═══════════════════════════════════════════════════════════════════════════
# _build_vaga_context
# ═══════════════════════════════════════════════════════════════════════════

class TestBuildVagaContext:
    def test_includes_dimension_labels_with_weights(self):
        """Verifica que o contexto inclui os pesos corretos por dimensão."""
        vaga = {
            "Titulo": "Dev Python Sênior",
            "Modalidade": "Remoto",
            "Senioridade": "Sênior",
            "Escolaridade": "Superior",
            "FormacaoArea": "Ciência da Computação",
            "Cidade": "São Paulo",
            "Uf": "SP",
            "ExperienciaMinimaAnos": 5,
            "AceitaPcd": False,
            "ExigeCnh": False,
            "MatchingFiltrosRaw": "",
            "requisitos": [],
        }
        weights = {"competencia": 50, "experiencia": 20, "formacao": 20, "localidade": 10}
        context = _build_vaga_context(vaga, "", "", "", weights)

        assert "COMPETÊNCIA TÉCNICA (peso 50%)" in context
        assert "EXPERIÊNCIA PROFISSIONAL (peso 20%)" in context
        assert "FORMAÇÃO ACADÊMICA (peso 20%)" in context
        assert "LOCALIDADE E LOGÍSTICA (peso 10%)" in context

    def test_no_hardcoded_80_20(self):
        """Garante que não há mais 'peso 80%' ou 'peso 20%' hardcoded."""
        vaga = {
            "Titulo": "Test",
            "Modalidade": "",
            "Senioridade": "",
            "Escolaridade": "",
            "FormacaoArea": "",
            "Cidade": "",
            "Uf": "",
            "ExperienciaMinimaAnos": None,
            "AceitaPcd": False,
            "ExigeCnh": False,
            "MatchingFiltrosRaw": "",
            "requisitos": [],
        }
        context = _build_vaga_context(vaga, "", "", "", dict(DEFAULT_WEIGHTS))

        assert "peso 80%" not in context
        assert "peso 20%" not in context

    def test_includes_vaga_title(self):
        vaga = {
            "Titulo": "Engenheiro de Dados",
            "Modalidade": "",
            "Senioridade": "",
            "Escolaridade": "",
            "FormacaoArea": "",
            "Cidade": "",
            "Uf": "",
            "ExperienciaMinimaAnos": None,
            "AceitaPcd": False,
            "ExigeCnh": False,
            "MatchingFiltrosRaw": "",
            "requisitos": [],
        }
        context = _build_vaga_context(vaga, "", "", "", dict(DEFAULT_WEIGHTS))
        assert "Engenheiro de Dados" in context

    def test_includes_requisitos_in_competencia(self):
        vaga = {
            "Titulo": "Dev",
            "Modalidade": "",
            "Senioridade": "",
            "Escolaridade": "",
            "FormacaoArea": "",
            "Cidade": "",
            "Uf": "",
            "ExperienciaMinimaAnos": None,
            "AceitaPcd": False,
            "ExigeCnh": False,
            "MatchingFiltrosRaw": "",
            "requisitos": [],
        }
        requisitos_text = "- Python (OBRIGATÓRIO, peso 3)\n- SQL (desejável, peso 1)"
        context = _build_vaga_context(vaga, "", "", requisitos_text, dict(DEFAULT_WEIGHTS))
        assert "Python" in context
        assert "SQL" in context

    def test_includes_experience_info(self):
        vaga = {
            "Titulo": "Dev",
            "Modalidade": "",
            "Senioridade": "Pleno",
            "Escolaridade": "",
            "FormacaoArea": "",
            "Cidade": "",
            "Uf": "",
            "ExperienciaMinimaAnos": 3,
            "AceitaPcd": False,
            "ExigeCnh": False,
            "MatchingFiltrosRaw": "",
            "requisitos": [],
        }
        context = _build_vaga_context(vaga, "", "", "", dict(DEFAULT_WEIGHTS))
        assert "Pleno" in context
        assert "3 anos" in context


# ═══════════════════════════════════════════════════════════════════════════
# parse_matching_filtros_raw (Python version)
# ═══════════════════════════════════════════════════════════════════════════

class TestParseMatchingFiltrosRaw:
    def test_parses_standard_format(self):
        raw = "Modalidade: Remoto. Senioridade: Pleno. Cidade: São Paulo. UF: SP."
        result = parse_matching_filtros_raw(raw)
        assert isinstance(result, list)
        labels = {c["label"] for c in result}
        assert "Modalidade" in labels
        assert "Senioridade" in labels

    def test_empty_string_returns_empty_list(self):
        assert parse_matching_filtros_raw("") == []
        assert parse_matching_filtros_raw(None) == []

    def test_preserves_values(self):
        raw = "Habilidades: Python, SQL, React."
        result = parse_matching_filtros_raw(raw)
        hab = [c for c in result if c["label"] == "Habilidades"]
        assert len(hab) == 1
        assert "Python" in hab[0]["valor"]


# ═══════════════════════════════════════════════════════════════════════════
# Integração: weights afetam score final de forma significativa
# ═══════════════════════════════════════════════════════════════════════════

class TestWeightsImpactOnScore:
    """Testa que mudar os pesos realmente muda o score final."""

    def test_higher_competencia_weight_favors_high_competencia(self):
        """Candidato forte em competência se beneficia de peso alto em competência."""
        scores = {
            "score_competencia": 95,
            "score_experiencia": 30,
            "score_formacao": 30,
            "score_localidade": 30,
        }

        # Peso alto em competência
        result_high = _compute_final_score(
            **scores,
            weights={"competencia": 70, "experiencia": 10, "formacao": 10, "localidade": 10},
            mandatory_total=0, mandatory_missing=0, rule_version=RULE_V1,
        )
        # Peso balanceado
        result_balanced = _compute_final_score(
            **scores,
            weights={"competencia": 25, "experiencia": 25, "formacao": 25, "localidade": 25},
            mandatory_total=0, mandatory_missing=0, rule_version=RULE_V1,
        )

        assert result_high["score_final"] > result_balanced["score_final"]

    def test_localidade_weight_zero_ignores_location(self):
        """Com peso 0 em localidade, candidato em cidade errada não é penalizado."""
        result = _compute_final_score(
            score_competencia=80,
            score_experiencia=80,
            score_formacao=80,
            score_localidade=0,  # Cidade completamente errada
            weights={"competencia": 40, "experiencia": 30, "formacao": 30, "localidade": 0},
            mandatory_total=0, mandatory_missing=0, rule_version=RULE_V1,
        )
        # Com localidade peso 0, score = (80*40 + 80*30 + 80*30) / 100 = 80
        assert result["score_final"] == 80

    def test_same_scores_different_weights_different_results(self):
        """Mesmos scores com pesos diferentes produzem resultados diferentes."""
        scores_kwargs = dict(
            score_competencia=90,
            score_experiencia=50,
            score_formacao=70,
            score_localidade=60,
            mandatory_total=0,
            mandatory_missing=0,
            rule_version=RULE_V1,
        )
        r1 = _compute_final_score(
            **scores_kwargs,
            weights={"competencia": 60, "experiencia": 10, "formacao": 20, "localidade": 10},
        )
        r2 = _compute_final_score(
            **scores_kwargs,
            weights={"competencia": 10, "experiencia": 60, "formacao": 10, "localidade": 20},
        )
        assert r1["score_final"] != r2["score_final"]
        # r1 favorece competencia (90) → score maior
        assert r1["score_final"] > r2["score_final"]
