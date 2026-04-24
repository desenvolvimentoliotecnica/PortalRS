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
    IReadOnlyList<string> RequisitosObrigatoriosFaltando);
