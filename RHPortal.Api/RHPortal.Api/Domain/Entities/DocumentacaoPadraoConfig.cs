namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Configuração padrão por tenant de quais documentos são solicitados na admissão
/// e se são obrigatórios, opcionais ou não serão pedidos.
/// </summary>
public sealed class DocumentacaoPadraoConfig : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Tipo do documento (enum TipoDocumento serializado como smallint).</summary>
    public short TipoDocumento { get; set; }

    /// <summary>0 = Obrigatório | 1 = Opcional | 2 = Não será pedido</summary>
    public short Configuracao { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
