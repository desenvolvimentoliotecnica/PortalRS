using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.TenantBranding;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Endpoint público anônimo consumido pela tela de login, ANTES de o usuário autenticar.
/// Recebe `?tenant=<slug>`, valida contra o MasterDb e, se existir e estiver ativo,
/// retorna o branding configurado (ou DTO vazio = defaults da plataforma).
///
/// Este controller está na whitelist do TenantMiddleware (não exige `X-Tenant-Id`),
/// então ele mesmo resolve o tenant manualmente e abre um scope para ler o AppDbContext
/// do tenant correto — padrão espelhado do OwnerController.
///
/// Regra de UX: slug vazio, inválido ou inexistente NUNCA retorna erro — resolve como
/// "todos os campos null" → o frontend aplica os defaults. Isso evita que a tela de
/// login quebre por causa de um link marketing errado.
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/public/branding")]
public sealed class PublicBrandingController : ControllerBase
{
    // Mesmo padrão do TenantMiddleware — mantém a whitelist em sincronia.
    private static readonly Regex TenantPattern = new("^[a-z0-9][a-z0-9\\-]{1,62}$", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private readonly MasterDbContext _masterDb;
    private readonly IServiceProvider _scope;

    public PublicBrandingController(MasterDbContext masterDb, IServiceProvider scope)
    {
        _masterDb = masterDb;
        _scope = scope;
    }

    /// <summary>
    /// Retorna o branding do tenant indicado pelo query `?tenant=<slug>`.
    /// Sempre responde 200 com um TenantBrandingPublicDto (campos null = default).
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(TenantBrandingPublicDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get([FromQuery(Name = "tenant")] string? tenantSlug, CancellationToken ct)
    {
        // UX: qualquer input inválido → defaults (não vaza existência de tenant nem quebra a tela).
        var empty = new TenantBrandingPublicDto();
        if (string.IsNullOrWhiteSpace(tenantSlug)) return Ok(empty);

        var slug = tenantSlug.Trim().ToLowerInvariant();
        if (!TenantPattern.IsMatch(slug)) return Ok(empty);

        var exists = await _masterDb.Tenants
            .AsNoTracking()
            .AnyAsync(t => t.TenantId == slug && t.IsActive, ct);
        if (!exists) return Ok(empty);

        // Resolve o branding no banco do tenant — scope manual com TenantId setado,
        // igual ao OwnerController faz em endpoints cross-tenant.
        using var scope = _scope.CreateScope();
        var tenantContext = scope.ServiceProvider.GetRequiredService<ITenantContext>();
        tenantContext.SetTenantId(slug);

        var service = scope.ServiceProvider.GetRequiredService<ITenantBrandingService>();
        var dto = await service.GetPublicAsync(ct);
        return Ok(dto);
    }
}
