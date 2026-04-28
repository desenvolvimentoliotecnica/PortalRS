namespace RhPortal.Api.Contracts.Feedback;

// ── Templates de Survey (Entrega 1.5 — Fase 1 Paridade Feedz) ──

public sealed record SurveyTemplateQuestionResponse(
    Guid Id, string Texto, string Tipo, int Ordem, IReadOnlyList<string>? Opcoes);

public sealed record SurveyTemplateResponse(
    Guid Id,
    string Codigo,
    string Nome,
    string? Descricao,
    string TipoSurvey,
    string? CadenciaSugerida,
    bool IsSystem,
    bool IsActive,
    int Ordem,
    int TotalQuestions,
    DateTimeOffset CriadoEmUtc,
    List<SurveyTemplateQuestionResponse> Questions
);

public sealed record SurveyTemplateCreateRequest(
    string Codigo,
    string Nome,
    string TipoSurvey,
    List<SurveyTemplateQuestionInput> Questions,
    string? Descricao = null,
    string? CadenciaSugerida = null
);

public sealed record SurveyTemplateQuestionInput(
    string Texto,
    string Tipo,
    IReadOnlyList<string>? Opcoes = null
);

public sealed record SurveyFromTemplateRequest(
    Guid TemplateId,
    string Title,
    DateTimeOffset? StartAtUtc = null,
    DateTimeOffset? EndAtUtc = null
);
