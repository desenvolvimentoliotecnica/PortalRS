using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Vagas;

public sealed record VagaListItemResponse(
    Guid Id,
    string? Codigo,
    string Titulo,
    VagaStatus Status,

    /// <summary>Centro de Custo — absorveu Area + Department em 31.2.</summary>
    Guid? CentroCustoId,
    string? CentroCustoCode,
    string? CentroCustoNome,

    VagaModalidade? Modalidade,
    VagaSenioridade? Senioridade,
    int QuantidadeVagas,
    int MatchMinimoPercentual,

    bool Confidencial,
    bool Urgente,
    bool AceitaPcd,

    DateOnly? DataInicio,
    DateOnly? DataEncerramento,
    DateTimeOffset? DataAbertura,
    int? SlaDiasMetaFechamento,

    string? Cidade,
    string? Uf,

    int RequisitosTotal,
    int RequisitosObrigatorios,

    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,

    int HeadcountAutorizado,
    int HeadcountOcupado,
    bool IsEstrutural,

    // Headcount provisório (substituição em andamento)
    int HeadcountProvisorio,
    DateTimeOffset? HeadcountProvisorioExpiresAtUtc,

    // Alerta de vaga sem preenchimento
    bool AlertaVagaSemFill,
    int? AlertaDiasSemFill,
    DateTimeOffset? AlertaSnoozeAteUtc
);
