using Microsoft.AspNetCore.Authorization;

namespace LioTecnica.Web.Infrastructure.Security;

public sealed class RequirePermissionAttribute : AuthorizeAttribute
{
    public RequirePermissionAttribute(string permission)
    {
        Policy = $"{PermissionConstants.PolicyPrefix}{permission}";
    }
}
