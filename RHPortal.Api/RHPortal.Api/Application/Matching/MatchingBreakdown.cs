namespace RhPortal.Api.Application.Matching;

/// <summary>
/// Critério individual no breakdown do matching: nome, peso configurado, score
/// obtido (0-100), contribuição final (peso × score / 100) e itens textuais
/// usados como evidência.
/// </summary>
public sealed record MatchingCriterio(
    string Nome,
    int Peso,
    int Score,
    decimal Contribuicao,
    /// <summary>Itens da DescricaoCargo (ou texto similar) que bateram. Ex.: ["Hardware", "Microsoft Office"].</summary>
    IReadOnlyList<string> ItensCobertos,
    /// <summary>Itens não encontrados no perfil. Útil para o RH ver gaps.</summary>
    IReadOnlyList<string> ItensFaltando);

/// <summary>
/// Resultado completo do matching com breakdown explicável: o RH abre uma vaga
/// e vê não só o score (78%) mas também por que (Competência 85% × peso 30 =
/// 25.5pts; Localidade 60% × peso 15 = 9pts; ...).
/// </summary>
public sealed record MatchingBreakdown(
    Guid CandidatoId,
    Guid VagaId,
    int ScoreFinal,
    bool PassouMatchMinimo,
    /// <summary>Distância em km entre candidato e empresa da vaga (null se não geocodificado).</summary>
    double? DistanciaKm,
    /// <summary>Critérios usados — só inclui os com peso > 0.</summary>
    IReadOnlyList<MatchingCriterio> Criterios,
    /// <summary>True se algum requisito obrigatório do template não foi atendido — score é capado em 60.</summary>
    bool TemRequisitoObrigatorioFaltando,
    IReadOnlyList<string> RequisitosObrigatoriosFaltando,
    /// <summary>
    /// Modo do cálculo:
    /// <c>"ai"</c> — Híbrido completo (TF-IDF + embeddings Ollama + localidade). Preferido sempre que disponível.
    /// <c>"semantic"</c> — Léxico semântico (TF-IDF + stems + sinônimos + localidade) quando Ollama indisponível.
    /// <c>"lexical"</c> — Endpoint legado sem localidade (raramente usado).
    /// </summary>
    string Modo = "lexical",
    /// <summary>Score semântico agregado 0-100 (null se modo = "lexical"). Baseado em kNN pgvector × candidato × itens DNALIO.</summary>
    int? ScoreSemantico = null,
    /// <summary>Score léxico agregado 0-100 (null se modo = "lexical"). Equivale ao ScoreFinal em modo puramente léxico.</summary>
    int? ScoreLexico = null,
    /// <summary>Top-3 itens DNALIO semanticamente mais próximos do CV — útil pra UI explicar similaridades não óbvias.</summary>
    IReadOnlyList<SemanticEvidence>? EvidenciasSemanticas = null,
    /// <summary>Explicação textual gerada por LLM (opcional — presente quando rerank habilitado).</summary>
    string? ExplicacaoIa = null);

/// <summary>
/// Evidência de similaridade semântica: item DNALIO que mais se aproxima do
/// perfil do candidato, com score cosseno (0..1).
/// </summary>
public sealed record SemanticEvidence(
    string Categoria,
    string? Subcategoria,
    string Texto,
    double Similaridade);
