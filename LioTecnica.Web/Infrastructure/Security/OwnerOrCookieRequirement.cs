using Microsoft.AspNetCore.Authorization;

namespace LioTecnica.Web.Infrastructure.Security;

/// <summary>
/// Requirement for Owner area: allow when user has role Owner OR has OwnerAccessToken cookie (Owner logged in, then switched tenant).
/// </summary>
public sealed class OwnerOrCookieRequirement : IAuthorizationRequirement
{
}
