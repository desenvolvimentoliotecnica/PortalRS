using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Parâmetros globais por tipo de fluxo de aprovação.
/// Um registro por (TenantId, TipoFluxo). Criado com defaults na primeira leitura.
/// </summary>
public sealed class FluxoAprovacaoConfig : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;
    public TipoFluxoAprovacao TipoFluxo { get; set; }

    /// <summary>
    /// Define qual unidade de lotação é usada como referência ao resolver
    /// aprovadores do tipo ResponsavelUnidade/Pai/Raiz.
    /// </summary>
    public ReferenciaUnidade ReferenciaUnidade { get; set; } = ReferenciaUnidade.Solicitante;

    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
