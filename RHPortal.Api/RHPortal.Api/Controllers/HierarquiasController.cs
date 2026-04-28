using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Hierarquias;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Hierarquia / organograma sincronizado do TOTVS RM (<c>VHIERARQUIA</c>).
///
/// - <c>GET /api/hierarquias</c> — lista flat (todos os nós do tenant)
/// - <c>GET /api/hierarquias/tree</c> — árvore (nodes + children recursivos)
/// - <c>POST /api/hierarquias/bulk</c> — bulk upsert (consumido pelo worker, autenticado X-Api-Key ou JWT)
///
/// Funcionários e Vagas referenciam <c>HierarquiaId</c> derivada de movimentos:
///   - Funcionario → última <c>VREQTRANSFPROMOCAO.IDHIERARQUIADESTINO</c> aprovada
///   - Vaga → <c>VREQAUMENTOQUADRO.IDHIERARQUIADESTINO</c> ou <c>VREQSUBSTITUICAO.IDHIERARQUIADESTINO</c>
/// </summary>
[ApiController]
[Route("api/hierarquias")]
public sealed class HierarquiasController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;

    public HierarquiasController(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    [HttpGet]
    [ProducesResponseType(typeof(List<HierarquiaResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<HierarquiaResponse>>> List(
        CancellationToken ct,
        [FromQuery] bool includeInactive = false)
    {
        var query = _db.Hierarquias.AsNoTracking();
        if (!includeInactive)
            query = query.Where(x => x.IsActive);

        var list = await query
            .OrderBy(x => x.Estrutura)
            .ThenBy(x => x.Descricao)
            .Select(x => new HierarquiaResponse(
                x.Id, x.IdHierarquiaRm, x.Descricao, x.IdHierarquiaSuperiorRm,
                x.HierarquiaSuperiorId, x.Estrutura, x.IdNivelHierarquiaRm,
                x.IsActive, x.CreatedAtUtc, x.UpdatedAtUtc))
            .ToListAsync(ct);

        return Ok(list);
    }

    [HttpGet("tree")]
    [ProducesResponseType(typeof(List<HierarquiaTreeNode>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<HierarquiaTreeNode>>> Tree(CancellationToken ct)
    {
        var all = await _db.Hierarquias.AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.Estrutura)
            .ToListAsync(ct);

        // Index por Id pra resolver children sem múltiplos passes
        var byParent = all
            .Where(x => x.HierarquiaSuperiorId.HasValue)
            .GroupBy(x => x.HierarquiaSuperiorId!.Value)
            .ToDictionary(g => g.Key, g => g.ToList());

        HierarquiaTreeNode Build(Hierarquia node) => new(
            node.Id,
            node.IdHierarquiaRm,
            node.Descricao,
            node.Estrutura,
            node.IdNivelHierarquiaRm,
            node.IsActive,
            byParent.TryGetValue(node.Id, out var kids)
                ? kids.Select(Build).ToList()
                : (IReadOnlyList<HierarquiaTreeNode>)Array.Empty<HierarquiaTreeNode>());

        var roots = all
            .Where(x => !x.HierarquiaSuperiorId.HasValue)
            .Select(Build)
            .ToList();

        return Ok(roots);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(HierarquiaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<HierarquiaResponse>> GetById(Guid id, CancellationToken ct)
    {
        var h = await _db.Hierarquias.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (h is null) return NotFound();
        return Ok(new HierarquiaResponse(
            h.Id, h.IdHierarquiaRm, h.Descricao, h.IdHierarquiaSuperiorRm,
            h.HierarquiaSuperiorId, h.Estrutura, h.IdNivelHierarquiaRm,
            h.IsActive, h.CreatedAtUtc, h.UpdatedAtUtc));
    }

    /// <summary>
    /// Bulk upsert idempotente. Resolve <c>HierarquiaSuperiorId</c> em duas passadas:
    /// 1ª passada cria/atualiza todas sem FK; 2ª passada vincula via <c>IdHierarquiaSuperiorRm</c>.
    /// Consumido pelo worker (<c>PortalHierarquiaSyncService</c>) a cada ciclo.
    /// </summary>
    [HttpPost("bulk")]
    [ProducesResponseType(typeof(HierarquiaBulkUpsertResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<HierarquiaBulkUpsertResponse>> BulkUpsert(
        [FromBody] HierarquiaBulkUpsertRequest request,
        CancellationToken ct)
    {
        if (request?.Items is null || request.Items.Count == 0)
            return Ok(new HierarquiaBulkUpsertResponse(0, 0, 0));

        var tenantId = _tenantContext.TenantId;
        var byIdRm = await _db.Hierarquias
            .Where(x => x.TenantId == tenantId)
            .ToDictionaryAsync(x => x.IdHierarquiaRm, ct);

        var now = DateTimeOffset.UtcNow;
        var created = 0;
        var updated = 0;

        // Passada 1 — cria ou atualiza sem resolver FK pro pai
        foreach (var item in request.Items)
        {
            if (byIdRm.TryGetValue(item.IdHierarquiaRm, out var existing))
            {
                existing.Descricao = item.Descricao;
                existing.IdHierarquiaSuperiorRm = item.IdHierarquiaSuperiorRm;
                existing.Estrutura = item.Estrutura;
                existing.IdNivelHierarquiaRm = item.IdNivelHierarquiaRm;
                existing.IsActive = item.IsActive;
                existing.UpdatedAtUtc = now;
                updated++;
            }
            else
            {
                var fresh = new Hierarquia
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    IdHierarquiaRm = item.IdHierarquiaRm,
                    Descricao = item.Descricao,
                    IdHierarquiaSuperiorRm = item.IdHierarquiaSuperiorRm,
                    Estrutura = item.Estrutura,
                    IdNivelHierarquiaRm = item.IdNivelHierarquiaRm,
                    IsActive = item.IsActive,
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now,
                };
                _db.Hierarquias.Add(fresh);
                byIdRm[item.IdHierarquiaRm] = fresh;
                created++;
            }
        }

        await _db.SaveChangesAsync(ct);

        // Passada 2 — vincula HierarquiaSuperiorId (Guid) via IdHierarquiaSuperiorRm
        foreach (var node in byIdRm.Values)
        {
            if (node.IdHierarquiaSuperiorRm is int parentRm
                && byIdRm.TryGetValue(parentRm, out var parent))
            {
                if (node.HierarquiaSuperiorId != parent.Id)
                {
                    node.HierarquiaSuperiorId = parent.Id;
                    node.UpdatedAtUtc = now;
                }
            }
            else if (node.HierarquiaSuperiorId is not null && node.IdHierarquiaSuperiorRm is null)
            {
                node.HierarquiaSuperiorId = null;
                node.UpdatedAtUtc = now;
            }
        }

        await _db.SaveChangesAsync(ct);

        return Ok(new HierarquiaBulkUpsertResponse(created, updated, request.Items.Count));
    }
}
