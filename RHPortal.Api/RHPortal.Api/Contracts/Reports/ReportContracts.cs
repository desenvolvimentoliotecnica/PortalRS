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

public sealed record FuncionarioRmReportColumnResponse(
    string Key,
    string Label,
    string Description
);

public sealed record FuncionarioRmReportRowResponse(
    string? CdnEmpresa,
    string? CdnEstab,
    string? CdnFuncionario,
    string? MatriculaRm,
    string? Nome,
    string? Email,
    string? Telefone,
    string StatusPortal,
    string? CodSituacaoRm,
    string? SituacaoRmDescricao,
    DateOnly? DataAdmissao,
    DateOnly? DataNascimento,
    string? Sexo,
    string? Cpf,
    string? EstadoCivil,
    string? GrauInstrucao,
    string? Naturalidade,
    string? EstadoNatal,
    string? Cep,
    string? Logradouro,
    string? NumeroEndereco,
    string? Complemento,
    string? Bairro,
    string? Cidade,
    string? Uf,
    string? Rg,
    string? RgOrgEmissor,
    string? RgUf,
    DateTime? RgDataEmissao,
    string? CarteiraTrabalho,
    string? CarteiraTrabalhoSerie,
    string? CarteiraTrabalhoUf,
    DateTime? CarteiraTrabalhoData,
    string? NumeroPis,
    string? TituloEleitor,
    string? TituloEleitorZona,
    string? TituloEleitorSecao,
    string? CertificadoReservista,
    string? CategoriaMilitar,
    string? Nacionalidade,
    string? NomePai,
    string? NomeMae,
    string? CentroCustoCode,
    string? CentroCustoDescricao,
    string? JobPositionCode,
    string? JobPositionName,
    string? CodFuncaoRm,
    string? FuncaoNomeRm,
    decimal? SalarioAtual,
    string? UnitName,
    string? GestorDiretoNome,
    string? NivelHierarquicoNome,
    string? HierarquiaDescricao,
    bool HasIncompleteData,
    DateTimeOffset UpdatedAtUtc,
    string? MovimentacaoIdReqRm,
    short? MovimentacaoTipoCodigo,
    string? MovimentacaoTipo,
    DateTime? MovimentacaoDataAbertura,
    DateTime? MovimentacaoDataConclusao,
    int? MovimentacaoCodStatus,
    string? MovimentacaoStatus,
    string? MovimentacaoCodFuncaoOrigem,
    string? MovimentacaoCodFuncaoDestino,
    string? MovimentacaoCodSecaoOrigem,
    string? MovimentacaoCodSecaoDestino,
    decimal? MovimentacaoSalarioOrigem,
    decimal? MovimentacaoSalarioDestino,
    string? MovimentacaoJustificativa,
    bool? MovimentacaoGerouSubstituicao
);

public sealed record FuncionarioRmReportResponse(
    DateTimeOffset GeneratedAtUtc,
    int TotalItems,
    IReadOnlyList<FuncionarioRmReportColumnResponse> Columns,
    IReadOnlyList<FuncionarioRmReportRowResponse> Rows
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
