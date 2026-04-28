using Microsoft.EntityFrameworkCore;
using Moq;
using RhPortal.Api.Application.Metas;
using RhPortal.Api.Contracts.Metas;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using Xunit;

namespace RhPortal.Api.Tests.Metas;

/// <summary>Cobertura da Entrega 1.6 (Fase 1 — Paridade Feedz): OKR cascateado + check-ins.</summary>
public sealed class MetaServiceCascataTests
{
    private const string TenantId = "tenant-meta";

    private static (AppDbContext Db, MetaService Svc) Create()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var t = new Mock<ITenantContext>();
        t.Setup(x => x.TenantId).Returns(TenantId);
        var db = new AppDbContext(options, t.Object);
        return (db, new MetaService(db));
    }

    private static async Task<Guid> SeedFunc(AppDbContext db, string name = "F")
    {
        var id = Guid.NewGuid();
        db.Funcionarios.Add(new Funcionario { Id = id, TenantId = TenantId, Name = name, Email = $"f-{id:N}@x.com" });
        await db.SaveChangesAsync();
        return id;
    }

    [Fact]
    public async Task Create_ComParentInvalido_LancaErro()
    {
        var (db, svc) = Create();
        var fid = await SeedFunc(db);
        var req = new MetaCreateRequest(fid, "X", null, 100, "%", null, ParentMetaId: Guid.NewGuid());
        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.CreateAsync(req, fid, default));
    }

    [Fact]
    public async Task Create_ComParentValido_PersisteCascata()
    {
        var (db, svc) = Create();
        var fid = await SeedFunc(db);
        var pai = await svc.CreateAsync(new MetaCreateRequest(fid, "Pai", null, 100, "%", null), fid, default);
        var filho = await svc.CreateAsync(new MetaCreateRequest(fid, "Filho", null, 50, "%", null, ParentMetaId: pai.Id), fid, default);

        Assert.Equal(pai.Id, filho.ParentMetaId);
    }

    [Fact]
    public async Task Tree_SemRoot_RetornaApenasRaizes()
    {
        var (db, svc) = Create();
        var fid = await SeedFunc(db);
        var pai = await svc.CreateAsync(new MetaCreateRequest(fid, "Pai 1", null, 100, "%", null), fid, default);
        await svc.CreateAsync(new MetaCreateRequest(fid, "Pai 2", null, 100, "%", null), fid, default);
        await svc.CreateAsync(new MetaCreateRequest(fid, "Filho de Pai 1", null, 50, "%", null, ParentMetaId: pai.Id), fid, default);

        var raizes = await svc.ListTreeAsync(rootId: null, ct: default);

        Assert.Equal(2, raizes.Count); // Pai 1 e Pai 2 (filho não aparece como raiz)
    }

    [Fact]
    public async Task Tree_ComRoot_RetornaArvoreEspecifica()
    {
        var (db, svc) = Create();
        var fid = await SeedFunc(db);
        var pai = await svc.CreateAsync(new MetaCreateRequest(fid, "Empresa", null, 100, "%", null), fid, default);
        var area = await svc.CreateAsync(new MetaCreateRequest(fid, "Área", null, 100, "%", null, ParentMetaId: pai.Id), fid, default);
        await svc.CreateAsync(new MetaCreateRequest(fid, "Indiv 1", null, 100, "%", null, ParentMetaId: area.Id), fid, default);
        await svc.CreateAsync(new MetaCreateRequest(fid, "Indiv 2", null, 100, "%", null, ParentMetaId: area.Id), fid, default);

        var arvore = await svc.ListTreeAsync(pai.Id, default);
        Assert.Single(arvore);
        Assert.Equal("Empresa", arvore[0].Titulo);
        Assert.Single(arvore[0].Children);
        Assert.Equal(2, arvore[0].Children[0].Children.Count);
    }

    [Fact]
    public async Task AddCheckin_StatusInvalido_LancaErro()
    {
        var (db, svc) = Create();
        var fid = await SeedFunc(db);
        var meta = await svc.CreateAsync(new MetaCreateRequest(fid, "X", null, 100, "%", null), fid, default);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.AddCheckinAsync(meta.Id, new MetaCheckinCreateRequest(Status: 0), fid, default));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.AddCheckinAsync(meta.Id, new MetaCheckinCreateRequest(Status: 4), fid, default));
    }

    [Fact]
    public async Task AddCheckin_MetaInexistente_LancaErro()
    {
        var (db, svc) = Create();
        var fid = await SeedFunc(db);
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.AddCheckinAsync(Guid.NewGuid(), new MetaCheckinCreateRequest(Status: 1), fid, default));
    }

    [Fact]
    public async Task AddCheckin_ComValorAtual_AtualizaMeta()
    {
        var (db, svc) = Create();
        var fid = await SeedFunc(db);
        var meta = await svc.CreateAsync(new MetaCreateRequest(fid, "X", null, 100, "%", null), fid, default);

        await svc.AddCheckinAsync(meta.Id, new MetaCheckinCreateRequest(
            Status: 1, ValorAtual: 35m, Comentario: "Indo bem"), fid, default);

        var atualizada = await svc.GetByIdAsync(meta.Id, default);
        Assert.NotNull(atualizada);
        Assert.Equal(35m, atualizada!.ValorAtual);
    }

    [Fact]
    public async Task AddCheckin_ValorAtinge100_FechaMetaComoConcluida()
    {
        var (db, svc) = Create();
        var fid = await SeedFunc(db);
        var meta = await svc.CreateAsync(new MetaCreateRequest(fid, "X", null, 100, "%", null), fid, default);

        await svc.AddCheckinAsync(meta.Id, new MetaCheckinCreateRequest(Status: 1, ValorAtual: 100m), fid, default);

        var atualizada = await svc.GetByIdAsync(meta.Id, default);
        Assert.NotNull(atualizada);
        Assert.Equal(RhPortal.Api.Domain.Enums.MetaStatus.Concluida, atualizada!.Status);
    }

    [Fact]
    public async Task ListCheckins_OrdenaPorMaisRecentePrimeiro()
    {
        var (db, svc) = Create();
        var fid = await SeedFunc(db);
        var meta = await svc.CreateAsync(new MetaCreateRequest(fid, "X", null, 100, "%", null), fid, default);

        await svc.AddCheckinAsync(meta.Id, new MetaCheckinCreateRequest(Status: 1, Comentario: "Sem 1"), fid, default);
        await Task.Delay(10); // garante CriadoEmUtc diferente
        await svc.AddCheckinAsync(meta.Id, new MetaCheckinCreateRequest(Status: 2, Comentario: "Sem 2"), fid, default);
        await Task.Delay(10);
        await svc.AddCheckinAsync(meta.Id, new MetaCheckinCreateRequest(Status: 3, Comentario: "Sem 3"), fid, default);

        var lista = await svc.ListCheckinsAsync(meta.Id, default);
        Assert.Equal(3, lista.Count);
        Assert.Equal(3, lista[0].Status); // mais recente primeiro
        Assert.Equal(2, lista[1].Status);
        Assert.Equal(1, lista[2].Status);
    }

    [Fact]
    public async Task GetById_RetornaUltimoCheckin()
    {
        var (db, svc) = Create();
        var fid = await SeedFunc(db);
        var meta = await svc.CreateAsync(new MetaCreateRequest(fid, "X", null, 100, "%", null), fid, default);

        await svc.AddCheckinAsync(meta.Id, new MetaCheckinCreateRequest(Status: 2, Comentario: "amarelo"), fid, default);

        // Listagem via tree pega o último checkin
        var arvore = await svc.ListTreeAsync(meta.Id, default);
        Assert.Single(arvore);
        Assert.Equal(2, arvore[0].UltimoCheckinStatus);
    }

    [Fact]
    public async Task Tree_3Niveis_AgregaCorretamente()
    {
        // Empresa → 2 áreas → cada uma com 2 individuais
        var (db, svc) = Create();
        var fid = await SeedFunc(db);

        var emp = await svc.CreateAsync(new MetaCreateRequest(fid, "Empresa Crescer 30%", null, 30, "%", null), fid, default);
        var areaA = await svc.CreateAsync(new MetaCreateRequest(fid, "Área Vendas", null, 50, "%", null, ParentMetaId: emp.Id), fid, default);
        var areaB = await svc.CreateAsync(new MetaCreateRequest(fid, "Área Marketing", null, 25, "%", null, ParentMetaId: emp.Id), fid, default);
        await svc.CreateAsync(new MetaCreateRequest(fid, "Vendedor 1", null, 20, "%", null, ParentMetaId: areaA.Id), fid, default);
        await svc.CreateAsync(new MetaCreateRequest(fid, "Vendedor 2", null, 20, "%", null, ParentMetaId: areaA.Id), fid, default);
        await svc.CreateAsync(new MetaCreateRequest(fid, "Mkt 1", null, 10, "%", null, ParentMetaId: areaB.Id), fid, default);

        var arvore = await svc.ListTreeAsync(emp.Id, default);
        Assert.Single(arvore);
        var raiz = arvore[0];
        Assert.Equal("Empresa Crescer 30%", raiz.Titulo);
        Assert.Equal(2, raiz.Children.Count);
        var vendas = raiz.Children.First(c => c.Titulo == "Área Vendas");
        Assert.Equal(2, vendas.Children.Count);
        var mkt = raiz.Children.First(c => c.Titulo == "Área Marketing");
        Assert.Single(mkt.Children);
    }
}
