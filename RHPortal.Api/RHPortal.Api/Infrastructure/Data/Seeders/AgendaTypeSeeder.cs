using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

public static class AgendaTypeSeeder
{
    public static Task EnsureDefaultAsync(AppDbContext db, CancellationToken ct)
    {
        var agendaTypes = new (string Code, string Label, string Color, string Icon, int SortOrder)[]
        {
            ("entrevista", "Entrevista", "#1f6feb", "bi-camera-video", 1),
            ("reuniao", "Reuniao", "#0ea5e9", "bi-people", 2),
            ("onboarding", "Onboarding", "#22c55e", "bi-stars", 3),
            ("assessment", "Assessment", "#f59e0b", "bi-clipboard-check", 4),
            ("followup", "Follow-up", "#8b5cf6", "bi-chat-dots", 5),
            ("outro", "Outro", "#6b7280", "bi-calendar", 6)
        };

        return EnsureAsync(db, agendaTypes, ct);
    }

    public static async Task EnsureAsync(
        AppDbContext db,
        IEnumerable<(string Code, string Label, string Color, string Icon, int SortOrder)> agendaTypes,
        CancellationToken ct)
    {
        var existingCodes = await db.AgendaEventTypes
            .AsNoTracking()
            .Select(x => x.Code)
            .ToListAsync(ct);

        var existingSet = existingCodes.ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var type in agendaTypes)
        {
            if (existingSet.Contains(type.Code)) continue;

            db.AgendaEventTypes.Add(new AgendaEventType
            {
                Id = Guid.NewGuid(),
                Code = type.Code,
                Label = type.Label,
                Color = type.Color,
                Icon = type.Icon,
                SortOrder = type.SortOrder,
                IsActive = true
            });
        }

        await db.SaveChangesAsync(ct);
    }
}
