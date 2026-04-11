namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Nível de cargo para integração TOTVS Datasul.
/// Baseado na tabela niv_cargo do Datasul (cdn_niv_cargo, nom_reduz_niv_cargo, nom_complet_niv_cargo).
/// </summary>
public sealed class NivelCargo : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Código numérico do nível de cargo no TOTVS Datasul (cdn_niv_cargo).</summary>
    public int CdnNivCargo { get; set; }

    /// <summary>Nome reduzido do nível (nom_reduz_niv_cargo) — até 6 caracteres.</summary>
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(6)]
    public string NomReduz { get; set; } = default!;

    /// <summary>Nome completo do nível (nom_complet_niv_cargo) — até 40 caracteres.</summary>
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(40)]
    public string NomComplet { get; set; } = default!;

    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
