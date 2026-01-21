using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

public static class AgendaEventSeeder
{
    public static async Task EnsureEventsAsync(AppDbContext db, string tenantId, CancellationToken ct)
    {
        var hasEvents = await db.AgendaEvents.AnyAsync(x => x.TenantId == tenantId, ct);
        if (hasEvents) return;

        var types = await db.AgendaEventTypes
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.IsActive)
            .ToDictionaryAsync(x => x.Code, x => x.Id, ct);

        if (types.Count == 0) return;

        var now = DateTime.UtcNow;
        var seeds = new[]
        {
            new { Code = "entrevista", Title = "Entrevista - Analista de Qualidade", Candidate = "Carlos Lima", Vaga = "Assistente de Qualidade", VagaCode = "VAG-QUA-004", Owner = "Ana (RH)", Location = "Google Meet" },
            new { Code = "entrevista", Title = "Entrevista - Operador de Producao", Candidate = "Marina Souza", Vaga = "Operador de Producao (Linha)", VagaCode = "VAG-OPS-002", Owner = "Joao (RH)", Location = "Sala 2" },
            new { Code = "reuniao", Title = "Reuniao com gestor requisitante", Candidate = "Fernanda Rocha", Vaga = "Tecnico de Manutencao", VagaCode = "VAG-ENG-001", Owner = "Diego (RH)", Location = "Teams" },
            new { Code = "assessment", Title = "Assessment tecnico", Candidate = "Juliana Martins", Vaga = "Tecnico de P&D", VagaCode = "VAG-PDI-003", Owner = "Bruno (RH)", Location = "Sala 4" },
            new { Code = "followup", Title = "Follow-up de documentacao", Candidate = "Rafael Pereira", Vaga = "Executivo de Vendas", VagaCode = "VAG-COM-001", Owner = "Paula (RH)", Location = "Email" },
            new { Code = "onboarding", Title = "Onboarding - novo colaborador", Candidate = "Aline Costa", Vaga = "Analista de Dados (BI)", VagaCode = "VAG-TEC-002", Owner = "Marina (RH)", Location = "Sala 1" },
            new { Code = "reuniao", Title = "Reuniao de alinhamento", Candidate = "Bruno Alves", Vaga = "Analista de Logistica", VagaCode = "VAG-SCM-003", Owner = "Fernanda (RH)", Location = "Teams" },
            new { Code = "entrevista", Title = "Entrevista - Administrativo", Candidate = "Paula Santos", Vaga = "Assistente Administrativo", VagaCode = "VAG-ADM-001", Owner = "Carlos (RH)", Location = "Sala 3" },
            new { Code = "outro", Title = "Contato inicial com candidato", Candidate = "Diego Oliveira", Vaga = "Analista Financeiro", VagaCode = "VAG-FIN-002", Owner = "Aline (RH)", Location = "Ligacao" },
            new { Code = "assessment", Title = "Teste comportamental", Candidate = "Joao Mendes", Vaga = "Assistente Administrativo (Planta)", VagaCode = "VAG-ADM-002", Owner = "Juliana (RH)", Location = "Online" }
        };

        var events = new List<AgendaEvent>();
        for (var i = 0; i < seeds.Length; i++)
        {
            var seed = seeds[i];
            if (!types.TryGetValue(seed.Code, out var typeId)) continue;

            var start = now.Date.AddDays(i - 3).AddHours(9 + (i % 5));
            var end = start.AddMinutes(30 + (i % 3) * 15);

            events.Add(new AgendaEvent
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                TypeId = typeId,
                Title = seed.Title,
                StartAtUtc = DateTime.SpecifyKind(start, DateTimeKind.Utc),
                EndAtUtc = DateTime.SpecifyKind(end, DateTimeKind.Utc),
                AllDay = false,
                Status = "confirmado",
                Location = seed.Location,
                Owner = seed.Owner,
                Candidate = seed.Candidate,
                VagaTitle = seed.Vaga,
                VagaCode = seed.VagaCode,
                Notes = "Evento gerado no seed para validacao.",
                CreatedAtUtc = DateTimeOffset.UtcNow,
                UpdatedAtUtc = DateTimeOffset.UtcNow
            });
        }

        if (events.Count > 0)
        {
            db.AgendaEvents.AddRange(events);
            await db.SaveChangesAsync(ct);
        }
    }
}
