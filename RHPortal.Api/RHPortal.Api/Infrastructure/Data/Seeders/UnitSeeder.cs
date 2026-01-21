using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

public static class UnitSeeder
{
    public static async Task EnsureAsync(AppDbContext db, CancellationToken ct)
    {
        var hasAnyUnit = await db.Units.AnyAsync(ct);
        if (hasAnyUnit)
            return;

        db.Units.AddRange(
            new Unit
            {
                Id = Guid.NewGuid(),
                Code = "UNI-EMB",
                Name = "Embu das Artes - SP",
                Status = UnitStatus.Active,
                City = "Embu das Artes",
                Uf = "SP",
                AddressLine = "Rua Exemplo, 100",
                Neighborhood = "Industrial",
                ZipCode = "06800-000",
                Email = "embu@liotecnica.com.br",
                Phone = "(11) 4001-1001",
                ResponsibleName = "Responsavel EMB",
                Type = "Industria / Matriz",
                Headcount = 420,
                Notes = "Unidade principal."
            },
            new Unit
            {
                Id = Guid.NewGuid(),
                Code = "UNI-SPC",
                Name = "Sao Paulo - SP",
                Status = UnitStatus.Active,
                City = "Sao Paulo",
                Uf = "SP",
                Email = "sp@liotecnica.com.br",
                Phone = "(11) 4001-1002",
                ResponsibleName = "Responsavel SPC",
                Type = "Escritorio / Administrativo",
                Headcount = 180,
                Notes = "Unidade administrativa."
            }
        );

        await db.SaveChangesAsync(ct);
    }
}
