using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

public static class ManagerSeeder
{
    public static async Task EnsureAsync(AppDbContext db, CancellationToken ct)
    {
        var hasAnyManager = await db.Managers.AnyAsync(ct);
        if (hasAnyManager)
            return;

        var units = await db.Units.AsNoTracking().ToListAsync(ct);
        var areas = await db.Areas.AsNoTracking().ToListAsync(ct);
        var cargos = await db.JobPositions.AsNoTracking().ToListAsync(ct);

        if (units.Count == 0 || areas.Count == 0 || cargos.Count == 0)
            return;

        Guid PickArea(string code) => areas.First(a => a.Code == code).Id;

        Guid PickCargoByArea(string areaCode)
        {
            var areaId = PickArea(areaCode);
            return cargos.First(c => c.AreaId == areaId).Id;
        }

        var rng = new Random(42);
        var shuffledUnits = units.OrderBy(_ => rng.Next()).ToList();

        Guid PickRandomUnitId(int index)
            => shuffledUnits[index % shuffledUnits.Count].Id;

        var seed = new[]
        {
            new { Name="Marina Souza",   Email="marina.souza@empresa.com",   Phone="(11) 90000-0001", Area="OPS", Headcount = 5 },
            new { Name="Carlos Lima",    Email="carlos.lima@empresa.com",    Phone="(11) 90000-0002", Area="QUA", Headcount = 7 },
            new { Name="Fernanda Rocha", Email="fernanda.rocha@empresa.com", Phone="(11) 90000-0003", Area="ENG", Headcount = 4 },
            new { Name="Bruno Alves",    Email="bruno.alves@empresa.com",    Phone="(11) 90000-0004", Area="SCM", Headcount = 8 },
            new { Name="Juliana Martins",Email="juliana.martins@empresa.com",Phone="(11) 90000-0005", Area="PDI", Headcount = 23 },
            new { Name="Rafael Pereira", Email="rafael.pereira@empresa.com", Phone="(11) 90000-0006", Area="COM", Headcount = 14 },
            new { Name="Paula Santos",   Email="paula.santos@empresa.com",   Phone="(11) 90000-0007", Area="RH",  Headcount = 4 },
            new { Name="Diego Oliveira", Email="diego.oliveira@empresa.com", Phone="(11) 90000-0008", Area="FIN", Headcount = 2 },
            new { Name="Aline Costa",    Email="aline.costa@empresa.com",    Phone="(11) 90000-0009", Area="TEC", Headcount = 9 },
            new { Name="Joao Mendes",    Email="joao.mendes@empresa.com",    Phone="(11) 90000-0010", Area="ADM", Headcount = 11 },
        };

        for (var i = 0; i < seed.Length; i++)
        {
            var s = seed[i];
            var areaId = PickArea(s.Area);
            var cargoId = PickCargoByArea(s.Area);
            var unitId = PickRandomUnitId(i);

            db.Managers.Add(new Manager
            {
                Id = Guid.NewGuid(),
                Name = s.Name,
                Email = s.Email,
                Phone = s.Phone,
                Status = ManagerStatus.Active,
                UnitId = unitId,
                AreaId = areaId,
                Headcount = s.Headcount,
                JobPositionId = cargoId,
                Notes = "Seed inicial de gestor"
            });
        }

        await db.SaveChangesAsync(ct);
    }
}
