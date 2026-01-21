using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Portal;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/public/vagas")]
public sealed class PublicVagasController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;

    public PublicVagasController(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PortalVagaCardResponse>>> List(CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var tenantId = _tenantContext.TenantId;

        var tenantName = await _db.Tenants
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId)
            .Select(t => t.Name)
            .FirstOrDefaultAsync(ct);

        var items = await _db.Vagas
            .AsNoTracking()
            .Include(v => v.Area)
            .Where(v => v.Status == VagaStatus.Aberta)
            .Where(v => !v.Confidencial)
            .Where(v => v.Visibilidade == VagaPublicacaoVisibilidade.Externa
                || v.Visibilidade == VagaPublicacaoVisibilidade.InternaEExterna)
            .Where(v => !v.DataInicio.HasValue || v.DataInicio.Value <= today)
            .Where(v => !v.DataEncerramento.HasValue || v.DataEncerramento.Value >= today)
            .OrderByDescending(v => v.CreatedAtUtc)
            .Select(v => new PortalVagaCardResponse(
                v.Id,
                v.Titulo,
                v.Area != null ? v.Area.Name : null,
                v.Modalidade,
                v.TipoContratacao,
                v.Senioridade,
                v.Cidade,
                v.Uf,
                v.TagsKeywordsRaw,
                v.TagsStackRaw,
                v.TagsResponsabilidadesRaw,
                v.SalarioMinimo,
                v.SalarioMaximo,
                v.CreatedAtUtc,
                tenantName))
            .ToListAsync(ct);

        return Ok(items);
    }
}
