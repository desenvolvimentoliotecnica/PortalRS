using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Owner;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Modules;
using Xunit;

namespace RhPortal.Api.Tests.Modules;

/// <summary>
/// Testes do TenantPackageService — List/Set/EnsureDefaults/GetEnabledKeys.
/// Garante que pacotes com IsActive=false no catálogo (ex.: folha-pagamento)
/// são ignorados em todas as operações — não aparecem, não são semeados,
/// não podem ser ligados e nunca entram no conjunto de pacotes efetivos.
/// </summary>
public sealed class TenantPackageServiceTests
{
    private const string TenantA = "empresa-a";
    private const string TenantB = "empresa-b";
    private const string ActivePackage = "recrutamento-selecao";
    private const string InactivePackage = "folha-pagamento";

    private static (MasterDbContext Db, TenantPackageService Service) CriarServico()
    {
        var options = new DbContextOptionsBuilder<MasterDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var db = new MasterDbContext(options);
        var service = new TenantPackageService(db);
        return (db, service);
    }

    private static int ActiveCatalogCount =>
        PackageCatalog.All.Count(p => p.IsActive);

    // ── ListAsync ──

    [Fact]
    public async Task List_SemRegistros_RetornaApenasAtivosHabilitados()
    {
        var (_, svc) = CriarServico();

        var list = await svc.ListAsync(TenantA, CancellationToken.None);

        Assert.Equal(ActiveCatalogCount, list.Count);
        Assert.All(list, p => Assert.True(p.IsActive));
        Assert.All(list, p => Assert.True(p.IsEnabled));
        Assert.All(list, p => Assert.Null(p.UpdatedAtUtc));
        Assert.All(list, p => Assert.Null(p.UpdatedByOwnerId));
    }

    [Fact]
    public async Task List_NaoRetornaPacoteInativoDoCatalogo()
    {
        var (_, svc) = CriarServico();

        var list = await svc.ListAsync(TenantA, CancellationToken.None);

        Assert.DoesNotContain(list, p => string.Equals(p.Key, InactivePackage, StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task List_ComRegistroDesabilitado_RefleteStatus()
    {
        var (db, svc) = CriarServico();
        db.TenantPackages.Add(new TenantPackage
        {
            Id = Guid.NewGuid(),
            TenantId = TenantA,
            PackageKey = ActivePackage,
            IsEnabled = false,
            UpdatedAtUtc = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var list = await svc.ListAsync(TenantA, CancellationToken.None);

        var row = list.Single(p => p.Key == ActivePackage);
        Assert.False(row.IsEnabled);
    }

    [Fact]
    public async Task List_IgnoraRegistrosDeOutroTenant()
    {
        var (db, svc) = CriarServico();
        db.TenantPackages.Add(new TenantPackage
        {
            Id = Guid.NewGuid(),
            TenantId = TenantB,
            PackageKey = ActivePackage,
            IsEnabled = false,
            UpdatedAtUtc = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var list = await svc.ListAsync(TenantA, CancellationToken.None);

        Assert.True(list.Single(p => p.Key == ActivePackage).IsEnabled);
    }

    // ── SetEnabledAsync ──

    [Fact]
    public async Task Set_PacoteInexistente_RetornaNull()
    {
        var (_, svc) = CriarServico();

        var result = await svc.SetEnabledAsync(TenantA, "pacote-que-nao-existe", true, null, CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task Set_LigarPacoteInativo_LancaInvalidOperation()
    {
        var (_, svc) = CriarServico();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.SetEnabledAsync(TenantA, InactivePackage, true, null, CancellationToken.None));

        Assert.Contains(InactivePackage, ex.Message);
    }

    [Fact]
    public async Task Set_DesligarPacoteInativo_Permitido()
    {
        // Cenário defensivo: não precisa fazer sentido de negócio, mas não
        // deve explodir. A UI nem sequer mostra o pacote inativo.
        var (_, svc) = CriarServico();

        var result = await svc.SetEnabledAsync(TenantA, InactivePackage, false, null, CancellationToken.None);

        Assert.NotNull(result);
        Assert.False(result!.IsEnabled);
        Assert.False(result.IsActive);
    }

    [Fact]
    public async Task Set_PrimeiraVez_CriaRegistroComOwnerId()
    {
        var (db, svc) = CriarServico();
        var ownerId = Guid.NewGuid();

        var result = await svc.SetEnabledAsync(TenantA, ActivePackage, false, ownerId, CancellationToken.None);

        Assert.NotNull(result);
        Assert.False(result!.IsEnabled);
        Assert.Equal(ownerId, result.UpdatedByOwnerId);
        Assert.NotNull(result.UpdatedAtUtc);

        var row = await db.TenantPackages.SingleAsync(x => x.TenantId == TenantA && x.PackageKey == ActivePackage);
        Assert.False(row.IsEnabled);
        Assert.Equal(ownerId, row.UpdatedByOwnerId);
    }

    [Fact]
    public async Task Set_SegundaVez_AtualizaRegistroExistente()
    {
        var (db, svc) = CriarServico();
        var ownerA = Guid.NewGuid();
        var ownerB = Guid.NewGuid();

        await svc.SetEnabledAsync(TenantA, ActivePackage, false, ownerA, CancellationToken.None);
        await svc.SetEnabledAsync(TenantA, ActivePackage, true, ownerB, CancellationToken.None);

        var count = await db.TenantPackages.CountAsync(x => x.TenantId == TenantA && x.PackageKey == ActivePackage);
        Assert.Equal(1, count);

        var row = await db.TenantPackages.SingleAsync(x => x.TenantId == TenantA && x.PackageKey == ActivePackage);
        Assert.True(row.IsEnabled);
        Assert.Equal(ownerB, row.UpdatedByOwnerId);
    }

    [Fact]
    public async Task Set_IsolamentoPorTenant()
    {
        var (db, svc) = CriarServico();

        await svc.SetEnabledAsync(TenantA, ActivePackage, false, null, CancellationToken.None);

        var listB = await svc.ListAsync(TenantB, CancellationToken.None);
        Assert.True(listB.Single(p => p.Key == ActivePackage).IsEnabled);

        Assert.Equal(1, await db.TenantPackages.CountAsync());
    }

    // ── EnsureDefaultsAsync ──

    [Fact]
    public async Task EnsureDefaults_TenantNovo_CriaApenasParaPacotesAtivos()
    {
        var (db, svc) = CriarServico();

        await svc.EnsureDefaultsAsync(TenantA, CancellationToken.None);

        var rows = await db.TenantPackages.Where(x => x.TenantId == TenantA).ToListAsync();
        Assert.Equal(ActiveCatalogCount, rows.Count);
        Assert.All(rows, r => Assert.True(r.IsEnabled));
        Assert.DoesNotContain(rows, r => string.Equals(r.PackageKey, InactivePackage, StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task EnsureDefaults_ComRegistroExistente_NaoSobrescreve()
    {
        var (db, svc) = CriarServico();

        await svc.SetEnabledAsync(TenantA, ActivePackage, false, null, CancellationToken.None);

        await svc.EnsureDefaultsAsync(TenantA, CancellationToken.None);

        var row = await db.TenantPackages.SingleAsync(x => x.TenantId == TenantA && x.PackageKey == ActivePackage);
        Assert.False(row.IsEnabled);
    }

    [Fact]
    public async Task EnsureDefaults_Idempotente()
    {
        var (db, svc) = CriarServico();

        await svc.EnsureDefaultsAsync(TenantA, CancellationToken.None);
        await svc.EnsureDefaultsAsync(TenantA, CancellationToken.None);
        await svc.EnsureDefaultsAsync(TenantA, CancellationToken.None);

        var count = await db.TenantPackages.CountAsync(x => x.TenantId == TenantA);
        Assert.Equal(ActiveCatalogCount, count);
    }

    // ── GetEnabledPackageKeysAsync ──

    [Fact]
    public async Task GetEnabled_SemRegistros_RetornaApenasAtivos()
    {
        var (_, svc) = CriarServico();

        var enabled = await svc.GetEnabledPackageKeysAsync(TenantA, CancellationToken.None);

        Assert.Equal(ActiveCatalogCount, enabled.Count);
        foreach (var p in PackageCatalog.All.Where(p => p.IsActive))
            Assert.Contains(p.Key, enabled);
        Assert.DoesNotContain(InactivePackage, enabled);
    }

    [Fact]
    public async Task GetEnabled_ComPacoteDesabilitado_ExcluiDoSet()
    {
        var (_, svc) = CriarServico();
        await svc.SetEnabledAsync(TenantA, ActivePackage, false, null, CancellationToken.None);

        var enabled = await svc.GetEnabledPackageKeysAsync(TenantA, CancellationToken.None);

        Assert.DoesNotContain(ActivePackage, enabled);
    }

    [Fact]
    public async Task GetEnabled_IgnoraPacoteInativoMesmoComRegistroHabilitado()
    {
        // Se alguém semear direto no banco (burlando o Set), o pacote inativo
        // não pode vazar pro set efetivo de pacotes ligados.
        var (db, svc) = CriarServico();
        db.TenantPackages.Add(new TenantPackage
        {
            Id = Guid.NewGuid(),
            TenantId = TenantA,
            PackageKey = InactivePackage,
            IsEnabled = true,
            UpdatedAtUtc = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var enabled = await svc.GetEnabledPackageKeysAsync(TenantA, CancellationToken.None);

        Assert.DoesNotContain(InactivePackage, enabled);
    }

    [Fact]
    public async Task GetEnabled_EHashSetCaseInsensitive()
    {
        var (_, svc) = CriarServico();

        var enabled = await svc.GetEnabledPackageKeysAsync(TenantA, CancellationToken.None);

        Assert.Contains(ActivePackage, enabled);
        Assert.Contains(ActivePackage.ToUpperInvariant(), enabled);
        Assert.Contains("Recrutamento-Selecao", enabled);
    }
}
