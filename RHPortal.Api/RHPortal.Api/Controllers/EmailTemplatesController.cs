using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Contracts.Emails;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Messaging.Email;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Templates de e-mail ao candidato: catálogo, rich-text, reset ao padrão e assets.
/// </summary>
[ApiController]
[Authorize]
[Route("api/email-templates")]
public sealed class EmailTemplatesController : ControllerBase
{
    private const int MaxImageBytes = 512 * 1024;
    private static readonly HashSet<string> AllowedImageTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp",
    };

    private readonly IStringLocalizer<ControllerMessages> _localizer;
    private readonly ICandidateEmailTemplateService _catalog;

    public EmailTemplatesController(
        IStringLocalizer<ControllerMessages> localizer,
        ICandidateEmailTemplateService catalog)
    {
        _localizer = localizer;
        _catalog = catalog;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<EmailTemplateListItem>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<EmailTemplateListItem>>> List(
        [FromServices] AppDbContext db,
        [FromQuery] bool includeInactive = false,
        CancellationToken ct = default)
    {
        await _catalog.EnsureCatalogSeededAsync(ct);

        var query = db.EmailTemplates.AsNoTracking();
        if (!includeInactive)
            query = query.Where(x => x.IsActive);

        var entities = await query
            .OrderBy(x => x.Name)
            .ThenByDescending(x => x.Version)
            .ToListAsync(ct);

        // Uma linha ativa (ou a mais recente) por Name do catálogo
        var byName = entities
            .GroupBy(x => x.Name, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.OrderByDescending(x => x.IsActive).ThenByDescending(x => x.Version).First())
            .ToDictionary(x => x.Name, StringComparer.OrdinalIgnoreCase);

        var items = new List<EmailTemplateListItem>();
        foreach (var def in CandidateEmailTemplateCatalog.All)
        {
            byName.TryGetValue(def.Code, out var entity);
            var subject = entity?.SubjectTemplate ?? def.SubjectDefault;
            var body = entity?.BodyHtml ?? def.BodyHtmlDefault;
            items.Add(new EmailTemplateListItem(
                entity?.Id ?? Guid.Empty,
                def.Code,
                def.DisplayName,
                def.Description,
                entity?.Version ?? 1,
                entity?.IsActive ?? true,
                !CandidateEmailTemplateCatalog.IsSameAsDefault(def.Code, subject, body),
                subject,
                def.Tags,
                entity?.CreatedAtUtc ?? DateTimeOffset.UtcNow,
                entity?.UpdatedAtUtc ?? DateTimeOffset.UtcNow));
        }

        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(EmailTemplateResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EmailTemplateResponse>> Get(
        Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct = default)
    {
        var entity = await db.EmailTemplates.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();
        return Ok(ToResponse(entity));
    }

    [HttpGet("by-code/{code}")]
    [ProducesResponseType(typeof(EmailTemplateResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<EmailTemplateResponse>> GetByCode(
        string code,
        [FromServices] AppDbContext db,
        CancellationToken ct = default)
    {
        await _catalog.EnsureCatalogSeededAsync(ct);
        if (!CandidateEmailTemplateCatalog.TryGet(code, out var def))
            return NotFound();

        var entity = await db.EmailTemplates.AsNoTracking()
            .Where(x => x.Name == def.Code && x.IsActive)
            .OrderByDescending(x => x.Version)
            .FirstOrDefaultAsync(ct);

        if (entity is null)
        {
            return Ok(new EmailTemplateResponse(
                Guid.Empty,
                def.Code,
                def.DisplayName,
                def.Description,
                1,
                true,
                false,
                def.SubjectDefault,
                def.BodyHtmlDefault,
                def.SubjectDefault,
                def.BodyHtmlDefault,
                def.Tags,
                DateTimeOffset.UtcNow,
                DateTimeOffset.UtcNow));
        }

        return Ok(ToResponse(entity));
    }

    [HttpPost]
    [ProducesResponseType(typeof(EmailTemplateResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<EmailTemplateResponse>> Create(
        [FromBody] EmailTemplateCreateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct = default)
    {
        var name = request.Name.Trim();
        if (!CandidateEmailTemplateCatalog.TryGet(name, out _))
            return BadRequest(new { message = "Use apenas códigos do catálogo de e-mails ao candidato." });

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
            SubjectTemplate = SanitizeHtml(request.SubjectTemplate.Trim()),
            BodyHtml = SanitizeHtml(request.BodyHtml),
            Version = 1,
            IsActive = true,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        db.EmailTemplates.Add(entity);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(Get), new { id = entity.Id }, ToResponse(entity));
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(EmailTemplateResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EmailTemplateResponse>> Update(
        Guid id,
        [FromBody] EmailTemplateUpdateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct = default)
    {
        var current = await db.EmailTemplates.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (current is null) return NotFound();
        if (!CandidateEmailTemplateCatalog.TryGet(current.Name, out _))
            return BadRequest(new { message = "Template fora do catálogo." });

        var nextVersion = current.Version + 1;
        var now = DateTimeOffset.UtcNow;

        current.IsActive = false;
        current.UpdatedAtUtc = now;

        var entity = new EmailTemplate
        {
            Id = Guid.NewGuid(),
            Name = current.Name,
            SubjectTemplate = request.SubjectTemplate.Trim(),
            BodyHtml = SanitizeHtml(request.BodyHtml),
            Version = nextVersion,
            IsActive = true,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        db.EmailTemplates.Add(entity);
        await db.SaveChangesAsync(ct);
        return Ok(ToResponse(entity));
    }

    [HttpPost("{id:guid}/set-active")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
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

    /// <summary>Restaura assunto e corpo ao padrão de fábrica.</summary>
    [HttpPost("{id:guid}/reset")]
    [ProducesResponseType(typeof(EmailTemplateResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EmailTemplateResponse>> Reset(Guid id, [FromServices] AppDbContext db, CancellationToken ct)
    {
        var current = await db.EmailTemplates.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (current is null) return NotFound();
        var entity = await _catalog.ResetToFactoryAsync(current.Name, ct);
        return Ok(ToResponse(entity));
    }

    [HttpPost("by-code/{code}/reset")]
    [ProducesResponseType(typeof(EmailTemplateResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<EmailTemplateResponse>> ResetByCode(string code, CancellationToken ct)
    {
        if (!CandidateEmailTemplateCatalog.TryGet(code, out _))
            return NotFound();
        var entity = await _catalog.ResetToFactoryAsync(code, ct);
        return Ok(ToResponse(entity));
    }

    /// <summary>
    /// Upload de imagem para o corpo do template. Devolve data-URL estável embutível no HTML
    /// (faz parte do layout do e-mail, inclusive logo de cabeçalho).
    /// </summary>
    [HttpPost("assets")]
    [RequestSizeLimit(MaxImageBytes + 4096)]
    [ProducesResponseType(typeof(EmailTemplateAssetUploadResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<EmailTemplateAssetUploadResponse>> UploadAsset(
        IFormFile file,
        CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "Arquivo obrigatório." });
        if (file.Length > MaxImageBytes)
            return BadRequest(new { message = "Imagem deve ter no máximo 512 KB." });

        var contentType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType;
        if (!AllowedImageTypes.Contains(contentType))
            return BadRequest(new { message = "Use PNG, JPEG, GIF ou WebP." });

        await using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        var bytes = ms.ToArray();
        var b64 = Convert.ToBase64String(bytes);
        var url = $"data:{contentType};base64,{b64}";
        return Ok(new EmailTemplateAssetUploadResponse(url, contentType, bytes.LongLength));
    }

    private static EmailTemplateResponse ToResponse(EmailTemplate entity)
    {
        CandidateEmailTemplateCatalog.TryGet(entity.Name, out var def);
        var display = def?.DisplayName ?? entity.Name;
        var description = def?.Description ?? string.Empty;
        var tags = def?.Tags ?? Array.Empty<string>();
        var subjectDefault = def?.SubjectDefault ?? entity.SubjectTemplate;
        var bodyDefault = def?.BodyHtmlDefault ?? entity.BodyHtml;
        var customized = def is null
            || !CandidateEmailTemplateCatalog.IsSameAsDefault(entity.Name, entity.SubjectTemplate, entity.BodyHtml);

        return new EmailTemplateResponse(
            entity.Id,
            entity.Name,
            display,
            description,
            entity.Version,
            entity.IsActive,
            customized,
            entity.SubjectTemplate,
            entity.BodyHtml,
            subjectDefault,
            bodyDefault,
            tags,
            entity.CreatedAtUtc,
            entity.UpdatedAtUtc);
    }

    private static string SanitizeHtml(string html)
    {
        if (string.IsNullOrEmpty(html)) return string.Empty;
        // Remove scripts / event handlers óbvios
        var cleaned = Regex.Replace(html, @"<script\b[^<]*(?:(?!</script>)<[^<]*)*</script>", string.Empty, RegexOptions.IgnoreCase);
        cleaned = Regex.Replace(cleaned, @"\son\w+\s*=\s*(""[^""]*""|'[^']*'|[^\s>]+)", string.Empty, RegexOptions.IgnoreCase);
        cleaned = Regex.Replace(cleaned, @"javascript:", string.Empty, RegexOptions.IgnoreCase);
        return cleaned;
    }
}
