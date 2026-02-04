using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>Bloqueio de pessoa (blacklist). Extensão da Pessoa — uma pessoa bloqueada não deve ser considerada em processos.</summary>
public sealed class PessoaBloqueio : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid PessoaId { get; set; }
    public Pessoa? Pessoa { get; set; }

    [StringLength(500)]
    public string? Motivo { get; set; }

    public OrigemBloqueio OrigemBloqueio { get; set; } = OrigemBloqueio.Manual;

    public DateTimeOffset CreatedAtUtc { get; set; }

    [StringLength(120)]
    public string? CreatedByUserId { get; set; }
}
