using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

public sealed class Funcionario : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid? PessoaId { get; set; }
    public Pessoa? Pessoa { get; set; }

    public string Name { get; set; } = default!;
    public string? Email { get; set; }
    public string? Phone { get; set; }

    public FuncionarioStatus Status { get; set; } = FuncionarioStatus.Active;

    /// <summary>Quando preenchido, o funcionário foi criado a partir deste usuário.</summary>
    public Guid? UserId { get; set; }
    public ApplicationUser? User { get; set; }

    public Guid? UnitId { get; set; }
    public Unit? Unit { get; set; }

    /// <summary>Unidade de lotação TOTVS Datasul (cod_unid_lotac).</summary>
    public Guid? UnidadeLotacaoId { get; set; }
    public UnidadeLotacao? UnidadeLotacao { get; set; }

    public int Headcount { get; set; }

    public Guid? JobPositionId { get; set; }
    public JobPosition? JobPosition { get; set; }

    // ── Sprint 2: Hierarquia ──

    /// <summary>Nível hierárquico do funcionário (configurável pelo Admin).</summary>
    public Guid? NivelHierarquicoId { get; set; }
    public NivelHierarquico? NivelHierarquico { get; set; }

    /// <summary>Gestor direto (superior imediato) — self-reference.</summary>
    public Guid? GestorDiretoId { get; set; }
    public Funcionario? GestorDireto { get; set; }

    public string? AvatarFileName { get; set; }

    public string? Notes { get; set; }

    // ── Chaves de integração TOTVS Datasul ──

    /// <summary>Código do funcionário no TOTVS Datasul (cdn_funcionario).</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(12)]
    public string? CdnFuncionario { get; set; }

    /// <summary>Código da empresa no TOTVS Datasul (cdn_empresa).</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(3)]
    public string? CdnEmpresa { get; set; }

    /// <summary>Código do estabelecimento no TOTVS Datasul (cdn_estab).</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(5)]
    public string? CdnEstab { get; set; }

    /// <summary>Centro de custo do funcionário.</summary>
    public Guid? CentroCustoId { get; set; }
    public CentroCusto? CentroCusto { get; set; }

    /// <summary>Nível de cargo TOTVS Datasul (cdn_niv_cargo). Preenchido automaticamente no import.</summary>
    public Guid? NivelCargoId { get; set; }
    public NivelCargo? NivelCargo { get; set; }

    /// <summary>Código bruto do nível de cargo no TOTVS (cdn_niv_cargo). Usado como fallback de exibição quando NivelCargo não está cadastrado.</summary>
    public int? CdnNivCargo { get; set; }

    /// <summary>
    /// Indica que o colaborador possui campos obrigatórios não preenchidos
    /// (Pessoa, Cargo, Unidade de Lotação, Nível Hierárquico, Centro de Custo).
    /// Atualizado automaticamente em cada operação de escrita.
    /// Usado para filtros de integração e alertas na tela.
    /// </summary>
    public bool HasIncompleteData { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }

    /// <summary>Recalcula e aplica HasIncompleteData com base nos campos obrigatórios.</summary>
    public void RefreshIncompleteData() =>
        HasIncompleteData =
            string.IsNullOrEmpty(Name) ||
            PessoaId == null ||
            JobPositionId == null ||
            UnidadeLotacaoId == null ||
            (NivelHierarquicoId == null && NivelCargoId == null && CdnNivCargo == null) ||
            CentroCustoId == null;
}
