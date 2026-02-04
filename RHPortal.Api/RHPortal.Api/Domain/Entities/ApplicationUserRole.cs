using Microsoft.AspNetCore.Identity;

namespace RhPortal.Api.Domain.Entities;

public sealed class ApplicationUserRole : IdentityUserRole<Guid>, ITenantEntity
{
    public string TenantId { get; set; } = default!;
}
