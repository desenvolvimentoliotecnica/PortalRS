using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Unidade de Lotação para integração TOTVS Datasul.
/// Suporta hierarquia pai-filho (estrut_plano_lotac) e responsável vinculado por FK.
/// </summary>
public sealed class UnidadeLotacao : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Código do plano de lotação TOTVS (cdn_plano_lotac). Parte da chave composta com Code.</summary>
    [Required]
    [MaxLength(10)]
    public string CdnPlanoLotac { get; set; } = default!;

    /// <summary>Código da unidade de lotação (cod_unid_lotac)</summary>
    [Required]
    [MaxLength(30)]
    public string Code { get; set; } = default!;

    /// <summary>Descrição da unidade de lotação (des_unid_lotac)</summary>
    [Required]
    [MaxLength(120)]
    public string Description { get; set; } = default!;

    /// <summary>Localização física ou código de local</summary>
    [MaxLength(120)]
    public string? Location { get; set; }

    /// <summary>Observações</summary>
    [MaxLength(500)]
    public string? Notes { get; set; }

    public bool IsActive { get; set; } = true;

    // ── Hierarquia ──

    /// <summary>
    /// Unidade pai na hierarquia organizacional (cod_unid_lotac_pai de estrut_plano_lotac).
    /// Null = unidade raiz.
    /// </summary>
    public Guid? ParentId { get; set; }
    public UnidadeLotacao? Parent { get; set; }
    public ICollection<UnidadeLotacao>? Children { get; set; }

    /// <summary>
    /// Nível hierárquico vindo do TOTVS (num_niv_unid_lotac). Editável. Default 1 = raiz.
    /// </summary>
    public int Level { get; set; } = 1;

    /// <summary>
    /// Sequência dentro do nível (num_seq_unid_lotac). Opcional, usado para ordenação.
    /// </summary>
    public int? SequenceNumber { get; set; }

    // ── Responsável / Dono ──

    /// <summary>
    /// Funcionário responsável pela unidade (unid_lotac_resp).
    /// Vinculado pela chave TOTVS (CdnEmpresa + CdnEstab + CdnFuncionario) na importação.
    /// </summary>
    public Guid? OwnerFuncionarioId { get; set; }
    public Funcionario? OwnerFuncionario { get; set; }

    /// <summary>Empresa TOTVS do funcionário responsável (cdn_empresa).</summary>
    [MaxLength(3)]
    public string? OwnerCdnEmpresa { get; set; }

    /// <summary>Estabelecimento TOTVS do funcionário responsável (cdn_estab).</summary>
    [MaxLength(5)]
    public string? OwnerCdnEstab { get; set; }

    /// <summary>Código TOTVS do funcionário responsável (cdn_funcionario).</summary>
    [MaxLength(12)]
    public string? OwnerCdnFuncionario { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
