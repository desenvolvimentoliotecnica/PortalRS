using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

public static class EmailTemplateSeeder
{
    public static async Task EnsureAsync(AppDbContext db, IStringLocalizer<SeedMessages> localizer, CancellationToken ct)
    {
        var exists = await db.EmailTemplates.AnyAsync(x => x.Name == "CandidaturaConfirmacao" && x.IsActive, ct);
        if (exists) return;

        var subject = localizer["Seed.EmailTemplateCandidaturaSubject"].Value;
        var bodyHtml = localizer["Seed.EmailTemplateCandidaturaBody"].Value;

        db.EmailTemplates.Add(new EmailTemplate
        {
            Id = Guid.NewGuid(),
            Name = "CandidaturaConfirmacao",
            SubjectTemplate = subject,
            BodyHtml = bodyHtml,
            Version = 1,
            IsActive = true,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow
        });

        await db.SaveChangesAsync(ct);
    }
}
