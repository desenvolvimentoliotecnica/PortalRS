using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Common;
using RhPortal.Api.Contracts.Portal;
using RHPortal.Api.Domain.Entities;
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
    public async Task<ActionResult<PagedResult<PortalVagaCardResponse>>> List(
        [FromQuery] string? q,
        [FromQuery] string? location,
        [FromQuery] string? mode,
        [FromQuery] string? type,
        [FromQuery] string? level,
        [FromQuery] string? area,
        [FromQuery] decimal? minSalary,
        [FromQuery] string? sort,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 12,
        CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var tenantId = _tenantContext.TenantId;

        var tenantName = await _db.Tenants
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId)
            .Select(t => t.Name)
            .FirstOrDefaultAsync(ct);

        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > 100 ? 12 : pageSize;

        IQueryable<Vaga> query = _db.Vagas
            .AsNoTracking()
            .Include(v => v.Area)
            .Where(v => v.Status == VagaStatus.Aberta)
            .Where(v => !v.Confidencial)
            .Where(v => v.Visibilidade == VagaPublicacaoVisibilidade.Externa
                || v.Visibilidade == VagaPublicacaoVisibilidade.InternaEExterna)
            .Where(v => !v.DataInicio.HasValue || v.DataInicio.Value <= today)
            .Where(v => !v.DataEncerramento.HasValue || v.DataEncerramento.Value >= today);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var like = $"%{q.Trim()}%";
            query = query.Where(v =>
                (v.Codigo != null && EF.Functions.Like(v.Codigo, like)) ||
                EF.Functions.Like(v.Titulo, like) ||
                (v.Cidade != null && EF.Functions.Like(v.Cidade, like)) ||
                (v.Uf != null && EF.Functions.Like(v.Uf, like)) ||
                (v.TagsKeywordsRaw != null && EF.Functions.Like(v.TagsKeywordsRaw, like)) ||
                (v.TagsStackRaw != null && EF.Functions.Like(v.TagsStackRaw, like)) ||
                (v.TagsResponsabilidadesRaw != null && EF.Functions.Like(v.TagsResponsabilidadesRaw, like)) ||
                (v.Area != null && v.Area.Name != null && EF.Functions.Like(v.Area.Name, like)));
        }

        if (!string.IsNullOrWhiteSpace(area))
        {
            var areaLike = $"%{area.Trim()}%";
            query = query.Where(v => v.Area != null && v.Area.Name != null && EF.Functions.Like(v.Area.Name, areaLike));
        }

        if (!string.IsNullOrWhiteSpace(location))
        {
            var locationValue = location.Trim();
            if (locationValue.Contains("Remoto", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(v => v.Modalidade == VagaModalidade.Remoto);
            }
            else
            {
                var parts = locationValue.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                if (parts.Length > 0)
                {
                    var cityLike = $"%{parts[0]}%";
                    query = query.Where(v => v.Cidade != null && EF.Functions.Like(v.Cidade, cityLike));
                }
                if (parts.Length > 1)
                {
                    var uf = parts[1].Trim();
                    query = query.Where(v => v.Uf != null && EF.Functions.Like(v.Uf, uf));
                }
            }
        }

        if (TryParseEnum(mode, out VagaModalidade modalidade))
            query = query.Where(v => v.Modalidade == modalidade);

        if (TryParseEnum(type, out VagaTipoContratacao tipo))
            query = query.Where(v => v.TipoContratacao == tipo);

        if (TryParseEnum(level, out VagaSenioridade senioridade))
            query = query.Where(v => v.Senioridade == senioridade);

        if (minSalary.HasValue)
        {
            query = query.Where(v => v.SalarioMaximo.HasValue && v.SalarioMaximo.Value >= minSalary.Value);
        }

        query = sort switch
        {
            "salaryDesc" => query.OrderByDescending(v => v.SalarioMaximo ?? 0),
            "companyAsc" => query.OrderBy(v => v.Titulo),
            _ => query.OrderByDescending(v => v.CreatedAtUtc)
        };

        var totalItems = await query.CountAsync(ct);
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
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

        return Ok(new PagedResult<PortalVagaCardResponse>(items, page, pageSize, totalItems, totalPages));
    }

    private static bool TryParseEnum<TEnum>(string? value, out TEnum parsed) where TEnum : struct
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            parsed = default;
            return false;
        }

        return Enum.TryParse(value.Replace(" ", string.Empty), true, out parsed);
    }
}
