using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RhPortal.Api.Application.Feedback;
using RhPortal.Api.Contracts.Feedback;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Data.Seeders;
using RhPortal.Api.Infrastructure.Tenancy;
using Xunit;

namespace RhPortal.Api.Tests.Feedback;

/// <summary>Cobertura da Entrega 1.5 (Fase 1 — Paridade Feedz): templates de Survey.</summary>
public sealed class SurveyTemplateServiceTests
{
    private const string TenantId = "tenant-svy";

    private static (AppDbContext Db, SurveyTemplateService Svc) Create()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var t = new Mock<ITenantContext>();
        t.Setup(x => x.TenantId).Returns(TenantId);
        var db = new AppDbContext(options, t.Object);
        var svc = new SurveyTemplateService(db, t.Object, NullLogger<SurveyTemplateService>.Instance);
        return (db, svc);
    }

    [Fact]
    public async Task Seeder_Cria4TemplatesDeSistema()
    {
        var (db, _) = Create();
        await SurveyTemplateSeeder.EnsureAsync(db, TenantId, default);

        var ts = await db.SurveyTemplates.IgnoreQueryFilters()
            .Include(t => t.Questions)
            .Where(t => t.TenantId == TenantId).ToListAsync();

        Assert.Equal(4, ts.Count);
        Assert.All(ts, t => Assert.True(t.IsSystem));
        Assert.All(ts, t => Assert.NotEmpty(t.Questions));

        var codigos = ts.Select(x => x.Codigo).ToHashSet();
        Assert.Contains(SurveyTemplateSeeder.CodENPS, codigos);
        Assert.Contains(SurveyTemplateSeeder.CodClima, codigos);
        Assert.Contains(SurveyTemplateSeeder.CodLideranca, codigos);
        Assert.Contains(SurveyTemplateSeeder.CodDiversidade, codigos);
    }

    [Fact]
    public async Task Seeder_Idempotente()
    {
        var (db, _) = Create();
        await SurveyTemplateSeeder.EnsureAsync(db, TenantId, default);
        await SurveyTemplateSeeder.EnsureAsync(db, TenantId, default);
        Assert.Equal(4, await db.SurveyTemplates.IgnoreQueryFilters().CountAsync(t => t.TenantId == TenantId));
    }

    [Fact]
    public async Task Seeder_TenantsIsolam()
    {
        var dbName = Guid.NewGuid().ToString();
        AppDbContext NewDb(string t)
        {
            var o = new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(dbName).Options;
            var m = new Mock<ITenantContext>(); m.Setup(x => x.TenantId).Returns(t);
            return new AppDbContext(o, m.Object);
        }
        using (var a = NewDb(TenantId)) await SurveyTemplateSeeder.EnsureAsync(a, TenantId, default);
        using (var b = NewDb("outro")) await SurveyTemplateSeeder.EnsureAsync(b, "outro", default);

        using var r = NewDb(TenantId);
        Assert.Equal(4, await r.SurveyTemplates.IgnoreQueryFilters().CountAsync(t => t.TenantId == TenantId));
        Assert.Equal(4, await r.SurveyTemplates.IgnoreQueryFilters().CountAsync(t => t.TenantId == "outro"));
    }

    [Fact]
    public async Task Seeder_TenantIdInvalido_LancaErro()
    {
        var (db, _) = Create();
        await Assert.ThrowsAsync<InvalidOperationException>(() => SurveyTemplateSeeder.EnsureAsync(db, "", default));
    }

    [Fact]
    public async Task ENPS_Tem2Perguntas_Score0a10ETextoLivre()
    {
        var (db, _) = Create();
        await SurveyTemplateSeeder.EnsureAsync(db, TenantId, default);
        var enps = await db.SurveyTemplates.IgnoreQueryFilters()
            .Include(t => t.Questions)
            .FirstAsync(t => t.Codigo == SurveyTemplateSeeder.CodENPS);

        Assert.Equal(2, enps.Questions.Count);
        var q1 = enps.Questions.OrderBy(q => q.Ordem).First();
        Assert.Equal("Score0-10", q1.Tipo);
    }

    [Fact]
    public async Task Clima_TemPerguntasComOpcoes()
    {
        var (db, _) = Create();
        await SurveyTemplateSeeder.EnsureAsync(db, TenantId, default);
        var clima = await db.SurveyTemplates.IgnoreQueryFilters()
            .Include(t => t.Questions)
            .FirstAsync(t => t.Codigo == SurveyTemplateSeeder.CodClima);

        Assert.Contains(clima.Questions, q => q.Tipo == "SingleChoice" && !string.IsNullOrEmpty(q.OpcoesJson));
    }

    [Fact]
    public async Task ListAsync_OrdenadoPorOrdem_eNPSPrimeiro()
    {
        var (db, svc) = Create();
        await SurveyTemplateSeeder.EnsureAsync(db, TenantId, default);

        var lista = await svc.ListAsync(false, default);
        Assert.Equal(SurveyTemplateSeeder.CodENPS, lista[0].Codigo);
        Assert.Equal(SurveyTemplateSeeder.CodDiversidade, lista[^1].Codigo);
    }

    [Fact]
    public async Task GetAsync_RetornaPerguntasComOpcoesParseadas()
    {
        var (db, svc) = Create();
        await SurveyTemplateSeeder.EnsureAsync(db, TenantId, default);
        var clima = await db.SurveyTemplates.IgnoreQueryFilters()
            .FirstAsync(t => t.Codigo == SurveyTemplateSeeder.CodClima);

        var r = await svc.GetAsync(clima.Id, default);
        Assert.NotNull(r);
        var qComOpcoes = r!.Questions.FirstOrDefault(q => q.Opcoes is { Count: > 0 });
        Assert.NotNull(qComOpcoes);
        Assert.Contains("Muito bom", qComOpcoes!.Opcoes!);
    }

    [Fact]
    public async Task CreateAsync_CodigoDuplicado_LancaErro()
    {
        var (db, svc) = Create();
        await SurveyTemplateSeeder.EnsureAsync(db, TenantId, default);
        var req = new SurveyTemplateCreateRequest(
            SurveyTemplateSeeder.CodENPS, "X", "eNPS",
            new List<SurveyTemplateQuestionInput> { new("P1", "Text") });
        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.CreateAsync(req, default));
    }

    [Fact]
    public async Task CreateAsync_TemplateValido_PersisteIsSystemFalse()
    {
        var (_, svc) = Create();
        var req = new SurveyTemplateCreateRequest(
            "CustomQ4", "Pulse Q4", "Pulse",
            new List<SurveyTemplateQuestionInput>
            {
                new("Como está sua semana?", "SingleChoice", new[] { "Boa", "Mais ou menos", "Difícil" }),
                new("Comentário livre", "Text"),
            });
        var r = await svc.CreateAsync(req, default);

        Assert.False(r.IsSystem);
        Assert.Equal(2, r.Questions.Count);
        Assert.NotNull(r.Questions[0].Opcoes);
        Assert.Equal(3, r.Questions[0].Opcoes!.Count);
    }

    [Fact]
    public async Task CreateSurveyFromTemplate_CopiaPerguntasEOpcoes()
    {
        var (db, svc) = Create();
        await SurveyTemplateSeeder.EnsureAsync(db, TenantId, default);
        var enps = await db.SurveyTemplates.IgnoreQueryFilters()
            .FirstAsync(t => t.Codigo == SurveyTemplateSeeder.CodENPS);

        var req = new SurveyFromTemplateRequest(enps.Id, "eNPS Q2 2026");
        var surveyId = await svc.CreateSurveyFromTemplateAsync(req, createdByUserId: null, ct: default);

        var survey = await db.Surveys.IgnoreQueryFilters()
            .Include(s => s.Questions).ThenInclude(q => q.Options)
            .FirstAsync(s => s.Id == surveyId);

        Assert.Equal("eNPS Q2 2026", survey.Title);
        Assert.Equal("eNPS", survey.Type);
        Assert.Equal(2, survey.Questions.Count);
    }

    [Fact]
    public async Task CreateSurveyFromTemplate_TemplateInativo_LancaErro()
    {
        var (db, svc) = Create();
        await SurveyTemplateSeeder.EnsureAsync(db, TenantId, default);
        var enps = await db.SurveyTemplates.IgnoreQueryFilters()
            .FirstAsync(t => t.Codigo == SurveyTemplateSeeder.CodENPS);
        enps.IsActive = false;
        await db.SaveChangesAsync();

        var req = new SurveyFromTemplateRequest(enps.Id, "Tentativa");
        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.CreateSurveyFromTemplateAsync(req, null, default));
    }

    [Fact]
    public async Task CreateSurveyFromTemplate_ClimaCopia7QuestionsComOpcoes()
    {
        var (db, svc) = Create();
        await SurveyTemplateSeeder.EnsureAsync(db, TenantId, default);
        var clima = await db.SurveyTemplates.IgnoreQueryFilters()
            .FirstAsync(t => t.Codigo == SurveyTemplateSeeder.CodClima);

        var surveyId = await svc.CreateSurveyFromTemplateAsync(
            new SurveyFromTemplateRequest(clima.Id, "Clima 2026/2"), null, default);

        var survey = await db.Surveys.IgnoreQueryFilters()
            .Include(s => s.Questions).ThenInclude(q => q.Options)
            .FirstAsync(s => s.Id == surveyId);

        Assert.Equal(7, survey.Questions.Count);
        // A primeira pergunta tem 5 opções
        Assert.Equal(5, survey.Questions.First(q => q.Order == 1).Options.Count);
    }
}
