namespace RhPortal.Api.Contracts.Reports;

public sealed record ReportCatalogItemResponse(
    string Id,
    string Icon,
    string Title,
    string Desc,
    string Scope
);

public sealed record ReportCellResponse(
    string? Text,
    string? ClassName,
    string? Icon
);

public sealed record ReportDataResponse(
    IReadOnlyList<string> Labels,
    IReadOnlyList<int> Values,
    IReadOnlyList<string> Headers,
    IReadOnlyList<IReadOnlyList<ReportCellResponse>> Rows
);

public sealed record ReportLotacaoLookupResponse(
    Guid Id,
    string? Description
);

public sealed record ReportVagaLookupResponse(
    Guid Id,
    string? Codigo,
    string Titulo
);

/// <summary>Uma linha do relatório SLA por recrutador ou por área.</summary>
public sealed record SlaVagaReportRowResponse(
    string GrupoNome,
    int Total,
    int DentroSla,
    int ForaSla,
    double? MediaDias
);

/// <summary>Relatório SLA de vaga: agrupado por recrutador e por área.</summary>
public sealed record SlaVagaReportResponse(
    IReadOnlyList<SlaVagaReportRowResponse> PorRecrutador,
    IReadOnlyList<SlaVagaReportRowResponse> PorArea,
    int DiasMetaGlobal
);
