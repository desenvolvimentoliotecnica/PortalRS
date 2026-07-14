using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Messaging.Email;

public interface ICandidateEmailTemplateService
{
    Task EnsureCatalogSeededAsync(CancellationToken ct);

    Task<(string Subject, string BodyHtml, Guid? TemplateId, int? Version)> ResolveRenderedAsync(
        string catalogCode,
        IReadOnlyDictionary<string, string?> tokens,
        CancellationToken ct);

    Task<EmailTemplate> ResetToFactoryAsync(string catalogCode, CancellationToken ct);
}

public sealed class CandidateEmailTemplateService : ICandidateEmailTemplateService
{
    private readonly AppDbContext _db;

    public CandidateEmailTemplateService(AppDbContext db)
    {
        _db = db;
    }

    public async Task EnsureCatalogSeededAsync(CancellationToken ct)
    {
        var existing = await _db.EmailTemplates
            .AsNoTracking()
            .Where(x => x.IsActive)
            .Select(x => x.Name)
            .ToListAsync(ct);

        var existingSet = existing.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var now = DateTimeOffset.UtcNow;
        var added = false;

        foreach (var def in CandidateEmailTemplateCatalog.All)
        {
            if (existingSet.Contains(def.Code))
                continue;

            _db.EmailTemplates.Add(new EmailTemplate
            {
                Id = Guid.NewGuid(),
                Name = def.Code,
                SubjectTemplate = def.SubjectDefault,
                BodyHtml = def.BodyHtmlDefault,
                Version = 1,
                IsActive = true,
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            });
            added = true;
        }

        if (added)
            await _db.SaveChangesAsync(ct);
    }

    public async Task<(string Subject, string BodyHtml, Guid? TemplateId, int? Version)> ResolveRenderedAsync(
        string catalogCode,
        IReadOnlyDictionary<string, string?> tokens,
        CancellationToken ct)
    {
        var def = CandidateEmailTemplateCatalog.GetRequired(catalogCode);
        var expanded = EmailTemplateRenderer.ExpandAliases(tokens);

        var entity = await _db.EmailTemplates
            .AsNoTracking()
            .Where(x => x.Name == catalogCode && x.IsActive)
            .OrderByDescending(x => x.Version)
            .FirstOrDefaultAsync(ct);

        var subjectTemplate = entity?.SubjectTemplate ?? def.SubjectDefault;
        var bodyTemplate = entity?.BodyHtml ?? def.BodyHtmlDefault;

        var subject = EmailTemplateRenderer.Render(subjectTemplate, expanded);
        var body = EmailTemplateRenderer.Render(bodyTemplate, expanded);
        return (subject, body, entity?.Id, entity?.Version);
    }

    public async Task<EmailTemplate> ResetToFactoryAsync(string catalogCode, CancellationToken ct)
    {
        var def = CandidateEmailTemplateCatalog.GetRequired(catalogCode);
        var now = DateTimeOffset.UtcNow;

        var current = await _db.EmailTemplates
            .Where(x => x.Name == catalogCode && x.IsActive)
            .OrderByDescending(x => x.Version)
            .FirstOrDefaultAsync(ct);

        if (current is not null)
        {
            current.IsActive = false;
            current.UpdatedAtUtc = now;
        }

        var nextVersion = (current?.Version ?? 0) + 1;
        var entity = new EmailTemplate
        {
            Id = Guid.NewGuid(),
            Name = catalogCode,
            SubjectTemplate = def.SubjectDefault,
            BodyHtml = def.BodyHtmlDefault,
            Version = nextVersion,
            IsActive = true,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };
        _db.EmailTemplates.Add(entity);
        await _db.SaveChangesAsync(ct);
        return entity;
    }
}
