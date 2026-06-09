namespace RhPortal.Api.Contracts.Funcionarios;

public sealed record FuncionarioMovimentacaoListItem(
    Guid Id,
    Guid? FuncionarioId,
    string ChapaRm,
    string IdReqRm,
    short TipoMovimentacao,
    string? TipoDescricao,
    DateTime DataAbertura,
    DateTime? DataConclusao,
    int CodStatus,
    string? StatusDescricao,
    string? CodFuncaoOrigem,
    string? CodFuncaoDestino,
    string? CodSecaoOrigem,
    string? CodSecaoDestino,
    int? IdHierarquiaOrigemRm,
    int? IdHierarquiaDestinoRm,
    decimal? SalarioOrigem,
    decimal? SalarioDestino,
    string? GestorHistoricoChapaRm,
    string? GestorHistoricoNome,
    bool? GerouSubstituicao);

public sealed class FuncionarioMovimentacaoUpsertRequest
{
    public string IdReqRm { get; set; } = default!;
    public string ChapaRm { get; set; } = default!;
    public short TipoMovimentacao { get; set; }
    public string? TipoDescricao { get; set; }
    public DateTime DataAbertura { get; set; }
    public DateTime? DataConclusao { get; set; }
    public DateTime? DataCancelamento { get; set; }
    public int CodStatus { get; set; }
    public string? StatusDescricao { get; set; }
    public string? CodFuncaoOrigem { get; set; }
    public string? CodFuncaoDestino { get; set; }
    public string? CodSecaoOrigem { get; set; }
    public string? CodSecaoDestino { get; set; }
    public int? IdHierarquiaOrigemRm { get; set; }
    public int? IdHierarquiaDestinoRm { get; set; }
    public decimal? SalarioOrigem { get; set; }
    public decimal? SalarioDestino { get; set; }
    public string? Justificativa { get; set; }
    public string? GestorHistoricoChapaRm { get; set; }
    public string? GestorHistoricoNome { get; set; }
    public bool? GerouSubstituicao { get; set; }
}

public sealed class FuncionarioMovimentacaoBulkRequest
{
    public List<FuncionarioMovimentacaoUpsertRequest> Items { get; set; } = new();
}

public sealed record FuncionarioMovimentacaoBulkResponse(int Created, int Updated, int Total);

public sealed record FuncionarioMovimentacaoComNomeListItem(
    Guid Id,
    Guid? FuncionarioId,
    string? FuncionarioNome,
    string ChapaRm,
    string IdReqRm,
    short TipoMovimentacao,
    string? TipoDescricao,
    DateTime DataAbertura,
    DateTime? DataConclusao,
    int CodStatus,
    string? StatusDescricao,
    string? CodFuncaoOrigem,
    string? CodFuncaoDestino,
    decimal? SalarioOrigem,
    decimal? SalarioDestino,
    string? GestorHistoricoChapaRm,
    string? GestorHistoricoNome);
