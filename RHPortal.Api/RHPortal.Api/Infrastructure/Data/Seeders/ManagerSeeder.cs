using Bogus;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

public static class ManagerSeeder
{
    public static async Task EnsureAsync(AppDbContext db, int targetCount, CancellationToken ct, int? randomSeed = null)
    {
        targetCount = Math.Max(0, targetCount);
        if (targetCount == 0)
            return;

        var existingEmails = await db.Managers
            .AsNoTracking()
            .Select(m => m.Email)
            .ToListAsync(ct);
        var existingCount = existingEmails.Count;
        if (existingCount >= targetCount)
            return;

        var units = await db.Units.AsNoTracking().ToListAsync(ct);
        var areas = await db.Areas.AsNoTracking().ToListAsync(ct);
        var cargos = await db.JobPositions.AsNoTracking().ToListAsync(ct);

        if (units.Count == 0 || areas.Count == 0 || cargos.Count == 0)
            return;

        var toCreate = targetCount - existingCount;
        var seed = (randomSeed ?? 42) + 17;
        var faker = new Faker("pt_BR")
        {
            Random = new Randomizer(seed)
        };

        var usedEmails = existingEmails
            .Where(e => !string.IsNullOrWhiteSpace(e))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var areaPool = areas.OrderBy(_ => faker.Random.Int()).ToList();
        var unitPool = units.OrderBy(_ => faker.Random.Int()).ToList();
        var cargosByArea = cargos
            .GroupBy(c => c.AreaId)
            .ToDictionary(g => g.Key, g => g.ToList());

        for (var i = 0; i < toCreate; i++)
        {
            var area = areaPool[i % areaPool.Count];
            var unit = unitPool[i % unitPool.Count];
            var cargoList = cargosByArea.TryGetValue(area.Id, out var list) && list.Count > 0
                ? list
                : cargos;
            var cargo = faker.PickRandom(cargoList);
            var name = faker.Name.FullName();
            var email = BuildUniqueEmail(name, usedEmails, faker);

            db.Managers.Add(new Manager
            {
                Id = Guid.NewGuid(),
                Name = name,
                Email = email,
                Phone = faker.Phone.PhoneNumber("(##) 9####-####"),
                Status = ManagerStatus.Active,
                UnitId = unit.Id,
                AreaId = area.Id,
                Headcount = faker.Random.Int(3, 28),
                JobPositionId = cargo.Id,
                Notes = "Seed inicial de gestor"
            });
        }

        await db.SaveChangesAsync(ct);
    }

    private static string BuildUniqueEmail(string fullName, ISet<string> used, Faker faker)
    {
        var user = ToEmailUser(fullName);
        var email = $"{user}@empresa.com";
        if (used.Add(email))
            return email;

        for (var i = 0; i < 5; i++)
        {
            var candidate = $"{user}.{faker.Random.Int(2, 999)}@empresa.com";
            if (used.Add(candidate))
                return candidate;
        }

        var fallback = $"{user}.{Guid.NewGuid():N}@empresa.com";
        used.Add(fallback);
        return fallback;
    }

    private static string ToEmailUser(string fullName)
    {
        if (string.IsNullOrWhiteSpace(fullName))
            return "gestor";

        var normalized = fullName.Normalize(System.Text.NormalizationForm.FormD);
        var cleaned = new string(normalized
            .Where(c => System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c) != System.Globalization.UnicodeCategory.NonSpacingMark)
            .ToArray())
            .Normalize(System.Text.NormalizationForm.FormC)
            .Trim()
            .ToLowerInvariant();

        var parts = cleaned.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return parts.Length == 0 ? "gestor" : string.Join('.', parts);
    }
}
