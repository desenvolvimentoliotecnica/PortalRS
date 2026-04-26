namespace RhPortal.Api.Contracts.Desligamentos;

public sealed record DesligamentoListItem(
    Guid Id,
    string IdReqRm,
    string ChapaRm,
    Guid? FuncionarioId,
    string? FuncionarioNome,
    string? MotivoRescisaoDescricao,
    string? TipoRescisaoDescricao,
    bool GerouSubstituicao,
    DateTime DataAbertura,
    DateTime? DataConclusao,
    int CodStatus,
    string StatusDescricao);

public sealed record DesligamentoDetalheResponse(
    Guid Id,
    string IdReqRm,
    string ChapaRm,
    Guid? FuncionarioId,
    string? FuncionarioNome,
    string? CodMotivoRescisao,
    string? MotivoRescisaoDescricao,
    string? CodTipoRescisao,
    string? TipoRescisaoDescricao,
    bool GerouSubstituicao,
    DateTime DataAbertura,
    DateTime? DataPrevista,
    DateTime? DataConclusao,
    DateTime? DataCancelamento,
    int CodStatus,
    string StatusDescricao,
    string? Justificativa,
    int? NumDiasAviso,
    Guid? VagaSubstituicaoId,
    string? VagaSubstituicaoTitulo,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);

public sealed class DesligamentoUpsertRequest
{
    public string IdReqRm { get; set; } = default!;
    public string ChapaRm { get; set; } = default!;
    public string? CodMotivoRescisao { get; set; }
    public string? MotivoRescisaoDescricao { get; set; }
    public string? CodTipoRescisao { get; set; }
    public string? TipoRescisaoDescricao { get; set; }
    public bool GerouSubstituicao { get; set; }
    public DateTime DataAbertura { get; set; }
    public DateTime? DataPrevista { get; set; }
    public DateTime? DataConclusao { get; set; }
    public DateTime? DataCancelamento { get; set; }
    public int CodStatus { get; set; }
    public string? Justificativa { get; set; }
    public int? NumDiasAviso { get; set; }
}

public sealed class DesligamentoBulkUpsertRequest
{
    public List<DesligamentoUpsertRequest> Items { get; set; } = new();
}

public sealed record DesligamentoBulkUpsertResponse(int Created, int Updated, int Total);
