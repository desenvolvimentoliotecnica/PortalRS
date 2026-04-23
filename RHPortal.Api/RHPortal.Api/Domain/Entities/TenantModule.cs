namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Habilitação de módulo (funcionalidade comercial) para um tenant.
/// Armazenado no master, gerenciado pelo Owner.
/// Ver <c>Infrastructure.Modules.ModuleCatalog</c> para a lista code-first de módulos.
/// </summary>
public sealed class TenantModule
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;
    public string ModuleKey { get; set; } = default!;
    public bool IsEnabled { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
    public Guid? UpdatedByOwnerId { get; set; }

    public Tenant? Tenant { get; set; }
    public Owner? UpdatedByOwner { get; set; }
}
