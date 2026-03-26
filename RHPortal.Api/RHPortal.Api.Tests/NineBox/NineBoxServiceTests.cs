using Microsoft.EntityFrameworkCore;
using Moq;
using RhPortal.Api.Application.NineBox;
using RhPortal.Api.Contracts.NineBox;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using Xunit;

namespace RhPortal.Api.Tests.NineBox;

public sealed class NineBoxServiceTests
{
    private const string TenantId = "test-tenant";

    private static (AppDbContext Db, NineBoxService Service) CreateService()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantId);

        var db = new AppDbContext(options, tenantMock.Object);
        var service = new NineBoxService(db, tenantMock.Object);
        return (db, service);
    }

    private static async Task<Guid> SeedFuncionarioAsync(AppDbContext db, string name = "Funcionário Teste")
    {
        var id = Guid.NewGuid();
        db.Funcionarios.Add(new Funcionario
        {
            Id = id,
            TenantId = TenantId,
            Name = name,
            Email = $"func-{id:N}@test.local",
        });
        await db.SaveChangesAsync();
        return id;
    }

    private static async Task<Guid> SeedAvaliadorAsync(AppDbContext db)
    {
        var id = Guid.NewGuid();
        db.Funcionarios.Add(new Funcionario
        {
            Id = id,
            TenantId = TenantId,
            Name = "Avaliador Teste",
            Email = $"aval-{id:N}@test.local",
        });
        await db.SaveChangesAsync();
        return id;
    }

    // ── UpsertAsync ────────────────────────────────────────────────────

    [Fact]
    public async Task UpsertAsync_CriaNovoPosicionamento_QuandoFuncionarioExiste()
    {
        var (db, service) = CreateService();
        var funcId = await SeedFuncionarioAsync(db);
        var avalId = await SeedAvaliadorAsync(db);

        var req = new NineBoxUpsertRequest(funcId, Desempenho: 3, Potencial: 2, Observacoes: "Ótimo desempenho");

        var result = await service.UpsertAsync(req, avalId, CancellationToken.None);

        Assert.Equal(funcId, result.FuncionarioId);
        Assert.Equal(avalId, result.AvaliadorId);
        Assert.Equal(3, result.Desempenho);
        Assert.Equal(2, result.Potencial);
        Assert.Equal("Ótimo desempenho", result.Observacoes);
        Assert.True(result.Id != Guid.Empty);
    }

    [Fact]
    public async Task UpsertAsync_LancaExcecao_QuandoFuncionarioNaoExiste()
    {
        var (db, service) = CreateService();
        var avalId = await SeedAvaliadorAsync(db);
        var funcIdInexistente = Guid.NewGuid();

        var req = new NineBoxUpsertRequest(funcIdInexistente, Desempenho: 2, Potencial: 2, Observacoes: null);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.UpsertAsync(req, avalId, CancellationToken.None));
    }

    [Theory]
    [InlineData(0, 2, 1, 2)]  // desempenho 0 → clamp para 1
    [InlineData(5, 2, 3, 2)]  // desempenho 5 → clamp para 3
    [InlineData(2, 0, 2, 1)]  // potencial 0  → clamp para 1
    [InlineData(2, 9, 2, 3)]  // potencial 9  → clamp para 3
    public async Task UpsertAsync_ClampValores_QuandoForaDaFaixa(
        int desempenhoInput, int potencialInput,
        int desempenhoEsperado, int potencialEsperado)
    {
        var (db, service) = CreateService();
        var funcId = await SeedFuncionarioAsync(db);
        var avalId = await SeedAvaliadorAsync(db);

        var req = new NineBoxUpsertRequest(funcId, desempenhoInput, potencialInput, null);
        var result = await service.UpsertAsync(req, avalId, CancellationToken.None);

        Assert.Equal(desempenhoEsperado, result.Desempenho);
        Assert.Equal(potencialEsperado, result.Potencial);
    }

    [Fact]
    public async Task UpsertAsync_SempreAdicionaNovoRegistroHistorico()
    {
        var (db, service) = CreateService();
        var funcId = await SeedFuncionarioAsync(db);
        var avalId = await SeedAvaliadorAsync(db);

        var req1 = new NineBoxUpsertRequest(funcId, 1, 1, "Primeira avaliação");
        var req2 = new NineBoxUpsertRequest(funcId, 3, 3, "Segunda avaliação");

        await service.UpsertAsync(req1, avalId, CancellationToken.None);
        await service.UpsertAsync(req2, avalId, CancellationToken.None);

        var total = await db.NineBoxAssessments
            .Where(a => a.FuncionarioId == funcId)
            .CountAsync();

        Assert.Equal(2, total); // histórico preservado — ambas devem existir
    }

    // ── GetByFuncionarioAsync ──────────────────────────────────────────

    [Fact]
    public async Task GetByFuncionarioAsync_RetornaNull_QuandoSemAvaliacao()
    {
        var (db, service) = CreateService();
        var funcId = await SeedFuncionarioAsync(db);

        var result = await service.GetByFuncionarioAsync(funcId, CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task GetByFuncionarioAsync_RetornaMaisRecente_QuandoMultiplasAvaliacoes()
    {
        var (db, service) = CreateService();
        var funcId = await SeedFuncionarioAsync(db);
        var avalId = await SeedAvaliadorAsync(db);

        // Primeira avaliação — quadrante inferior
        db.NineBoxAssessments.Add(new NineBoxAssessment
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            FuncionarioId = funcId,
            AvaliadorId = avalId,
            Desempenho = 1,
            Potencial = 1,
            CriadoEmUtc = DateTimeOffset.UtcNow.AddDays(-10),
            AtualizadoEmUtc = DateTimeOffset.UtcNow.AddDays(-10),
        });

        // Segunda avaliação — quadrante estrela
        db.NineBoxAssessments.Add(new NineBoxAssessment
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            FuncionarioId = funcId,
            AvaliadorId = avalId,
            Desempenho = 3,
            Potencial = 3,
            CriadoEmUtc = DateTimeOffset.UtcNow,
            AtualizadoEmUtc = DateTimeOffset.UtcNow,
        });

        await db.SaveChangesAsync();

        var result = await service.GetByFuncionarioAsync(funcId, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(3, result!.Desempenho); // deve retornar a mais recente (Estrela)
        Assert.Equal(3, result.Potencial);
    }

    // ── ListMatrizAsync ────────────────────────────────────────────────

    [Fact]
    public async Task ListMatrizAsync_RetornaListaVazia_QuandoNenhumPosicionado()
    {
        var (_, service) = CreateService();

        var result = await service.ListMatrizAsync(CancellationToken.None);

        Assert.Empty(result);
    }

    [Fact]
    public async Task ListMatrizAsync_RetornaUmItemPorFuncionario_QuandoMultiplasAvaliacoes()
    {
        var (db, service) = CreateService();
        var func1Id = await SeedFuncionarioAsync(db, "Func 1");
        var func2Id = await SeedFuncionarioAsync(db, "Func 2");
        var avalId = await SeedAvaliadorAsync(db);

        // Func 1: 2 avaliações
        for (var i = 0; i < 2; i++)
        {
            db.NineBoxAssessments.Add(new NineBoxAssessment
            {
                Id = Guid.NewGuid(),
                TenantId = TenantId,
                FuncionarioId = func1Id,
                AvaliadorId = avalId,
                Desempenho = i + 1,
                Potencial = i + 1,
                CriadoEmUtc = DateTimeOffset.UtcNow.AddDays(-i),
                AtualizadoEmUtc = DateTimeOffset.UtcNow.AddDays(-i),
            });
        }

        // Func 2: 1 avaliação
        db.NineBoxAssessments.Add(new NineBoxAssessment
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            FuncionarioId = func2Id,
            AvaliadorId = avalId,
            Desempenho = 2,
            Potencial = 3,
            CriadoEmUtc = DateTimeOffset.UtcNow,
            AtualizadoEmUtc = DateTimeOffset.UtcNow,
        });

        await db.SaveChangesAsync();

        var result = await service.ListMatrizAsync(CancellationToken.None);

        Assert.Equal(2, result.Count); // um item por funcionário
        Assert.All(result, item => Assert.NotNull(item.FuncionarioNome));
    }
}
