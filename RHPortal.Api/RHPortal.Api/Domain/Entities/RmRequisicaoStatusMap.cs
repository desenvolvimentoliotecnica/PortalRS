using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Mapeia <c>CODSTATUS</c> da requisição no TOTVS RM para chaves de estado do Portal (SYN-01).
/// Dados parametrizáveis por tenant — sem seed obrigatório na migração.
/// </summary>
public sealed class RmRequisicaoStatusMap : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Código status no RM (<c>CODSTATUS</c>).</summary>
    public int CodStatusRm { get; set; }

    /// <summary>Nome do membro em <see cref="RhPortal.Api.Domain.Enums.SolicitacaoStatus"/> (ex.: PendenteTriagem).</summary>
    [Required, MaxLength(80)]
    public string PortalStatusKey { get; set; } = default!;

    /// <summary>Menor número vence quando houver várias correspondências iguais (opcional).</summary>
    public int? Priority { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAtUtc { get; set; }
}
