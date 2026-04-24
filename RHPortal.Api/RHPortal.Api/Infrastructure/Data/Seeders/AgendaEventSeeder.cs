using Bogus;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

public static class AgendaEventSeeder
{
    public static async Task EnsureEventsAsync(AppDbContext db, string tenantId, int targetCount, CancellationToken ct, int? randomSeed = null)
    {
        targetCount = Math.Max(0, targetCount);
        if (targetCount == 0)
            return;

        var existingCount = await db.AgendaEvents.CountAsync(x => x.TenantId == tenantId, ct);
        if (existingCount >= targetCount)
            return;

        var types = await db.AgendaEventTypes
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.IsActive)
            .ToDictionaryAsync(x => x.Code, x => x.Id, ct);

        if (types.Count == 0) return;

        var seed = (randomSeed ?? 42) + 23;
        var faker = new Faker("pt_BR")
        {
            Random = new Randomizer(seed)
        };

        var areaCodes = await db.CentrosCusto
            .AsNoTracking()
            .Where(a => a.IsActive)
            .Select(a => a.Code)
            .ToListAsync(ct);
        if (areaCodes.Count == 0)
            areaCodes = new List<string> { "OPS", "QUA", "ENG", "SCM", "PDI", "COM", "TEC", "FIN", "RH", "ADM" };

        var typeList = types.Select(t => new { Code = t.Key, Id = t.Value }).ToList();
        var now = DateTime.UtcNow;
        var jobPrefixes = new[] { "Analista", "Assistente", "Tecnico", "Supervisor", "Coordenador" };
        var jobSubjects = new[] { "Qualidade", "Producao", "Manutencao", "Financeiro", "Logistica", "Comercial", "RH", "TI" };
        var locations = new[] { "Teams", "Google Meet", "Sala 1", "Sala 2", "Sala 3", "Online" };
        var statuses = new[] { "confirmado", "pendente", "remarcado" };
        var toCreate = targetCount - existingCount;

        var events = new List<AgendaEvent>();
        for (var i = 0; i < toCreate; i++)
        {
            var type = faker.PickRandom(typeList);
            var jobTitle = $"{faker.PickRandom(jobPrefixes)} de {faker.PickRandom(jobSubjects)}";
            var candidate = faker.Name.FullName();
            var owner = $"{faker.Name.FirstName()} (RH)";
            var location = faker.PickRandom(locations);
            var areaCode = faker.PickRandom(areaCodes);
            var vagaCode = $"VAG-{areaCode}-{faker.Random.Int(1, 999):000}";
            var vagaTitle = jobTitle;

            var start = now.Date.AddDays(faker.Random.Int(-4, 10)).AddHours(faker.Random.Int(8, 17));
            var end = start.AddMinutes(faker.Random.Int(30, 90));

            events.Add(new AgendaEvent
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                TypeId = type.Id,
                Title = BuildTitle(type.Code, jobTitle),
                StartAtUtc = DateTime.SpecifyKind(start, DateTimeKind.Utc),
                EndAtUtc = DateTime.SpecifyKind(end, DateTimeKind.Utc),
                AllDay = false,
                Status = faker.PickRandom(statuses),
                Location = location,
                Owner = owner,
                Candidate = candidate,
                VagaTitle = vagaTitle,
                VagaCode = vagaCode,
                Notes = faker.Lorem.Sentence(8),
                CreatedAtUtc = DateTimeOffset.UtcNow.AddMinutes(-faker.Random.Int(60, 9000)),
                UpdatedAtUtc = DateTimeOffset.UtcNow
            });
        }

        if (events.Count > 0)
        {
            db.AgendaEvents.AddRange(events);
            await db.SaveChangesAsync(ct);
        }
    }

    private static string BuildTitle(string typeCode, string jobTitle)
    {
        return typeCode.ToLowerInvariant() switch
        {
            "entrevista" => $"Entrevista - {jobTitle}",
            "reuniao" => $"Reuniao de alinhamento - {jobTitle}",
            "assessment" => $"Assessment tecnico - {jobTitle}",
            "followup" => $"Follow-up - {jobTitle}",
            "onboarding" => $"Onboarding - {jobTitle}",
            _ => $"Contato inicial - {jobTitle}"
        };
    }
}
