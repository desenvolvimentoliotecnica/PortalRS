using Microsoft.AspNetCore.Identity;

namespace RhPortal.Api.Domain.Entities;

public sealed class ApplicationUser : IdentityUser<Guid>, ITenantEntity
{
    public string TenantId { get; set; } = default!;
    public string FullName { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;

    /// <summary>Quando preenchido, o usuário está vinculado a este funcionário (ex.: perfil Gestor de área).</summary>
    public Guid? FuncionarioId { get; set; }
    public Funcionario? Funcionario { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
