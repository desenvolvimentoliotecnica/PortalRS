using Microsoft.AspNetCore.Authorization;

namespace RhPortal.Api.Infrastructure.Security;

/// <summary>
/// Bloqueia o acesso à rota se o módulo informado não estiver habilitado para o tenant corrente.
/// Funciona em conjunto com <see cref="ModuleAuthorizationHandler"/> e <see cref="PermissionPolicyProvider"/>.
/// </summary>
public sealed class RequireModuleAttribute : AuthorizeAttribute
{
    public RequireModuleAttribute(string moduleKey)
    {
        Policy = $"{PermissionConstants.ModulePolicyPrefix}{moduleKey}";
    }
}
