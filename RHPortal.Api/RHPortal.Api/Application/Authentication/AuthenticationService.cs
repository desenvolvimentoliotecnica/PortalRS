using System.Collections.Generic;
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

    /// <summary>Inclui CentroCusto e Unit para derivar EmpresaId no perfil/me.</summary>
    private IQueryable<ApplicationUser> UsersWithFuncionarioEstrutura() =>
        _db.Users
            .Include(u => u.Funcionario!)
                .ThenInclude(f => f.CentroCusto)
            .Include(u => u.Funcionario!)
                .ThenInclude(f => f.Unit);

    /// <summary>
    /// Empresa: CentroCusto.EmpresaId → Unit.EmpresaId → <see cref="Empresa.Code"/> alinhado a
    /// <see cref="Funcionario.CdnEmpresa"/> (TOTVS). Lotação: vínculo direto ou moda entre funcionários
    /// ativos do mesmo centro de custo (somente com maioria estrita).
    /// </summary>
    private async Task<(Guid? EmpresaId, Guid? UnitId, Guid? CentroCustoId, Guid? UnidadeLotacaoId)> ResolveEstruturaAsync(
        Funcionario? f,
        CancellationToken ct)
    {
        if (f is null) return (null, null, null, null);

        var empresaId = f.CentroCusto?.EmpresaId ?? f.Unit?.EmpresaId;
        if (!empresaId.HasValue)
            empresaId = await ResolveEmpresaIdFromFuncionarioCdnAsync(f.TenantId, f.CdnEmpresa, ct);

        Guid? unidadeLotacaoId = f.UnidadeLotacaoId;
        if (!unidadeLotacaoId.HasValue && f.CentroCustoId.HasValue)
            unidadeLotacaoId = await InferUnidadeLotacaoPorCentroCustoAsync(f.TenantId, f.CentroCustoId.Value, ct);

        return (empresaId, f.UnitId, f.CentroCustoId, unidadeLotacaoId);
    }

    private async Task<Guid?> ResolveEmpresaIdFromFuncionarioCdnAsync(string tenantId, string? cdnEmpresa, CancellationToken ct)
    {
        var raw = cdnEmpresa?.Trim();
        if (string.IsNullOrEmpty(raw)) return null;

        foreach (var code in EmpresaCodeLookupVariants(raw))
        {
            var id = await _db.Empresas.AsNoTracking()
                .Where(e => e.TenantId == tenantId && e.IsActive && e.Code == code)
                .Select(e => (Guid?)e.Id)
                .FirstOrDefaultAsync(ct);
            if (id.HasValue) return id;
        }

        return null;
    }

    private static IEnumerable<string> EmpresaCodeLookupVariants(string cdn)
    {
        var t = cdn.Trim();
        yield return t;
        if (t.Length < 3)
            yield return t.PadLeft(3, '0');
        var trimmedZeros = t.TrimStart('0');
        if (trimmedZeros.Length > 0 && trimmedZeros != t)
            yield return trimmedZeros;
    }

    private async Task<Guid?> InferUnidadeLotacaoPorCentroCustoAsync(string tenantId, Guid centroCustoId, CancellationToken ct)
    {
        var top = await _db.Funcionarios.AsNoTracking()
            .Where(x => x.TenantId == tenantId
                        && x.CentroCustoId == centroCustoId
                        && x.UnidadeLotacaoId != null
                        && x.Status == RhPortal.Api.Domain.Enums.FuncionarioStatus.Active)
            .GroupBy(x => x.UnidadeLotacaoId!.Value)
            .Select(g => new { Id = g.Key, Cnt = g.Count() })
            .OrderByDescending(x => x.Cnt)
            .Take(2)
            .ToListAsync(ct);

        if (top.Count == 0) return null;
        if (top.Count == 1) return top[0].Id;
        return top[0].Cnt > top[1].Cnt ? top[0].Id : null;
    }

    public async Task<LoginResponse?> LoginAsync(LoginRequest request, CancellationToken ct)
    {
        var email = request.Email.Trim();
        if (string.IsNullOrWhiteSpace(email)) return null;

        var user = await UsersWithFuncionarioEstrutura()
            .FirstOrDefaultAsync(x => x.Email == email, ct);
        if (user is null || !user.IsActive) return null;

        var validPassword = await _userManager.CheckPasswordAsync(user, request.Password);
        if (!validPassword) return null;

        var roleNames = await _userManager.GetRolesAsync(user);
        var roleEntities = await _roleManager.Roles.Where(r => r.Name != null && roleNames.Contains(r.Name)).ToListAsync(ct);
        var permissions = RolePermissionManifest.GetPermissions(roleEntities).ToList();

        var (visibilityScope, vagasDataScope, accessMode) = RolePermissionManifest.GetEffectiveScopes(roleEntities);
        var token = CreateJwtToken(user, roleNames, permissions, visibilityScope, vagasDataScope, accessMode);
        var (empresaId, unitId, centroCustoId, unidadeLotacaoId) = await ResolveEstruturaAsync(user.Funcionario, ct);
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
            CentroCustoId: centroCustoId,
            EmpresaId: empresaId,
            UnitId: unitId,
            UnidadeLotacaoId: unidadeLotacaoId,
            VisibilityScope: visibilityScope,
            VagasDataScope: vagasDataScope,
            IsReadOnly: accessMode == ProfileAccessMode.ReadOnly
        );
    }

    public async Task<CurrentUserResponse?> GetCurrentUserAsync(Guid userId, CancellationToken ct)
    {
        var user = await UsersWithFuncionarioEstrutura()
            .FirstOrDefaultAsync(x => x.Id == userId, ct);
        if (user is null) return null;

        var roleNames = await _userManager.GetRolesAsync(user);
        var roleEntities = await _roleManager.Roles.Where(r => r.Name != null && roleNames.Contains(r.Name)).ToListAsync(ct);
        var permissions = RolePermissionManifest.GetPermissions(roleEntities).ToList();
        var (visibilityScope, vagasDataScope, accessMode) = RolePermissionManifest.GetEffectiveScopes(roleEntities);
        var (empresaId, unitId, centroCustoId, unidadeLotacaoId) = await ResolveEstruturaAsync(user.Funcionario, ct);

        return new CurrentUserResponse(
            UserId: user.Id,
            Email: user.Email ?? string.Empty,
            FullName: user.FullName,
            TenantId: _tenantContext.TenantId,
            Roles: roleNames.ToList(),
            Permissions: permissions,
            FuncionarioId: user.FuncionarioId,
            CentroCustoId: centroCustoId,
            EmpresaId: empresaId,
            UnitId: unitId,
            UnidadeLotacaoId: unidadeLotacaoId,
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

        var userWithFuncionario = await UsersWithFuncionarioEstrutura()
            .FirstOrDefaultAsync(x => x.Id == user.Id, ct);
        if (userWithFuncionario is null)
            return null;

        var roleNames = await _userManager.GetRolesAsync(userWithFuncionario);
        var roleEntities = await _roleManager.Roles.Where(r => r.Name != null && roleNames.Contains(r.Name)).ToListAsync(ct);
        var permissions = RolePermissionManifest.GetPermissions(roleEntities).ToList();
        var (visibilityScope, vagasDataScope, accessMode) = RolePermissionManifest.GetEffectiveScopes(roleEntities);
        var token = CreateJwtToken(userWithFuncionario, roleNames, permissions, visibilityScope, vagasDataScope, accessMode);
        var (empresaId, unitId, centroCustoId, unidadeLotacaoId) = await ResolveEstruturaAsync(userWithFuncionario.Funcionario, ct);
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
            CentroCustoId: centroCustoId,
            EmpresaId: empresaId,
            UnitId: unitId,
            UnidadeLotacaoId: unidadeLotacaoId,
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
        // 31.2: CentroCusto absorveu Area. A claim passa a se chamar centro_custo_id.
        if (user.Funcionario?.CentroCustoId is { } centroCustoId)
            claims.Add(new Claim("centro_custo_id", centroCustoId.ToString()));

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
