using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Motivo de requisição de vaga parametrizável por tenant.
/// Cada tenant recebe, no provisionamento, o conjunto seed que corresponde aos motivos que eram
/// hardcoded no enum MotivoRequisicaoVaga — e pode depois criar/ajustar via tela de cadastro.
/// </summary>
public sealed class MotivoRequisicaoVagaConfig : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Código curto estável, usado por integrações e pelo seed (ex.: "PedidoDemissao"). Único por tenant.</summary>
    [Required]
    [MaxLength(60)]
    public string Codigo { get; set; } = default!;

    /// <summary>Nome exibido na UI (dropdown do form de solicitação).</summary>
    [Required]
    [MaxLength(120)]
    public string Nome { get; set; } = default!;

    [MaxLength(500)]
    public string? Descricao { get; set; }

    /// <summary>Efeito no headcount quando esta solicitação é aprovada e efetivada.</summary>
    public EfeitoHeadcount EfeitoHeadcount { get; set; } = EfeitoHeadcount.Aumenta;

    public bool IsActive { get; set; } = true;

    /// <summary>Ordem de exibição no dropdown.</summary>
    public int Ordem { get; set; }

    /// <summary>Motivos seed (criados no provisionamento do tenant) são protegidos contra exclusão — mas podem ser editados/desativados.</summary>
    public bool IsSystem { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
