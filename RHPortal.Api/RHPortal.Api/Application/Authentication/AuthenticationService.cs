using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using RhPortal.Api.Contracts.Authentication;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Authentication;

public sealed class AuthenticationService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<ApplicationRole> _roleManager;
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly JwtOptions _jwtOptions;
    private readonly IEntraTokenValidator _entraTokenValidator;
    private const string EntraDefaultRole = "Operacional";

    public AuthenticationService(
        UserManager<ApplicationUser> userManager,
        RoleManager<ApplicationRole> roleManager,
        AppDbContext db,
        ITenantContext tenantContext,
        IOptions<JwtOptions> jwtOptions,
        IEntraTokenValidator entraTokenValidator)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _db = db;
        _tenantContext = tenantContext;
        _jwtOptions = jwtOptions.Value;
        _entraTokenValidator = entraTokenValidator;
    }

    public async Task<LoginResponse?> LoginAsync(LoginRequest request, CancellationToken ct)
    {
        var email = request.Email.Trim();
        if (string.IsNullOrWhiteSpace(email)) return null;

        var user = await _userManager.Users.FirstOrDefaultAsync(x => x.Email == email, ct);
        if (user is null || !user.IsActive) return null;

        var validPassword = await _userManager.CheckPasswordAsync(user, request.Password);
        if (!validPassword) return null;

        var roleNames = await _userManager.GetRolesAsync(user);
        var roleIds = await _db.UserRoles
            .Where(x => x.UserId == user.Id)
            .Select(x => x.RoleId)
            .ToListAsync(ct);

        var permissions = await _db.RoleMenus
            .Where(x => roleIds.Contains(x.RoleId))
            .Select(x => x.PermissionKey)
            .Distinct()
            .ToListAsync(ct);

        var token = CreateJwtToken(user, roleNames, permissions);

        return new LoginResponse(
            AccessToken: token,
            AccessTokenExpirationMinutes: _jwtOptions.AccessTokenExpirationMinutes,
            UserId: user.Id,
            Email: user.Email ?? string.Empty,
            FullName: user.FullName,
            TenantId: _tenantContext.TenantId,
            Roles: roleNames.ToList(),
            Permissions: permissions
        );
    }

    public async Task<CurrentUserResponse?> GetCurrentUserAsync(Guid userId, CancellationToken ct)
    {
        var user = await _userManager.Users.FirstOrDefaultAsync(x => x.Id == userId, ct);
        if (user is null) return null;

        var roleNames = await _userManager.GetRolesAsync(user);
        var roleIds = await _db.UserRoles
            .Where(x => x.UserId == user.Id)
            .Select(x => x.RoleId)
            .ToListAsync(ct);

        var permissions = await _db.RoleMenus
            .Where(x => roleIds.Contains(x.RoleId))
            .Select(x => x.PermissionKey)
            .Distinct()
            .ToListAsync(ct);

        return new CurrentUserResponse(
            UserId: user.Id,
            Email: user.Email ?? string.Empty,
            FullName: user.FullName,
            TenantId: _tenantContext.TenantId,
            Roles: roleNames.ToList(),
            Permissions: permissions
        );
    }

    public async Task<LoginResponse?> LoginWithEntraAsync(EntraLoginRequest request, CancellationToken ct)
    {
        var principal = await _entraTokenValidator.ValidateIdTokenAsync(request.IdToken, ct);
        if (principal is null)
            return null;

        var email = principal.FindFirstValue(ClaimTypes.Email)
                    ?? principal.FindFirstValue("preferred_username")
                    ?? principal.FindFirstValue("upn");

        if (string.IsNullOrWhiteSpace(email))
            return null;

        var user = await GetOrCreateEntraUserAsync(principal, email, ct);
        if (user is null)
            return null;

        var roleNames = await _userManager.GetRolesAsync(user);
        var roleIds = await _db.UserRoles
            .Where(x => x.UserId == user.Id)
            .Select(x => x.RoleId)
            .ToListAsync(ct);

        var permissions = await _db.RoleMenus
            .Where(x => roleIds.Contains(x.RoleId))
            .Select(x => x.PermissionKey)
            .Distinct()
            .ToListAsync(ct);

        var token = CreateJwtToken(user, roleNames, permissions);

        return new LoginResponse(
            AccessToken: token,
            AccessTokenExpirationMinutes: _jwtOptions.AccessTokenExpirationMinutes,
            UserId: user.Id,
            Email: user.Email ?? string.Empty,
            FullName: user.FullName,
            TenantId: _tenantContext.TenantId,
            Roles: roleNames.ToList(),
            Permissions: permissions
        );
    }

    private async Task<ApplicationUser?> GetOrCreateEntraUserAsync(
        ClaimsPrincipal principal,
        string email,
        CancellationToken ct)
    {
        var user = await _userManager.Users.FirstOrDefaultAsync(x => x.Email == email, ct);
        if (user is not null)
            return user.IsActive ? user : null;

        var fullName = ResolveFullName(principal, email);
        user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            Email = email,
            UserName = email,
            FullName = fullName,
            IsActive = true
        };

        var createResult = await _userManager.CreateAsync(user);
        if (!createResult.Succeeded)
            return null;

        var roleAssigned = await EnsureRoleAssignedAsync(user, EntraDefaultRole, ct);
        return roleAssigned ? user : null;
    }

    private async Task<bool> EnsureRoleAssignedAsync(ApplicationUser user, string roleName, CancellationToken ct)
    {
        var role = await _roleManager.Roles.FirstOrDefaultAsync(x => x.Name == roleName, ct);
        if (role is null)
        {
            var newRole = new ApplicationRole
            {
                Id = Guid.NewGuid(),
                Name = roleName,
                Description = "Acesso operacional",
                IsActive = true
            };

            var roleResult = await _roleManager.CreateAsync(newRole);
            if (!roleResult.Succeeded)
                return false;

            role = newRole;
        }

        if (string.Equals(roleName, EntraDefaultRole, StringComparison.OrdinalIgnoreCase))
            await EnsureOperationalRoleMenusAsync(role.Id, ct);

        var isInRole = await _userManager.IsInRoleAsync(user, roleName);
        if (!isInRole)
        {
            var addResult = await _userManager.AddToRoleAsync(user, roleName);
            if (!addResult.Succeeded)
                return false;
        }

        return true;
    }

    private async Task EnsureOperationalRoleMenusAsync(Guid roleId, CancellationToken ct)
    {
        var menus = await _db.Menus
            .AsNoTracking()
            .Where(x => x.IsActive
                        && !string.IsNullOrWhiteSpace(x.Route)
                        && !string.IsNullOrWhiteSpace(x.PermissionKey)
                        && !x.Route.ToLower().StartsWith("/admin"))
            .Select(x => new { x.Id, x.PermissionKey })
            .ToListAsync(ct);

        if (menus.Count == 0)
            return;

        var existing = await _db.RoleMenus
            .Where(x => x.RoleId == roleId)
            .Select(x => new { x.MenuId, x.PermissionKey })
            .ToListAsync(ct);

        var existingKeys = existing
            .Select(x => $"{x.MenuId}:{x.PermissionKey}")
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var toAdd = menus
            .Where(x => !existingKeys.Contains($"{x.Id}:{x.PermissionKey}"))
            .Select(x => new RoleMenu
            {
                Id = Guid.NewGuid(),
                RoleId = roleId,
                MenuId = x.Id,
                PermissionKey = x.PermissionKey
            })
            .ToList();

        if (toAdd.Count == 0)
            return;

        _db.RoleMenus.AddRange(toAdd);
        await _db.SaveChangesAsync(ct);
    }

    private static string ResolveFullName(ClaimsPrincipal principal, string fallbackEmail)
    {
        var name = principal.FindFirstValue(ClaimTypes.Name)
                   ?? principal.FindFirstValue("name");
        if (!string.IsNullOrWhiteSpace(name))
            return name.Trim();

        var given = principal.FindFirstValue(ClaimTypes.GivenName)
                    ?? principal.FindFirstValue("given_name");
        var family = principal.FindFirstValue(ClaimTypes.Surname)
                     ?? principal.FindFirstValue("family_name");

        if (!string.IsNullOrWhiteSpace(given) || !string.IsNullOrWhiteSpace(family))
            return $"{given} {family}".Trim();

        return fallbackEmail;
    }

    private string CreateJwtToken(ApplicationUser user, IEnumerable<string> roleNames, IEnumerable<string> permissions)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email ?? string.Empty),
            new(ClaimTypes.Name, user.FullName),
            new("tenant", _tenantContext.TenantId)
        };

        foreach (var role in roleNames)
            claims.Add(new Claim(ClaimTypes.Role, role));

        foreach (var permission in permissions.Distinct())
            claims.Add(new Claim(PermissionConstants.ClaimType, permission));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtOptions.SigningKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var expires = DateTime.UtcNow.AddMinutes(_jwtOptions.AccessTokenExpirationMinutes);

        var token = new JwtSecurityToken(
            issuer: _jwtOptions.Issuer,
            audience: _jwtOptions.Audience,
            claims: claims,
            expires: expires,
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
