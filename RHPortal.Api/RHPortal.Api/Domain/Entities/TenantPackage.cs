namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Habilitação de pacote comercial (entitlement de alto nível contratado pelo Owner) para um tenant.
/// Armazenado no master, gerenciado pelo Owner.
/// Ver <c>Infrastructure.Modules.PackageCatalog</c> para a lista code-first de pacotes.
/// Um módulo com <c>PackageKey</c> só fica efetivamente habilitado se o pacote-pai também estiver.
/// </summary>
public sealed class TenantPackage
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;
    public string PackageKey { get; set; } = default!;
    public bool IsEnabled { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
    public Guid? UpdatedByOwnerId { get; set; }

    public Tenant? Tenant { get; set; }
    public Owner? UpdatedByOwner { get; set; }
}
