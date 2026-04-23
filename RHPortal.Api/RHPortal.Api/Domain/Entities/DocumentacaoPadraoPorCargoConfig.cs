namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Override de documentação padrão por Cargo específico (JobPosition).
/// Granularidade mais fina que <see cref="DocumentacaoPadraoPorNivelCargoConfig"/>.
/// Hierarquia de resolução (mais específico vence):
///   1) override por Cargo (este)
///   2) override por NivelCargo
///   3) padrão global do tenant (<see cref="DocumentacaoPadraoConfig"/>)
/// </summary>
public sealed class DocumentacaoPadraoPorCargoConfig : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid JobPositionId { get; set; }
    public JobPosition? JobPosition { get; set; }

    /// <summary>Tipo do documento (enum TipoDocumento serializado como smallint).</summary>
    public short TipoDocumento { get; set; }

    /// <summary>0 = Obrigatório | 1 = Opcional | 2 = Não será pedido</summary>
    public short Configuracao { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
