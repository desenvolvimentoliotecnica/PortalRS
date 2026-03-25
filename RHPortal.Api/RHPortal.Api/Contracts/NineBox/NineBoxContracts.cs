namespace RhPortal.Api.Contracts.NineBox;

/// <summary>Item da matriz Nine-in-Box com posição atual do funcionário.</summary>
public sealed record NineBoxMatrizItemResponse(
    Guid AssessmentId,
    Guid FuncionarioId,
    string FuncionarioNome,
    string? Cargo,
    string? AreaNome,
    string? NivelHierarquicoNome,
    int Desempenho,
    int Potencial,
    string? Observacoes,
    string AvaliadorNome,
    DateTimeOffset CriadoEmUtc
);

/// <summary>Dados de uma avaliação Nine-in-Box.</summary>
public sealed record NineBoxAssessmentResponse(
    Guid Id,
    Guid FuncionarioId,
    Guid AvaliadorId,
    int Desempenho,
    int Potencial,
    string? Observacoes,
    DateTimeOffset CriadoEmUtc
);

/// <summary>Cria ou atualiza a posição de um funcionário na matriz.</summary>
public sealed record NineBoxUpsertRequest(
    Guid FuncionarioId,
    int Desempenho,  // 1, 2 ou 3
    int Potencial,   // 1, 2 ou 3
    string? Observacoes
);
