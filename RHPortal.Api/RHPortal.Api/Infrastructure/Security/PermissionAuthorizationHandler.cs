using Microsoft.AspNetCore.Authorization;

namespace RhPortal.Api.Infrastructure.Security;

public sealed class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    /// <summary>Roles que recebem bypass automático de qualquer checagem de permissão.</summary>
    private static readonly HashSet<string> SuperRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        "Owner", "ApiKey", "Admin", "Administrador"
    };

    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, PermissionRequirement requirement)
    {
        // Super-roles passam por qualquer checagem (Owner global, ApiKey de integração,
        // Admin/Administrador do tenant — equivalentes a "tudo permitido").
        foreach (var r in SuperRoles)
        {
            if (context.User.IsInRole(r))
            {
                context.Succeed(requirement);
                return Task.CompletedTask;
            }
        }

        if (context.User.HasClaim(PermissionConstants.ClaimType, requirement.Permission))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
