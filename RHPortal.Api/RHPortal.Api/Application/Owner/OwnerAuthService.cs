using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using RhPortal.Api.Contracts.Owner;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Application.Owner;

public sealed class OwnerAuthService
{
    private readonly MasterDbContext _masterDb;
    private readonly JwtOptions _jwtOptions;
    private readonly PasswordHasher<RhPortal.Api.Domain.Entities.Owner> _passwordHasher = new();

    public OwnerAuthService(MasterDbContext masterDb, IOptions<JwtOptions> jwtOptions)
    {
        _masterDb = masterDb;
        _jwtOptions = jwtOptions.Value;
    }

    public async Task<OwnerLoginResponse?> LoginAsync(OwnerLoginRequest request, CancellationToken ct)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var owner = await _masterDb.Owners
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Email.ToLower() == email && x.IsActive, ct);
        if (owner is null)
            return null;

        var result = _passwordHasher.VerifyHashedPassword(owner, owner.PasswordHash, request.Password);
        if (result == PasswordVerificationResult.Failed)
            return null;

        var token = CreateJwtToken(owner);
        return new OwnerLoginResponse(
            AccessToken: token,
            AccessTokenExpirationMinutes: _jwtOptions.AccessTokenExpirationMinutes,
            OwnerId: owner.Id,
            Email: owner.Email,
            TenantId: "owner",
            Roles: new[] { "Owner" }
        );
    }

    private string CreateJwtToken(Domain.Entities.Owner owner)
    {
        return CreateJwtTokenWithTenant(owner, "owner");
    }

    /// <summary>
    /// Creates a JWT for the owner with the given tenant (for "switch tenant" / act-as).
    /// </summary>
    public string CreateJwtTokenWithTenant(Guid ownerId, string tenantId)
    {
        var owner = _masterDb.Owners.AsNoTracking().FirstOrDefault(x => x.Id == ownerId && x.IsActive);
        if (owner is null)
            throw new InvalidOperationException("Owner not found or inactive.");
        return CreateJwtTokenWithTenant(owner, tenantId);
    }

    private string CreateJwtTokenWithTenant(Domain.Entities.Owner owner, string tenantId)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, owner.Id.ToString()),
            new(ClaimTypes.Email, owner.Email),
            new("tenant", tenantId),
            new(ClaimTypes.Role, "Owner")
        };

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

    public static string HashPassword(string password)
    {
        var hasher = new PasswordHasher<Domain.Entities.Owner>();
        return hasher.HashPassword(null!, password);
    }
}
