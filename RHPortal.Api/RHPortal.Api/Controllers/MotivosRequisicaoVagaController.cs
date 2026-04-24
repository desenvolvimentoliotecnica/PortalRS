using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.MotivosRequisicaoVaga;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Cadastro dos Motivos de Requisição de Vaga (tabela parametrizável por tenant).
/// Cada motivo declara seu efeito no headcount: Aumenta (+1), Diminui (-1) ou Ambos (reposição, 0 líquido).
/// </summary>
[ApiController]
[Route("api/motivos-requisicao-vaga")]
public sealed class MotivosRequisicaoVagaController : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(List<MotivoRequisicaoVagaResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<MotivoRequisicaoVagaResponse>>> List(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] string? search,
        [FromQuery] bool? active,
        [FromQuery] EfeitoHeadcount? efeito)
    {
        var query = db.MotivosRequisicaoVagaConfig.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.ToLower();
            query = query.Where(x =>
                x.Codigo.ToLower().Contains(s) ||
                x.Nome.ToLower().Contains(s));
        }

        if (active.HasValue)
            query = query.Where(x => x.IsActive == active.Value);

        if (efeito.HasValue)
            query = query.Where(x => x.EfeitoHeadcount == efeito.Value);

        var items = await query
            .OrderBy(x => x.Ordem)
            .ThenBy(x => x.Nome)
            .Select(x => new MotivoRequisicaoVagaResponse(
                x.Id, x.Codigo, x.Nome, x.Descricao,
                x.EfeitoHeadcount, x.IsActive, x.Ordem, x.IsSystem,
                x.CreatedAtUtc, x.UpdatedAtUtc))
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpGet("lookup")]
    [OutputCache(PolicyName = "lookup")]
    [ProducesResponseType(typeof(List<MotivoRequisicaoVagaLookupItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<MotivoRequisicaoVagaLookupItem>>> Lookup(
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var items = await db.MotivosRequisicaoVagaConfig
            .AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.Ordem)
            .ThenBy(x => x.Nome)
            .Select(x => new MotivoRequisicaoVagaLookupItem(x.Id, x.Codigo, x.Nome, x.EfeitoHeadcount))
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(MotivoRequisicaoVagaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MotivoRequisicaoVagaResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.MotivosRequisicaoVagaConfig.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        return entity is null ? NotFound() : Ok(ToResponse(entity));
    }

    [HttpPost]
    [ProducesResponseType(typeof(MotivoRequisicaoVagaResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<MotivoRequisicaoVagaResponse>> Create(
        [FromBody] MotivoRequisicaoVagaCreateRequest request,
        [FromServices] AppDbContext db,
        [FromServices] ITenantContext tenantContext,
        CancellationToken ct)
    {
        var codigoNormalizado = request.Codigo.Trim();
        if (await db.MotivosRequisicaoVagaConfig.AnyAsync(x => x.Codigo == codigoNormalizado, ct))
            return Conflict(new { message = "Já existe um motivo com esse código neste tenant." });

        var entity = new MotivoRequisicaoVagaConfig
        {
            Id = Guid.NewGuid(),
            TenantId = tenantContext.TenantId ?? string.Empty,
            Codigo = codigoNormalizado,
            Nome = request.Nome.Trim(),
            Descricao = string.IsNullOrWhiteSpace(request.Descricao) ? null : request.Descricao.Trim(),
            EfeitoHeadcount = request.EfeitoHeadcount,
            IsActive = request.IsActive,
            Ordem = request.Ordem,
            IsSystem = false,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };

        db.MotivosRequisicaoVagaConfig.Add(entity);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, ToResponse(entity));
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(MotivoRequisicaoVagaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<MotivoRequisicaoVagaResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] MotivoRequisicaoVagaUpdateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.MotivosRequisicaoVagaConfig.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        var codigoNormalizado = request.Codigo.Trim();
        if (!entity.IsSystem && !string.Equals(entity.Codigo, codigoNormalizado, StringComparison.Ordinal))
        {
            var conflict = await db.MotivosRequisicaoVagaConfig
                .AnyAsync(x => x.Id != id && x.Codigo == codigoNormalizado, ct);
            if (conflict)
                return Conflict(new { message = "Já existe outro motivo com esse código." });
            entity.Codigo = codigoNormalizado;
        }

        entity.Nome = request.Nome.Trim();
        entity.Descricao = string.IsNullOrWhiteSpace(request.Descricao) ? null : request.Descricao.Trim();
        entity.EfeitoHeadcount = request.EfeitoHeadcount;
        entity.IsActive = request.IsActive;
        entity.Ordem = request.Ordem;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);
        return Ok(ToResponse(entity));
    }

    [HttpPatch("{id:guid}/toggle-active")]
    [ProducesResponseType(typeof(MotivoRequisicaoVagaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MotivoRequisicaoVagaResponse>> ToggleActive(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.MotivosRequisicaoVagaConfig.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        entity.IsActive = !entity.IsActive;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return Ok(ToResponse(entity));
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.MotivosRequisicaoVagaConfig.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        if (entity.IsSystem)
            return Conflict(new { message = "Motivos do sistema não podem ser excluídos. Use 'Desativar' em vez disso." });

        // Proteção contra exclusão de motivo em uso por alguma solicitação.
        var emUso = await db.SolicitacoesVaga.AnyAsync(s => s.MotivoRequisicaoId == id, ct);
        if (emUso)
            return Conflict(new { message = "Este motivo está em uso por uma ou mais solicitações. Desative em vez de excluir." });

        db.MotivosRequisicaoVagaConfig.Remove(entity);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static MotivoRequisicaoVagaResponse ToResponse(MotivoRequisicaoVagaConfig e) =>
        new(e.Id, e.Codigo, e.Nome, e.Descricao,
            e.EfeitoHeadcount, e.IsActive, e.Ordem, e.IsSystem,
            e.CreatedAtUtc, e.UpdatedAtUtc);
}
