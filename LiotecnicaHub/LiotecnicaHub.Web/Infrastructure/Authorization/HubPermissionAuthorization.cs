using System;
using System.Threading;
using System.Threading.Tasks;
using LiotecnicaHub.Web.Application.Access;
using LiotecnicaHub.Web.Application.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace LiotecnicaHub.Web.Infrastructure.Authorization;

public sealed class HubPermissionRequirement(string permissionCode) : IAuthorizationRequirement
{
    public string PermissionCode { get; } = permissionCode;
}

public sealed class HubPermissionAuthorizationHandler : AuthorizationHandler<HubPermissionRequirement>
{
    private readonly IHubAccessService _access;

    public HubPermissionAuthorizationHandler(IHubAccessService access) => _access = access;

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        HubPermissionRequirement requirement)
    {
        var email = context.User.FindFirst(HubClaimTypes.Email)?.Value;
        if (string.IsNullOrWhiteSpace(email))
            return;

        if (await _access.PossuiPermissaoHubAsync(email, requirement.PermissionCode, CancellationToken.None))
            context.Succeed(requirement);
    }
}

public sealed class HubPermissionPolicyProvider : IAuthorizationPolicyProvider
{
    public const string PolicyPrefix = "HubPermission:";
    private readonly DefaultAuthorizationPolicyProvider _fallback;

    public HubPermissionPolicyProvider(IOptions<AuthorizationOptions> options) =>
        _fallback = new DefaultAuthorizationPolicyProvider(options);

    public Task<AuthorizationPolicy> GetDefaultPolicyAsync() =>
        _fallback.GetDefaultPolicyAsync();

    public Task<AuthorizationPolicy?> GetFallbackPolicyAsync() =>
        _fallback.GetFallbackPolicyAsync();

    public Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        if (!policyName.StartsWith(PolicyPrefix, StringComparison.Ordinal))
            return _fallback.GetPolicyAsync(policyName);

        var permissionCode = policyName[PolicyPrefix.Length..];
        var policy = new AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
            .AddRequirements(new HubPermissionRequirement(permissionCode))
            .Build();

        return Task.FromResult<AuthorizationPolicy?>(policy);
    }
}

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public sealed class AuthorizeHubPermissionAttribute : AuthorizeAttribute
{
    public AuthorizeHubPermissionAttribute(string permissionCode) =>
        Policy = $"{HubPermissionPolicyProvider.PolicyPrefix}{permissionCode}";
}
