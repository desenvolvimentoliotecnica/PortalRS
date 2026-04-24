using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

/// <summary>
/// Seed de Centros de Custo (CC) padrão para cada tenant novo.
///
/// Consolidação Sessão 31.2: substitui o antigo <c>AreaDepartmentSeeder</c>.
/// O cadastro unificado de CentroCusto absorve o que antes eram Area + Department,
/// então este seeder popula a estrutura organizacional mínima que outros seeders
/// (JobPositionSeeder, VagaSeeder, CandidatoSeeder, AgendaEventSeeder) esperam
/// encontrar por <see cref="CentroCusto.Code"/>.
///
/// Idempotente: verifica por <c>Code</c> antes de inserir.
/// </summary>
public static class CentroCustoSeeder
{
    private static readonly (string Code, string Description, int Headcount, string? BranchOrLocation)[] DefaultCentros = new[]
    {
        ("OPS", "Operacoes",                        420, "Embu das Artes - SP"),
        ("QUA", "Qualidade & Seguranca de Alimentos",  65, "Embu das Artes - SP"),
        ("ENG", "Engenharia & Manutencao",            80, "Embu das Artes - SP"),
        ("SCM", "Supply Chain",                       55, "Embu das Artes - SP"),
        ("PDI", "Pesquisa & Desenvolvimento",         25, "Sao Paulo - SP"),
        ("COM", "Comercial & Marketing",              40, "Sao Paulo - SP"),
        ("TEC", "Tecnologia da Informacao",           18, "Sao Paulo - SP"),
        ("FIN", "Financeiro",                         22, "Sao Paulo - SP"),
        ("RH",  "Recursos Humanos",                   15, "Sao Paulo - SP"),
        ("ADM", "Administrativo",                     12, "Embu das Artes - SP"),
    };

    public static async Task EnsureAsync(AppDbContext db, CancellationToken ct)
    {
        var existingCodes = await db.CentrosCusto
            .AsNoTracking()
            .Select(c => c.Code)
            .ToListAsync(ct);

        var existingSet = existingCodes.ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var (code, description, headcount, branch) in DefaultCentros)
        {
            if (existingSet.Contains(code))
                continue;

            db.CentrosCusto.Add(new CentroCusto
            {
                Id = Guid.NewGuid(),
                Code = code,
                Description = description,
                Headcount = headcount,
                BranchOrLocation = branch,
                IsActive = true,
                CreatedAtUtc = DateTimeOffset.UtcNow,
                UpdatedAtUtc = DateTimeOffset.UtcNow,
            });
            existingSet.Add(code);
        }

        await db.SaveChangesAsync(ct);
    }
}
