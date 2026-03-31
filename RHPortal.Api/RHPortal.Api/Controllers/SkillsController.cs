using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

[ApiController]
[Route("api/skills")]
[Authorize]
public sealed class SkillsController : ControllerBase
{
    /// <summary>
    /// Lista todas as skills do tenant (com aliases).
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> List(
        [FromServices] AppDbContext db,
        [FromQuery] string? category = null,
        CancellationToken ct = default)
    {
        var query = db.Set<Skill>()
            .AsNoTracking()
            .Include(s => s.Aliases)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(s => s.Category == category);

        var skills = await query
            .OrderBy(s => s.CanonicalName)
            .Take(500)
            .Select(s => new
            {
                s.Id,
                s.CanonicalName,
                s.Category,
                s.ParentSkillId,
                Aliases = s.Aliases.Select(a => a.AliasName).ToList(),
            })
            .ToListAsync(ct);

        return Ok(skills);
    }

    /// <summary>
    /// Busca skills por texto (fuzzy com pg_trgm quando disponível, fallback para LIKE).
    /// </summary>
    [HttpGet("search")]
    public async Task<IActionResult> Search(
        [FromQuery] string q,
        [FromServices] AppDbContext db,
        [FromServices] ITenantContext tenantContext,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Length < 2)
            return BadRequest(new { message = "Query deve ter ao menos 2 caracteres." });

        var tenantId = tenantContext.TenantId ?? "";
        var pattern = $"%{q.Trim().ToLowerInvariant()}%";

        // Search by canonical name and aliases using LIKE
        var byName = await db.Set<Skill>()
            .AsNoTracking()
            .Where(s => EF.Functions.ILike(s.CanonicalName, pattern))
            .Take(20)
            .Select(s => new { s.Id, s.CanonicalName, s.Category, MatchedAlias = (string?)null })
            .ToListAsync(ct);

        var byAlias = await db.Set<SkillAlias>()
            .AsNoTracking()
            .Include(a => a.Skill)
            .Where(a => EF.Functions.ILike(a.AliasName, pattern))
            .Take(20)
            .Select(a => new { a.Skill!.Id, a.Skill.CanonicalName, a.Skill.Category, MatchedAlias = (string?)a.AliasName })
            .ToListAsync(ct);

        var combined = byName.Concat(byAlias)
            .DistinctBy(x => x.Id)
            .Take(20)
            .ToList();

        return Ok(combined);
    }

    /// <summary>
    /// Cria uma nova skill com aliases opcionais.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateSkillRequest request,
        [FromServices] AppDbContext db,
        [FromServices] ITenantContext tenantContext)
    {
        var tenantId = tenantContext.TenantId ?? "";
        var now = DateTimeOffset.UtcNow;

        var skill = new Skill
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CanonicalName = request.CanonicalName.Trim(),
            Category = request.Category?.Trim(),
            ParentSkillId = request.ParentSkillId,
            CreatedAtUtc = now,
        };

        if (request.Aliases is { Count: > 0 })
        {
            foreach (var alias in request.Aliases.Where(a => !string.IsNullOrWhiteSpace(a)).Distinct())
            {
                skill.Aliases.Add(new SkillAlias
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    SkillId = skill.Id,
                    AliasName = alias.Trim().ToLowerInvariant(),
                });
            }
        }

        // Always add canonical name as alias too
        var canonicalLower = skill.CanonicalName.ToLowerInvariant();
        if (!skill.Aliases.Any(a => a.AliasName == canonicalLower))
        {
            skill.Aliases.Add(new SkillAlias
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                SkillId = skill.Id,
                AliasName = canonicalLower,
            });
        }

        db.Set<Skill>().Add(skill);
        await db.SaveChangesAsync();

        return Created($"/api/skills/{skill.Id}", new { skill.Id, skill.CanonicalName });
    }

    /// <summary>
    /// Adiciona aliases a uma skill existente.
    /// </summary>
    [HttpPost("{skillId:guid}/aliases")]
    public async Task<IActionResult> AddAliases(
        Guid skillId,
        [FromBody] AddAliasesRequest request,
        [FromServices] AppDbContext db,
        [FromServices] ITenantContext tenantContext)
    {
        var tenantId = tenantContext.TenantId ?? "";
        var skill = await db.Set<Skill>().FirstOrDefaultAsync(s => s.Id == skillId);
        if (skill is null) return NotFound();

        foreach (var alias in request.Aliases.Where(a => !string.IsNullOrWhiteSpace(a)).Distinct())
        {
            var normalized = alias.Trim().ToLowerInvariant();
            var exists = await db.Set<SkillAlias>()
                .AnyAsync(a => a.TenantId == tenantId && a.AliasName == normalized);
            if (!exists)
            {
                db.Set<SkillAlias>().Add(new SkillAlias
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    SkillId = skillId,
                    AliasName = normalized,
                });
            }
        }

        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Remove uma skill e seus aliases.
    /// </summary>
    [HttpDelete("{skillId:guid}")]
    public async Task<IActionResult> Delete(
        Guid skillId,
        [FromServices] AppDbContext db)
    {
        var skill = await db.Set<Skill>().FirstOrDefaultAsync(s => s.Id == skillId);
        if (skill is null) return NotFound();

        db.Set<Skill>().Remove(skill);
        await db.SaveChangesAsync();
        return NoContent();
    }
}

public sealed record CreateSkillRequest(
    string CanonicalName,
    string? Category = null,
    Guid? ParentSkillId = null,
    List<string>? Aliases = null);

public sealed record AddAliasesRequest(List<string> Aliases);
