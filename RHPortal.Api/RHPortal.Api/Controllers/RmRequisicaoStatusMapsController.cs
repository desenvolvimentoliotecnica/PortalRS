using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Rm;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>CRUD de mapas CODSTATUS RM → <see cref="SolicitacaoStatus"/> (SYN-01).</summary>
[ApiController]
[RequirePermission("access.manage")]
[Route("api/rm/requisicao-status-maps")]
public sealed class RmRequisicaoStatusMapsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenant;

    public RmRequisicaoStatusMapsController(AppDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    private static RmRequisicaoStatusMapResponse ToResponse(RmRequisicaoStatusMap m)
        => new(m.Id, m.CodStatusRm, m.PortalStatusKey, m.Priority);

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<RmRequisicaoStatusMapResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<RmRequisicaoStatusMapResponse>>> List(CancellationToken ct)
    {
        var rows = await _db.RmRequisicaoStatusMaps
            .AsNoTracking()
            .OrderBy(m => m.CodStatusRm).ThenBy(m => m.Priority ?? int.MaxValue)
            .Select(m => new RmRequisicaoStatusMapResponse(m.Id, m.CodStatusRm, m.PortalStatusKey, m.Priority))
            .ToListAsync(ct);
        return Ok(rows);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(RmRequisicaoStatusMapResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RmRequisicaoStatusMapResponse>> GetById(Guid id, CancellationToken ct)
    {
        var m = await _db.RmRequisicaoStatusMaps.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (m is null) return NotFound();
        return Ok(ToResponse(m));
    }

    [HttpPost]
    [ProducesResponseType(typeof(RmRequisicaoStatusMapResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<RmRequisicaoStatusMapResponse>> Create(
        [FromBody] RmRequisicaoStatusMapCreateRequest body,
        CancellationToken ct)
    {
        if (!Enum.TryParse<SolicitacaoStatus>(body.PortalStatusKey.Trim(), ignoreCase: false, out _))
            return BadRequest(new { message = $"PortalStatusKey inválido para enum SolicitacaoStatus: {body.PortalStatusKey}" });

        var exists = await _db.RmRequisicaoStatusMaps
            .AnyAsync(m => m.CodStatusRm == body.CodStatusRm, ct);
        if (exists)
            return Conflict(new { message = $"Já existe mapa para CodStatusRm={body.CodStatusRm}." });

        var entity = new RmRequisicaoStatusMap
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant.TenantId,
            CodStatusRm = body.CodStatusRm,
            PortalStatusKey = body.PortalStatusKey.Trim(),
            Priority = body.Priority,
            CreatedAtUtc = DateTimeOffset.UtcNow,
        };
        _db.RmRequisicaoStatusMaps.Add(entity);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, ToResponse(entity));
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(RmRequisicaoStatusMapResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RmRequisicaoStatusMapResponse>> Update(
        Guid id,
        [FromBody] RmRequisicaoStatusMapUpdateRequest body,
        CancellationToken ct)
    {
        if (!Enum.TryParse<SolicitacaoStatus>(body.PortalStatusKey.Trim(), ignoreCase: false, out _))
            return BadRequest(new { message = $"PortalStatusKey inválido para enum SolicitacaoStatus: {body.PortalStatusKey}" });

        var m = await _db.RmRequisicaoStatusMaps.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (m is null) return NotFound();

        m.PortalStatusKey = body.PortalStatusKey.Trim();
        m.Priority = body.Priority;
        m.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Ok(ToResponse(m));
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var m = await _db.RmRequisicaoStatusMaps.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (m is null) return NotFound();
        _db.RmRequisicaoStatusMaps.Remove(m);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
