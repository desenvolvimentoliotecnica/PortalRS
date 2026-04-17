using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using RhPortal.Api.Contracts.Authentication;
using RhPortal.Api.Application.Feedback;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Tenancy;
using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Application.Authentication;

public sealed class AuthenticationService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<ApplicationRole> _roleManager;
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly JwtOptions _jwtOptions;
    private readonly IEntraTokenValidator _entraTokenValidator;
    private readonly AwardPointsService _awardPointsService;
    private const string EntraDefaultRole = "Operacional";

    public AuthenticationService(
        UserManager<ApplicationUser> userManager,
        RoleManager<ApplicationRole> roleManager,
        AppDbContext db,
        ITenantContext tenantContext,
        IOptions<JwtOptions> jwtOptions,
        IEntraTokenValidator entraTokenValidator,
        AwardPointsService awardPointsService)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _db = db;
        _tenantContext = tenantContext;
        _jwtOptions = jwtOptions.Value;
        _entraTokenValidator = entraTokenValidator;
        _awardPointsService = awardPointsService;
    }

    public async Task<LoginResponse?> LoginAsync(LoginRequest request, CancellationToken ct)
    {
        var email = request.Email.Trim();
        if (string.IsNullOrWhiteSpace(email)) return null;

        var user = await _db.Users
            .Include(u => u.Funcionario)
            .FirstOrDefaultAsync(x => x.Email == email, ct);
        if (user is null || !user.IsActive) return null;

        var validPassword = await _userManager.CheckPasswordAsync(user, request.Password);
        if (!validPassword) return null;

        var roleNames = await _userManager.GetRolesAsync(user);
        var roleEntities = await _roleManager.Roles.Where(r => r.Name != null && roleNames.Contains(r.Name)).ToListAsync(ct);
        var permissions = RolePermissionManifest.GetPermissions(roleEntities).ToList();

        // DEBUG
        System.Diagnostics.Debug.WriteLine($"[LOGIN] User: {user.Email} | Roles: [{string.Join(", ", roleNames)}] | Permissions: {permissions.Count}");

        var (visibilityScope, vagasDataScope, accessMode) = RolePermissionManifest.GetEffectiveScopes(roleEntities);
        var token = CreateJwtToken(user, roleNames, permissions, visibilityScope, vagasDataScope, accessMode);
        var areaId = user.Funcionario?.AreaId;
        await _awardPointsService.AwardAsync(
            user.Id,
            GamificationEventTypes.DailyLogin,
            sourceId: null,
            reason: "Login diário",
            ct);

        return new LoginResponse(
            AccessToken: token,
            AccessTokenExpirationMinutes: _jwtOptions.AccessTokenExpirationMinutes,
            UserId: user.Id,
            Email: user.Email ?? string.Empty,
            FullName: user.FullName,
            TenantId: _tenantContext.TenantId,
            Roles: roleNames.ToList(),
            Permissions: permissions,
            FuncionarioId: user.FuncionarioId,
            AreaId: areaId,
            VisibilityScope: visibilityScope,
            VagasDataScope: vagasDataScope,
            IsReadOnly: accessMode == ProfileAccessMode.ReadOnly
        );
    }

    public async Task<CurrentUserResponse?> GetCurrentUserAsync(Guid userId, CancellationToken ct)
    {
        var user = await _db.Users
            .Include(u => u.Funcionario)
            .FirstOrDefaultAsync(x => x.Id == userId, ct);
        if (user is null) return null;

        var roleNames = await _userManager.GetRolesAsync(user);
        var roleEntities = await _roleManager.Roles.Where(r => r.Name != null && roleNames.Contains(r.Name)).ToListAsync(ct);
        var permissions = RolePermissionManifest.GetPermissions(roleEntities).ToList();
        var (visibilityScope, vagasDataScope, accessMode) = RolePermissionManifest.GetEffectiveScopes(roleEntities);
        var areaId = user.Funcionario?.AreaId;

        return new CurrentUserResponse(
            UserId: user.Id,
            Email: user.Email ?? string.Empty,
            FullName: user.FullName,
            TenantId: _tenantContext.TenantId,
            Roles: roleNames.ToList(),
            Permissions: permissions,
            FuncionarioId: user.FuncionarioId,
            AreaId: areaId,
            VisibilityScope: visibilityScope,
            VagasDataScope: vagasDataScope,
            IsReadOnly: accessMode == ProfileAccessMode.ReadOnly
        );
    }

    /// <summary>
    /// Creates a new JWT for the current user with the given tenant (for switch-tenant).
    /// User must exist in the current tenant DB; only the tenant claim is changed.
    /// </summary>
    public async Task<string?> CreateTokenWithTenantAsync(Guid userId, string tenantId, CancellationToken ct)
    {
        var user = await _db.Users.Include(u => u.Funcionario).FirstOrDefaultAsync(x => x.Id == userId, ct);
        if (user is null || !user.IsActive) return null;

        var roleNames = await _userManager.GetRolesAsync(user);
        var roleEntities = await _roleManager.Roles.Where(r => r.Name != null && roleNames.Contains(r.Name)).ToListAsync(ct);
        var permissions = RolePermissionManifest.GetPermissions(roleEntities).ToList();
        var (visibilityScope, vagasDataScope, accessMode) = RolePermissionManifest.GetEffectiveScopes(roleEntities);
        return CreateJwtToken(user, roleNames, permissions, tenantId, visibilityScope, vagasDataScope, accessMode);
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

        var userWithFuncionario = await _db.Users
            .Include(u => u.Funcionario)
            .FirstOrDefaultAsync(x => x.Id == user.Id, ct);
        if (userWithFuncionario is null)
            return null;

        var roleNames = await _userManager.GetRolesAsync(userWithFuncionario);
        var roleEntities = await _roleManager.Roles.Where(r => r.Name != null && roleNames.Contains(r.Name)).ToListAsync(ct);
        var permissions = RolePermissionManifest.GetPermissions(roleEntities).ToList();
        var (visibilityScope, vagasDataScope, accessMode) = RolePermissionManifest.GetEffectiveScopes(roleEntities);
        var token = CreateJwtToken(userWithFuncionario, roleNames, permissions, visibilityScope, vagasDataScope, accessMode);
        var areaId = userWithFuncionario.Funcionario?.AreaId;
        await _awardPointsService.AwardAsync(
            user.Id,
            GamificationEventTypes.DailyLogin,
            sourceId: null,
            reason: "Login diário",
            ct);

        return new LoginResponse(
            AccessToken: token,
            AccessTokenExpirationMinutes: _jwtOptions.AccessTokenExpirationMinutes,
            UserId: user.Id,
            Email: user.Email ?? string.Empty,
            FullName: user.FullName,
            TenantId: _tenantContext.TenantId,
            Roles: roleNames.ToList(),
            Permissions: permissions,
            FuncionarioId: userWithFuncionario.FuncionarioId,
            AreaId: areaId,
            VisibilityScope: visibilityScope,
            VagasDataScope: vagasDataScope,
            IsReadOnly: accessMode == ProfileAccessMode.ReadOnly
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

        // RoleMenus seeding removed — permissions come from RolePermissionManifest, not the DB.

        var isInRole = await _userManager.IsInRoleAsync(user, roleName);
        if (!isInRole)
        {
            var addResult = await _userManager.AddToRoleAsync(user, roleName);
            if (!addResult.Succeeded)
                return false;
        }

        return true;
    }

    // EnsureOperationalRoleMenusAsync removed — permissions are code-first via RolePermissionManifest.

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

    // GetEffectiveProfileScopeAsync removed — scope is now code-first via RolePermissionManifest.GetEffectiveScopes().

    private string CreateJwtToken(
        ApplicationUser user,
        IEnumerable<string> roleNames,
        IEnumerable<string> permissions,
        ProfileVisibilityScope visibilityScope,
        VagasDataScope vagasDataScope,
        ProfileAccessMode accessMode)
    {
        return CreateJwtToken(user, roleNames, permissions, _tenantContext.TenantId, visibilityScope, vagasDataScope, accessMode);
    }

    private string CreateJwtToken(
        ApplicationUser user,
        IEnumerable<string> roleNames,
        IEnumerable<string> permissions,
        string tenantId,
        ProfileVisibilityScope visibilityScope,
        VagasDataScope vagasDataScope,
        ProfileAccessMode accessMode)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email ?? string.Empty),
            new(ClaimTypes.Name, user.FullName),
            new("tenant", tenantId),
            new(PermissionConstants.ClaimVisibilityScope, ((short)visibilityScope).ToString()),
            new(PermissionConstants.ClaimVagasDataScope, ((short)vagasDataScope).ToString()),
            new(PermissionConstants.ClaimAccessMode, ((short)accessMode).ToString())
        };

        if (user.FuncionarioId.HasValue)
            claims.Add(new Claim("funcionario_id", user.FuncionarioId.Value.ToString()));
        if (user.Funcionario?.AreaId is { } areaId)
            claims.Add(new Claim("area_id", areaId.ToString()));

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
