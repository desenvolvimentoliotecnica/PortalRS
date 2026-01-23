using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Contracts.Emails;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/email-templates")]
public sealed class EmailTemplatesController : ControllerBase
{
    private readonly IStringLocalizer<ControllerMessages> _localizer;

    public EmailTemplatesController(IStringLocalizer<ControllerMessages> localizer)
    {
        _localizer = localizer;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<EmailTemplateListItem>>> List(
        [FromServices] AppDbContext db,
        [FromQuery] bool includeInactive = false,
        CancellationToken ct = default)
    {
        var query = db.EmailTemplates.AsNoTracking();
        if (!includeInactive)
            query = query.Where(x => x.IsActive);

        var items = await query
            .OrderBy(x => x.Name)
            .ThenByDescending(x => x.Version)
            .Select(x => new EmailTemplateListItem(
                x.Id,
                x.Name,
                x.Version,
                x.IsActive,
                x.SubjectTemplate,
                x.CreatedAtUtc,
                x.UpdatedAtUtc))
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<EmailTemplateResponse>> Get(
        Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct = default)
    {
        var entity = await db.EmailTemplates.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();

        return Ok(new EmailTemplateResponse(
            entity.Id,
            entity.Name,
            entity.Version,
            entity.IsActive,
            entity.SubjectTemplate,
            entity.BodyHtml,
            entity.CreatedAtUtc,
            entity.UpdatedAtUtc));
    }

    [HttpPost]
    public async Task<ActionResult<EmailTemplateResponse>> Create(
        [FromBody] EmailTemplateCreateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct = default)
    {
        var name = request.Name.Trim();
        var latestVersion = await db.EmailTemplates
            .Where(x => x.Name == name)
            .OrderByDescending(x => x.Version)
            .Select(x => x.Version)
            .FirstOrDefaultAsync(ct);

        if (latestVersion > 0)
            return Conflict(new { message = _localizer["ControllerErrors.EmailTemplateNameExists"] });

        var now = DateTimeOffset.UtcNow;
        var entity = new EmailTemplate
        {
            Id = Guid.NewGuid(),
            Name = name,
            SubjectTemplate = request.SubjectTemplate.Trim(),
            BodyHtml = request.BodyHtml,
            Version = 1,
            IsActive = true,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        db.EmailTemplates.Add(entity);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(Get), new { id = entity.Id }, new EmailTemplateResponse(
            entity.Id,
            entity.Name,
            entity.Version,
            entity.IsActive,
            entity.SubjectTemplate,
            entity.BodyHtml,
            entity.CreatedAtUtc,
            entity.UpdatedAtUtc));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<EmailTemplateResponse>> Update(
        Guid id,
        [FromBody] EmailTemplateUpdateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct = default)
    {
        var current = await db.EmailTemplates.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (current is null) return NotFound();

        var nextVersion = current.Version + 1;
        var now = DateTimeOffset.UtcNow;

        current.IsActive = false;
        current.UpdatedAtUtc = now;

        var entity = new EmailTemplate
        {
            Id = Guid.NewGuid(),
            Name = current.Name,
            SubjectTemplate = request.SubjectTemplate.Trim(),
            BodyHtml = request.BodyHtml,
            Version = nextVersion,
            IsActive = true,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        db.EmailTemplates.Add(entity);
        await db.SaveChangesAsync(ct);

        return Ok(new EmailTemplateResponse(
            entity.Id,
            entity.Name,
            entity.Version,
            entity.IsActive,
            entity.SubjectTemplate,
            entity.BodyHtml,
            entity.CreatedAtUtc,
            entity.UpdatedAtUtc));
    }

    [HttpPost("{id:guid}/set-active")]
    public async Task<IActionResult> SetActive(
        Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct = default)
    {
        var template = await db.EmailTemplates.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (template is null) return NotFound();

        var siblings = await db.EmailTemplates
            .Where(x => x.Name == template.Name && x.Id != template.Id)
            .ToListAsync(ct);

        foreach (var s in siblings)
            s.IsActive = false;

        template.IsActive = true;
        template.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);
        return Ok();
    }
}
