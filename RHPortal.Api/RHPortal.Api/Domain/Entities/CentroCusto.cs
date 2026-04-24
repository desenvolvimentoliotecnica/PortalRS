namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Centro de Custo — unidade organizacional consolidada da plataforma.
///
/// Consolidação (Sessão 31.2, Voltage.RenderRH):
///   Esta entidade absorve o conceito de <c>Area</c> (organograma hierárquico) e
///   <c>Department</c> (unidade operacional com gestor/local/headcount). Ambas
///   foram removidas e migradas para esta tabela, unificando em um único
///   cadastro toda a divisão organizacional do tenant.
///
/// Origem TOTVS:
///   Os campos <c>Code</c> (30 chars), <c>Description</c>, <c>Manager</c>,
///   <c>Notes</c>, <c>EmpresaId</c>, <c>ValidFrom/Until</c> preservam compatibilidade
///   com <c>apisfaltccusto.p</c> (Protheus) e o payload de integração TOTVS Datasul.
///
/// Novos campos (absorvidos de Department e Area):
///   <c>Headcount</c>, <c>Phone</c>, <c>BranchOrLocation</c> (de Department);
///   <c>OwnerFuncionarioId</c> / <c>OwnerFuncionario</c> (de Area).
/// </summary>
public sealed class CentroCusto : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Código do centro de custo (max 30 caracteres — limite Protheus).</summary>
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(30)]
    public string Code { get; set; } = default!;

    /// <summary>Descrição do centro de custo (antiga "Name" de Area/Department).</summary>
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(120)]
    public string Description { get; set; } = default!;

    /// <summary>
    /// Gerente ou responsável (campo livre, legado TOTVS). Para vínculo com
    /// <see cref="Funcionario"/> prefira <see cref="OwnerFuncionarioId"/>.
    /// </summary>
    [System.ComponentModel.DataAnnotations.MaxLength(120)]
    public string? Manager { get; set; }

    /// <summary>Observações.</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(500)]
    public string? Notes { get; set; }

    /// <summary>Descrição detalhada (absorvido de <c>Area.Description</c>).</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(1000)]
    public string? Description2 { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>Data de início da vigência (opcional).</summary>
    public DateOnly? ValidFrom { get; set; }

    /// <summary>Data de fim da vigência. Se menor que hoje, o CC é tratado como inativo no lookup.</summary>
    public DateOnly? ValidUntil { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public bool IsExpired => ValidUntil.HasValue && ValidUntil.Value < DateOnly.FromDateTime(DateTime.UtcNow);

    public Guid? EmpresaId { get; set; }
    public Empresa? Empresa { get; set; }

    /// <summary>
    /// Centro de custo pai na árvore organizacional. Null = CC raiz.
    /// Agora cobre o organograma completo do tenant (após absorção de Area).
    /// </summary>
    public Guid? ParentId { get; set; }
    public CentroCusto? Parent { get; set; }
    public ICollection<CentroCusto>? Children { get; set; }

    // ── Campos absorvidos de Department (unidade operacional) ──

    /// <summary>Headcount planejado (absorvido de <c>Department.Headcount</c>).</summary>
    public int Headcount { get; set; }

    /// <summary>Telefone da unidade (absorvido de <c>Department.Phone</c>).</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(40)]
    public string? Phone { get; set; }

    /// <summary>Filial ou localização física (absorvido de <c>Department.BranchOrLocation</c>).</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(160)]
    public string? BranchOrLocation { get; set; }

    // ── Campo absorvido de Area (dono organizacional) ──

    /// <summary>
    /// Funcionário responsável (dono) desta unidade organizacional.
    /// Absorvido de <c>Area.OwnerFuncionarioId</c>; delete-behavior SET NULL.
    /// </summary>
    public Guid? OwnerFuncionarioId { get; set; }
    public Funcionario? OwnerFuncionario { get; set; }

    /// <summary>
    /// Coleção de funcionários lotados neste centro de custo.
    ///
    /// Propósito técnico: existe para **desambiguar** o pareamento EF Core entre
    /// <see cref="OwnerFuncionario"/> (ref) e <see cref="Funcionario.CentroCusto"/> (ref).
    /// Sem esta coleção explícita, a convenção do EF assume relação 1:1 inversa
    /// entre as duas referências e marca o índice em <c>OwnerFuncionarioId</c>
    /// como <c>UNIQUE</c>, o que está semanticamente errado (um funcionário
    /// pode ser dono de apenas um CC, mas um CC pode ter vários funcionários
    /// lotados — que é o que esta coleção representa).
    ///
    /// Configurada em <c>AppDbContext.OnModelCreating</c> como o inverso explícito
    /// da relação <c>Funcionario.CentroCusto</c>, forçando 1:N.
    /// </summary>
    public ICollection<Funcionario>? Funcionarios { get; set; }
}
