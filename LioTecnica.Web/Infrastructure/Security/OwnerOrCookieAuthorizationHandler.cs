using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;

namespace LioTecnica.Web.Infrastructure.Security;

/// <summary>
/// Allows Owner area when user has role Owner OR has OwnerAccessToken cookie (so Owner access survives SwitchTenant).
/// </summary>
public sealed class OwnerOrCookieAuthorizationHandler : AuthorizationHandler<OwnerOrCookieRequirement>
{
    private const string OwnerAccessTokenCookie = "OwnerAccessToken";

    private readonly IHttpContextAccessor _httpContextAccessor;

    public OwnerOrCookieAuthorizationHandler(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, OwnerOrCookieRequirement requirement)
    {
        if (context.User.IsInRole("Owner"))
        {
            context.Succeed(requirement);
            return Task.CompletedTask;
        }

        var cookie = _httpContextAccessor.HttpContext?.Request.Cookies[OwnerAccessTokenCookie];
        if (!string.IsNullOrWhiteSpace(cookie))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
