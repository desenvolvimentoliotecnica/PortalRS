using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

public static class AgendaTypeSeeder
{
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
