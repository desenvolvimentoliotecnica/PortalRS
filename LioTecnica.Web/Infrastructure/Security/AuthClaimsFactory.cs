using System.Security.Claims;
using LioTecnica.Web.ViewModels.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;

namespace LioTecnica.Web.Infrastructure.Security;

public static class AuthClaimsFactory
{
    public static ClaimsPrincipal CreatePrincipal(LoginResponse response)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, response.UserId.ToString()),
            new(ClaimTypes.Email, response.Email),
            new(ClaimTypes.Name, response.FullName),
            new("tenant", response.TenantId),
            new("access_token", response.AccessToken)
        };

        foreach (var role in response.Roles ?? Array.Empty<string>())
            claims.Add(new Claim(ClaimTypes.Role, role));

        foreach (var permission in response.Permissions ?? Array.Empty<string>())
            claims.Add(new Claim("permission", permission));

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        return new ClaimsPrincipal(identity);
    }
}
