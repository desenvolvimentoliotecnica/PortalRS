using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

/// <summary>
/// 6 recompensas seed para o catálogo Render Coins (Entrega 1.8 — Fase 1 Paridade Feedz).
/// Cobertura: bem-estar, carreira, voucher, solidariedade.
/// </summary>
public static class RenderCoinRewardSeeder
{
    public const string CodDayOff       = "DayOff";
    public const string CodVoucher50    = "Voucher50";
    public const string CodCurso        = "Curso";
    public const string CodMassagem     = "Massagem";
    public const string CodDoacao       = "Doacao";
    public const string CodCafeMimo     = "CafeMimo";

    private sealed record Seed(string Codigo, string Nome, string Descricao, string Categoria,
        decimal Custo, int? Estoque, int Ordem);

    private static readonly Seed[] Seeds =
    [
        new(CodCafeMimo, "Café com Mimo (R$ 30)",
            "Vale-café personalizado de R$ 30 numa cafeteria parceira. Útil pra dia de home-office com sabor.",
            "Voucher", 100, null, 10),

        new(CodMassagem, "Sessão de Massagem (45 min)",
            "1h de massagem relaxante numa clínica parceira. Cuidado merecido depois de uma entrega pesada.",
            "Bem-estar", 250, 5, 20),

        new(CodVoucher50, "Voucher iFood R$ 50",
            "Voucher digital iFood de R$ 50 — pra um almoço bom no fim de uma semana corrida.",
            "Voucher", 200, 10, 30),

        new(CodDayOff, "Day-Off Surpresa",
            "1 dia de folga remunerado, agendável com 5 dias de antecedência. Para usar quando precisar respirar.",
            "Bem-estar", 800, 3, 40),

        new(CodCurso, "Curso Online (até R$ 200)",
            "Reembolso de curso online de sua escolha (Alura, Udemy, Coursera) até R$ 200. Investimento na carreira.",
            "Carreira", 500, null, 50),

        new(CodDoacao, "Doação para ONG Parceira (R$ 100)",
            "A empresa doa R$ 100 em seu nome para uma ONG parceira. O reconhecimento que vira impacto social.",
            "Solidariedade", 300, null, 60),
    ];

    public static async Task EnsureAsync(AppDbContext db, string tenantId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            throw new InvalidOperationException("RenderCoinRewardSeeder requer um tenantId.");

        var existing = await db.RenderCoinRewards
            .IgnoreQueryFilters().AsNoTracking()
            .Where(r => r.TenantId == tenantId)
            .Select(r => r.Codigo)
            .ToListAsync(ct);
        var existingSet = existing.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var now = DateTimeOffset.UtcNow;

        foreach (var s in Seeds)
        {
            if (existingSet.Contains(s.Codigo)) continue;

            db.RenderCoinRewards.Add(new RenderCoinReward
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Codigo = s.Codigo,
                Nome = s.Nome,
                Descricao = s.Descricao,
                Categoria = s.Categoria,
                CustoCoins = s.Custo,
                EstoqueDisponivel = s.Estoque,
                IsSystem = true,
                IsActive = true,
                Ordem = s.Ordem,
                CriadoEmUtc = now,
                AtualizadoEmUtc = now,
            });
        }

        await db.SaveChangesAsync(ct);
    }
}
