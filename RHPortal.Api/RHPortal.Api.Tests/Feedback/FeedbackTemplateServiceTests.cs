using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RhPortal.Api.Application.Feedback;
using RhPortal.Api.Contracts.Feedback;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Data.Seeders;
using RhPortal.Api.Infrastructure.Tenancy;
using Xunit;

namespace RhPortal.Api.Tests.Feedback;

/// <summary>
/// Cobertura da Entrega 1.3 (Fase 1 — Paridade Feedz): templates de feedback.
/// </summary>
public sealed class FeedbackTemplateServiceTests
{
    private const string TenantId = "tenant-fb";

    private static (AppDbContext Db, FeedbackTemplateService Svc) Create()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var tenant = new Mock<ITenantContext>();
        tenant.Setup(x => x.TenantId).Returns(TenantId);
        var db = new AppDbContext(options, tenant.Object);
        var svc = new FeedbackTemplateService(db, tenant.Object, NullLogger<FeedbackTemplateService>.Instance);
        return (db, svc);
    }

    [Fact]
    public async Task Seeder_Cria12TemplatesDeSistema()
    {
        var (db, _) = Create();
        await FeedbackTemplateSeeder.EnsureAsync(db, TenantId, default);

        var ts = await db.FeedbackTemplates.IgnoreQueryFilters()
            .Where(t => t.TenantId == TenantId).ToListAsync();

        Assert.Equal(12, ts.Count);
        Assert.All(ts, t => Assert.True(t.IsSystem));
        Assert.All(ts, t => Assert.True(t.IsActive));
        Assert.All(ts, t => Assert.False(string.IsNullOrWhiteSpace(t.Conteudo)));
    }

    [Fact]
    public async Task Seeder_Idempotente_NaoDuplica()
    {
        var (db, _) = Create();
        await FeedbackTemplateSeeder.EnsureAsync(db, TenantId, default);
        await FeedbackTemplateSeeder.EnsureAsync(db, TenantId, default);

        var count = await db.FeedbackTemplates.IgnoreQueryFilters().CountAsync(t => t.TenantId == TenantId);
        Assert.Equal(12, count);
    }

    [Fact]
    public async Task Seeder_TenantsDiferentes_Isolam()
    {
        var dbName = Guid.NewGuid().ToString();
        AppDbContext NewDb(string t)
        {
            var opts = new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(dbName).Options;
            var tm = new Mock<ITenantContext>(); tm.Setup(x => x.TenantId).Returns(t);
            return new AppDbContext(opts, tm.Object);
        }
        using (var dbA = NewDb(TenantId)) await FeedbackTemplateSeeder.EnsureAsync(dbA, TenantId, default);
        using (var dbB = NewDb("outro")) await FeedbackTemplateSeeder.EnsureAsync(dbB, "outro", default);

        using var r = NewDb(TenantId);
        Assert.Equal(12, await r.FeedbackTemplates.IgnoreQueryFilters().CountAsync(t => t.TenantId == TenantId));
        Assert.Equal(12, await r.FeedbackTemplates.IgnoreQueryFilters().CountAsync(t => t.TenantId == "outro"));
    }

    [Fact]
    public async Task Seeder_TenantIdInvalido_LancaErro()
    {
        var (db, _) = Create();
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => FeedbackTemplateSeeder.EnsureAsync(db, "", default));
    }

    [Fact]
    public async Task ListAsync_ApenasAtivos_FiltraDesativados()
    {
        var (db, svc) = Create();
        await FeedbackTemplateSeeder.EnsureAsync(db, TenantId, default);

        var first = await db.FeedbackTemplates.IgnoreQueryFilters().FirstAsync();
        first.IsActive = false;
        await db.SaveChangesAsync();

        var ativos = await svc.ListAsync(false, default);
        var todos = await svc.ListAsync(true, default);
        Assert.Equal(11, ativos.Count);
        Assert.Equal(12, todos.Count);
    }

    [Fact]
    public async Task ListAsync_OrdenadoPorOrdem()
    {
        var (db, svc) = Create();
        await FeedbackTemplateSeeder.EnsureAsync(db, TenantId, default);

        var lista = await svc.ListAsync(false, default);
        Assert.Equal(FeedbackTemplateSeeder.CodReconhecimento, lista[0].Codigo);
        Assert.Equal(FeedbackTemplateSeeder.CodMarco, lista[^1].Codigo);
    }

    [Fact]
    public async Task GetAsync_TemplateExistente_RetornaConteudo()
    {
        var (db, svc) = Create();
        await FeedbackTemplateSeeder.EnsureAsync(db, TenantId, default);
        var first = await db.FeedbackTemplates.IgnoreQueryFilters().FirstAsync();

        var r = await svc.GetAsync(first.Id, default);
        Assert.NotNull(r);
        Assert.Equal(first.Codigo, r!.Codigo);
        Assert.Contains("[", r.Conteudo); // tem placeholder
    }

    [Fact]
    public async Task GetAsync_TemplateInexistente_RetornaNull()
    {
        var (_, svc) = Create();
        Assert.Null(await svc.GetAsync(Guid.NewGuid(), default));
    }

    [Fact]
    public async Task CreateAsync_Customizado_CriaComIsSystemFalse()
    {
        var (_, svc) = Create();
        var req = new FeedbackTemplateCreateRequest(
            Codigo: "MeuModelo",
            Nome: "Modelo da empresa",
            Conteudo: "Você fez [coisa]. Continue.",
            Categoria: "Reconhecimento");
        var r = await svc.CreateAsync(req, default);
        Assert.False(r.IsSystem);
        Assert.True(r.IsActive);
        Assert.Equal("MeuModelo", r.Codigo);
    }

    [Fact]
    public async Task CreateAsync_CodigoDuplicado_LancaErro()
    {
        var (db, svc) = Create();
        await FeedbackTemplateSeeder.EnsureAsync(db, TenantId, default);
        var req = new FeedbackTemplateCreateRequest(
            FeedbackTemplateSeeder.CodReconhecimento, "X", "Y");
        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.CreateAsync(req, default));
    }

    [Fact]
    public async Task CreateAsync_ConteudoVazio_LancaErro()
    {
        var (_, svc) = Create();
        var req = new FeedbackTemplateCreateRequest("X", "Y", "");
        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.CreateAsync(req, default));
    }

    [Fact]
    public async Task Seeds_TodosTemPlaceholderEntreColchetes()
    {
        var (db, _) = Create();
        await FeedbackTemplateSeeder.EnsureAsync(db, TenantId, default);
        var ts = await db.FeedbackTemplates.IgnoreQueryFilters().ToListAsync();

        // Cada template precisa ter pelo menos um placeholder [xxx] para o usuário substituir
        foreach (var t in ts)
            Assert.Contains("[", t.Conteudo);
    }
}
