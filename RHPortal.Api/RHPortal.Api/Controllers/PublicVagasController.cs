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

/// <summary>
/// Catálogo público de vagas exibidas no Portal de Vagas (sem autenticação).
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/public/vagas")]
public sealed class PublicVagasController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly MasterDbContext _masterDb;
    private readonly ITenantContext _tenantContext;

    public PublicVagasController(AppDbContext db, MasterDbContext masterDb, ITenantContext tenantContext)
    {
        _db = db;
        _masterDb = masterDb;
        _tenantContext = tenantContext;
    }

    /// <summary>
    /// Lista vagas públicas com filtros simples (busca, localização, modalidade, tipo e senioridade).
    /// </summary>
    /// <param name="q">Texto livre para busca (título, código, cidade, UF, tags e área).</param>
    /// <param name="location">Cidade/UF (ex.: "São Paulo, SP") ou "Remoto".</param>
    /// <param name="mode">Modalidade (ex.: Presencial, Hibrido, Remoto).</param>
    /// <param name="type">Tipo de contratação (ex.: CLT, PJ).</param>
    /// <param name="level">Senioridade (ex.: Junior, Pleno, Senior).</param>
    /// <param name="area">Área da vaga.</param>
    /// <param name="minSalary">Filtra por salário máximo maior/igual a este valor.</param>
    /// <param name="sort">Ordenação: salaryDesc, companyAsc ou recent (padrão).</param>
    /// <param name="page">Página (1‑based).</param>
    /// <param name="pageSize">Quantidade por página (1 a 100). Valores fora disso voltam para 12.</param>
    /// <param name="ct">Token de cancelamento.</param>
    /// <returns>Lista paginada com os cards de vaga.</returns>
    [ProducesResponseType(typeof(PagedResult<PortalVagaCardResponse>), StatusCodes.Status200OK)]
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

        var tenantName = await _masterDb.Tenants
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId)
            .Select(t => t.Name)
            .FirstOrDefaultAsync(ct);

        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > 100 ? 12 : pageSize;

        IQueryable<Vaga> query = _db.Vagas
            .AsNoTracking()
            .Include(v => v.CentroCusto)
            .Include(v => v.Etapas)
            .Where(v => v.Status == VagaStatus.Aberta)
            .Where(v => v.HeadcountPendente <= 0)
            .Where(v => !v.Confidencial)
            .Where(v => !v.Visibilidade.HasValue
                || v.Visibilidade == VagaPublicacaoVisibilidade.NaoInformado
                || v.Visibilidade == VagaPublicacaoVisibilidade.Externa
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
                (v.CentroCusto != null && v.CentroCusto.Description != null && EF.Functions.Like(v.CentroCusto.Description, like)));
        }

        if (!string.IsNullOrWhiteSpace(area))
        {
            var areaLike = $"%{area.Trim()}%";
            query = query.Where(v => v.CentroCusto != null && v.CentroCusto.Description != null && EF.Functions.Like(v.CentroCusto.Description, areaLike));
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
                v.CentroCusto != null ? v.CentroCusto.Description : null,
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
                tenantName,
                v.DescricaoPublica,
                v.Urgente,
                v.AceitaPcd,
                v.QuantidadeVagas,
                v.Etapas.OrderBy(e => e.Ordem).Select(e => e.Nome).ToList()))
            .ToListAsync(ct);

        return Ok(new PagedResult<PortalVagaCardResponse>(items, page, pageSize, totalItems, totalPages));
    }

    /// <summary>
    /// Consulta uma vaga pública específica pelo ID.
    /// </summary>
    [ProducesResponseType(typeof(PortalVagaCardResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<PortalVagaCardResponse>> GetById(
        [FromRoute] Guid id,
        CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var tenantId = _tenantContext.TenantId;

        var tenantName = await _masterDb.Tenants
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId)
            .Select(t => t.Name)
            .FirstOrDefaultAsync(ct);

        var item = await _db.Vagas
            .AsNoTracking()
            .Include(v => v.CentroCusto)
            .Include(v => v.Etapas)
            .Where(v => v.Id == id)
            .Where(v => v.Status == VagaStatus.Aberta)
            .Where(v => v.HeadcountPendente <= 0)
            .Where(v => !v.Confidencial)
            .Where(v => !v.Visibilidade.HasValue
                || v.Visibilidade == VagaPublicacaoVisibilidade.NaoInformado
                || v.Visibilidade == VagaPublicacaoVisibilidade.Externa
                || v.Visibilidade == VagaPublicacaoVisibilidade.InternaEExterna)
            .Where(v => !v.DataInicio.HasValue || v.DataInicio.Value <= today)
            .Where(v => !v.DataEncerramento.HasValue || v.DataEncerramento.Value >= today)
            .Select(v => new PortalVagaCardResponse(
                v.Id,
                v.Titulo,
                v.CentroCusto != null ? v.CentroCusto.Description : null,
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
                tenantName,
                v.DescricaoPublica,
                v.Urgente,
                v.AceitaPcd,
                v.QuantidadeVagas,
                v.Etapas.OrderBy(e => e.Ordem).Select(e => e.Nome).ToList()))
            .FirstOrDefaultAsync(ct);

        if (item is null)
            return NotFound();

        return Ok(item);
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
