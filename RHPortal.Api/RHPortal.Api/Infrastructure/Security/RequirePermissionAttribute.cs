using Microsoft.AspNetCore.Authorization;

namespace RhPortal.Api.Infrastructure.Security;

public sealed class RequirePermissionAttribute : AuthorizeAttribute
{
    public RequirePermissionAttribute(string permission)
    {
        Policy = $"{PermissionConstants.PolicyPrefix}{permission}";
    }
}
