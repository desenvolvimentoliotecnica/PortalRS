namespace RhPortal.Api.Domain.Entities;

/// <summary>Histórico de pareceres/aprovações lido do RM para uma requisição importada.</summary>
public sealed class RmRequisicaoParecer : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid? SolicitacaoVagaId { get; set; }
    public SolicitacaoVaga? SolicitacaoVaga { get; set; }

    public string TipoRequisicao { get; set; } = default!;
    public short CodColRequisicao { get; set; }
    public int IdReq { get; set; }
    public int IdParecer { get; set; }

    public DateTimeOffset? DataParecer { get; set; }
    public short? CodStatus { get; set; }
    public short? Suspensao { get; set; }
    public string? Solicitante { get; set; }
    public short? Img1 { get; set; }
    public short? CodColSolicitante { get; set; }
    public string? ChapaSolicitante { get; set; }
    public string? Parecer { get; set; }
    public string? Status { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
