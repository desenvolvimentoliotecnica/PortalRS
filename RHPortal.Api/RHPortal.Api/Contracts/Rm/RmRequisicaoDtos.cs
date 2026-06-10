namespace RhPortal.Api.Contracts.Rm;

/// <summary>Leitura pontual de CODSTATUS + descrição por vínculo TIPO|COL|IDREQ.</summary>
public sealed record RmRequisicaoCodStatusSnapshot(
    int CodStatusRm,
    string? StatusDescricao,
    string TipoRequisicao,
    int CodColRequisicao,
    int IdReq);

public sealed class RmRequisicaoListQuery
{
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;

    /// <summary>Filtro exato pelo código <c>TIPO_REQUISICAO</c> (ex.: DESLIGAMENTO).</summary>
    public string? TipoRequisicao { get; init; }

    public DateOnly? DataAberturaDe { get; init; }
    public DateOnly? DataAberturaAte { get; init; }

    /// <summary>Busca parcial em <c>CAST(IDREQ AS VARCHAR)</c> ou <c>JUSTIFICATIVA</c>.</summary>
    public string? Search { get; init; }

    /// <summary>Filtra por um conjunto de <c>CODSTATUS</c> do RM.</summary>
    public int[]? CodStatusIn { get; init; }

    /// <summary>Coluna de ordenação da listagem RM.</summary>
    public string? SortBy { get; init; }

    /// <summary>Direção de ordenação: asc ou desc.</summary>
    public string? SortDir { get; init; }
}

public sealed class RmRequisicaoListResponse
{
    public IReadOnlyList<RmRequisicaoRowDto> Items { get; init; } = [];
    public int TotalCount { get; init; }
}

public sealed class RmRequisicaoRowDto
{
    public string TipoRequisicao { get; init; } = "";
    public int? Codcolrequisicao { get; init; }
    public int Idreq { get; init; }
    public string? Justificativa { get; init; }
    public DateTime? Dataabertura { get; init; }
    public DateTime? Dataprevista { get; init; }
    public DateTime? Dataconclusao { get; init; }
    public DateTime? Datacancelamento { get; init; }
    public int? Codstatus { get; init; }
    public string? StatusDescricao { get; init; }
    public bool? StatusPermiteAlterar { get; init; }
    public int? Codcolrequisitante { get; init; }
    public string? Chaparequisitante { get; init; }
    public string? NomeRequisitante { get; init; }
    public int? Codatendimento { get; init; }
    public int? Codlocal { get; init; }
    public string? AtendimentoAssunto { get; init; }
    public string? Tiporeqpai { get; init; }
    public int? Idreqpai { get; init; }
    public string? ChapaFuncionario { get; init; }
    public string? NomeFuncionarioEnvolvido { get; init; }
    public string? ChapaSubstituto { get; init; }
    public string? NomeFuncionarioSubstituto { get; init; }
    public int? Numvagas { get; init; }
    public string? Codfilial { get; init; }
    public string? Codsecao { get; init; }
    public string? Codfuncao { get; init; }
    public string? Codtabelasalarial { get; init; }
    public string? Codnivelsalarial { get; init; }
    public string? Codfaixasalarial { get; init; }
    public string? NomeFuncao { get; init; }
    public string? DescricaoFuncao { get; init; }
    public decimal? Vlrsalario { get; init; }
    public string? Codccusto { get; init; }
    public string? Reccreatedby { get; init; }
    public DateTime? Reccreatedon { get; init; }
    public string? Recmodifiedby { get; init; }
    public DateTime? Recmodifiedon { get; init; }
}

public sealed class RmRequisicaoImportRequest
{
    public int PageSize { get; init; } = 100;
    public DateOnly? DataAberturaDe { get; init; }
    public DateOnly? DataAberturaAte { get; init; }
    public string? TipoRequisicao { get; init; }
    public int[]? CodStatusIn { get; init; }
}

public sealed record RmRequisicaoImportResponse(
    int TotalLidos,
    int Criados,
    int Atualizados,
    int VagasCriadas,
    int Ignorados,
    int Erros,
    IReadOnlyList<string> Mensagens);

public sealed class RmRequisicaoParecerRowDto
{
    public int CodColRequisicao { get; init; }
    public int IdReq { get; init; }
    public int IdParecer { get; init; }
    public DateTimeOffset? DataParecer { get; init; }
    public int? CodStatus { get; init; }
    public int? Suspensao { get; init; }
    public string? Solicitante { get; init; }
    public int? Img1 { get; init; }
    public int? CodColSolicitante { get; init; }
    public string? ChapaSolicitante { get; init; }
    public string? Parecer { get; init; }
    public string? Status { get; init; }
}
