namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Override de documentação padrão por NivelCargo (cargo macro).
/// Quando houver registro para um NivelCargo + TipoDocumento, prevalece sobre
/// o <see cref="DocumentacaoPadraoConfig"/> global do tenant.
/// </summary>
public sealed class DocumentacaoPadraoPorNivelCargoConfig : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid NivelCargoId { get; set; }
    public NivelCargo? NivelCargo { get; set; }

    /// <summary>Tipo do documento (enum TipoDocumento serializado como smallint).</summary>
    public short TipoDocumento { get; set; }

    /// <summary>0 = Obrigatório | 1 = Opcional | 2 = Não será pedido</summary>
    public short Configuracao { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
