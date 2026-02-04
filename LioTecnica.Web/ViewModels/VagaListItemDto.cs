namespace LioTecnica.Web.ViewModels;

public sealed record VagaListItemDto(
    Guid Id,
    string Codigo,
    string Titulo,
    string Status,

    Guid AreaId,
    string AreaCode,
    string AreaName,

    Guid DepartmentId,
    string DepartmentCode,
    string DepartmentName,

    string Modalidade,
    string Senioridade,
    int QuantidadeVagas,
    int MatchMinimoPercentual,

    bool Confidencial,
    bool Urgente,
    bool AceitaPcd,

    DateOnly DataInicio,
    DateOnly DataEncerramento,

    string Cidade,
    string Uf,

    int RequisitosTotal,
    int RequisitosObrigatorios,

    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);
