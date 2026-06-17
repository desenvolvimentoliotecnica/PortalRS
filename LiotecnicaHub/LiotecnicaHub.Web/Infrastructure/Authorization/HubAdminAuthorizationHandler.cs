using LiotecnicaHub.Web.Application.Authentication;
using LiotecnicaHub.Web.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

namespace LiotecnicaHub.Web.Infrastructure.Authorization;

public sealed class HubAdminRequirement : IAuthorizationRequirement;

public sealed class HubAdminAuthorizationHandler : AuthorizationHandler<HubAdminRequirement>
{
    private readonly HubDbContext _db;

    public HubAdminAuthorizationHandler(HubDbContext db) => _db = db;

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        HubAdminRequirement requirement)
    {
        var email = context.User.FindFirst(HubClaimTypes.Email)?.Value;
        if (string.IsNullOrWhiteSpace(email))
            return;

        email = email.Trim().ToLowerInvariant();
        var isAdmin = await _db.Admins.AsNoTracking().AnyAsync(a => a.Email == email);
        if (isAdmin)
            context.Succeed(requirement);
    }
}
