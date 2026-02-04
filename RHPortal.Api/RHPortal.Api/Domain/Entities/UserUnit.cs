using Microsoft.AspNetCore.Identity;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Junção N:N entre ApplicationUser e Unit (unidades físicas/filiais a que o usuário tem acesso).
/// </summary>
public sealed class UserUnit
{
    public Guid UserId { get; set; }
    public ApplicationUser? User { get; set; }

    public Guid UnitId { get; set; }
    public Unit? Unit { get; set; }
}
