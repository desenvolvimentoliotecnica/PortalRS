using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Messaging.Email;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

public static class EmailTemplateSeeder
{
    public static async Task EnsureAsync(AppDbContext db, IStringLocalizer<SeedMessages> localizer, CancellationToken ct)
    {
        // Garante catálogo completo (defaults de fábrica). Localizer usado só como fallback legado
        // se CandidaturaConfirmacao ainda não existir e o catálogo já fornecer o padrão.
        _ = localizer;
        await EnsureCatalogAsync(db, ct);
    }

    public static async Task EnsureCatalogAsync(AppDbContext db, CancellationToken ct)
    {
        var activeNames = await db.EmailTemplates
            .AsNoTracking()
            .Where(x => x.IsActive)
            .Select(x => x.Name)
            .ToListAsync(ct);
        var set = activeNames.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var now = DateTimeOffset.UtcNow;
        var added = false;

        foreach (var def in CandidateEmailTemplateCatalog.All)
        {
            if (set.Contains(def.Code))
                continue;

            db.EmailTemplates.Add(new EmailTemplate
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
            await db.SaveChangesAsync(ct);
    }
}
