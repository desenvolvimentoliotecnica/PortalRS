using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

public sealed class Funcionario : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid? PessoaId { get; set; }
    public Pessoa? Pessoa { get; set; }

    public string Name { get; set; } = default!;
    public string Email { get; set; } = default!;
    public string? Phone { get; set; }

    public FuncionarioStatus Status { get; set; } = FuncionarioStatus.Active;

    /// <summary>Quando preenchido, o funcionário foi criado a partir deste usuário.</summary>
    public Guid? UserId { get; set; }
    public ApplicationUser? User { get; set; }

    public Guid? UnitId { get; set; }
    public Unit? Unit { get; set; }

    public Guid? AreaId { get; set; }
    public Area? Area { get; set; }

    public int Headcount { get; set; }

    public Guid? JobPositionId { get; set; }
    public JobPosition? JobPosition { get; set; }

    /// <summary>Função do funcionário (PFUNCAO no RM → RequisitoCategorias no portal).</summary>
    public Guid? RequisitoCategoriaId { get; set; }
    public RequisitoCategoria? RequisitoCategoria { get; set; }

    // ── Sprint 2: Hierarquia ──

    /// <summary>Nível hierárquico do funcionário (configurável pelo Admin).</summary>
    public Guid? NivelHierarquicoId { get; set; }
    public NivelHierarquico? NivelHierarquico { get; set; }

    /// <summary>Gestor direto (superior imediato) — self-reference.</summary>
    public Guid? GestorDiretoId { get; set; }
    public Funcionario? GestorDireto { get; set; }

    public string? AvatarFileName { get; set; }

    public string? Notes { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
