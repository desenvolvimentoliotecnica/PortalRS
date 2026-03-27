using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Documento solicitado pelo RH ao candidato para uma pré-admissão específica.
/// O RH seleciona via checkbox quais documentos deseja receber.
/// </summary>
public sealed class PreAdmissaoDocumentoSolicitado : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid PreAdmissaoId { get; set; }
    public PreAdmissao? PreAdmissao { get; set; }

    public TipoDocumento TipoDocumento { get; set; }
    public bool Obrigatorio { get; set; } = true;

    public DateTimeOffset CreatedAtUtc { get; set; }
}
