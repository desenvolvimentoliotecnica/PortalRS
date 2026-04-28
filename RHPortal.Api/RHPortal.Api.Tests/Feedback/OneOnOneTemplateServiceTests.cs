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
/// Cobertura da Entrega 1.2 (Fase 1 — Paridade Feedz): templates de pauta de 1:1.
///
/// - Service: List, Get, Create custom, RenderForMeeting (markdown)
/// - Seeder: idempotência, 10 templates de sistema, isolamento entre tenants
/// - Integração com OneOnOneService.CreateAsync (popula Subject/Notes a partir do template)
/// </summary>
public sealed class OneOnOneTemplateServiceTests
{
    private const string TenantId = "tenant-1on1";

    private static (AppDbContext Db, OneOnOneTemplateService TemplateSvc, OneOnOneService MeetingSvc) CreateServices()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantId);

        var db = new AppDbContext(options, tenantMock.Object);
        var templateSvc = new OneOnOneTemplateService(db, tenantMock.Object, NullLogger<OneOnOneTemplateService>.Instance);
        var meetingSvc = new OneOnOneService(db, tenantMock.Object, templateSvc);
        return (db, templateSvc, meetingSvc);
    }

    private static async Task<Guid> SeedUserAsync(AppDbContext db, string name = "Manager")
    {
        var id = Guid.NewGuid();
        db.Users.Add(new ApplicationUser
        {
            Id = id,
            TenantId = TenantId,
            UserName = $"u-{id:N}",
            FullName = name,
            Email = $"u-{id:N}@test.local",
        });
        await db.SaveChangesAsync();
        return id;
    }

    // ── Seeder ───────────────────────────────────────────────────────────

    [Fact]
    public async Task Seeder_RodadaInicial_Cria10TemplatesDeSistema()
    {
        var (db, _, _) = CreateServices();

        await OneOnOneTemplateSeeder.EnsureAsync(db, TenantId, default);

        var templates = await db.OneOnOneTemplates
            .IgnoreQueryFilters()
            .Where(t => t.TenantId == TenantId)
            .Include(t => t.Itens)
            .ToListAsync();

        Assert.Equal(10, templates.Count);
        Assert.All(templates, t => Assert.True(t.IsSystem));
        Assert.All(templates, t => Assert.True(t.IsActive));
        Assert.All(templates, t => Assert.NotEmpty(t.Itens));
        Assert.All(templates, t => Assert.NotNull(t.Categoria));

        var codigos = templates.Select(t => t.Codigo).ToHashSet();
        Assert.Contains(OneOnOneTemplateSeeder.CodCheckin, codigos);
        Assert.Contains(OneOnOneTemplateSeeder.CodCarreira, codigos);
        Assert.Contains(OneOnOneTemplateSeeder.CodPerformance, codigos);
        Assert.Contains(OneOnOneTemplateSeeder.CodProjeto, codigos);
        Assert.Contains(OneOnOneTemplateSeeder.CodOnboarding, codigos);
        Assert.Contains(OneOnOneTemplateSeeder.CodPosAvaliacao, codigos);
        Assert.Contains(OneOnOneTemplateSeeder.CodRetornoFerias, codigos);
        Assert.Contains(OneOnOneTemplateSeeder.CodWellbeing, codigos);
        Assert.Contains(OneOnOneTemplateSeeder.CodConflito, codigos);
        Assert.Contains(OneOnOneTemplateSeeder.CodPromocao, codigos);
    }

    [Fact]
    public async Task Seeder_RodadaDuplaNoMesmoTenant_NaoDuplica()
    {
        var (db, _, _) = CreateServices();

        await OneOnOneTemplateSeeder.EnsureAsync(db, TenantId, default);
        await OneOnOneTemplateSeeder.EnsureAsync(db, TenantId, default);

        var count = await db.OneOnOneTemplates
            .IgnoreQueryFilters()
            .CountAsync(t => t.TenantId == TenantId);

        Assert.Equal(10, count);
    }

    [Fact]
    public async Task Seeder_TenantsDiferentes_IsolamCorretamente()
    {
        // Mesmo pattern multi-tenant da Entrega 1.1 — 2 DbContexts pra que SaveChangesAsync
        // override de TenantId respeite o tenantContext de cada call.
        const string outroTenant = "tenant-outro-1on1";
        var dbName = Guid.NewGuid().ToString();

        AppDbContext NewDbForTenant(string tenant)
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(dbName)
                .Options;
            var tenantMock = new Mock<ITenantContext>();
            tenantMock.Setup(x => x.TenantId).Returns(tenant);
            return new AppDbContext(options, tenantMock.Object);
        }

        using (var dbA = NewDbForTenant(TenantId))
            await OneOnOneTemplateSeeder.EnsureAsync(dbA, TenantId, default);

        using (var dbB = NewDbForTenant(outroTenant))
            await OneOnOneTemplateSeeder.EnsureAsync(dbB, outroTenant, default);

        using var dbReader = NewDbForTenant(TenantId);
        var meuCount = await dbReader.OneOnOneTemplates.IgnoreQueryFilters().CountAsync(t => t.TenantId == TenantId);
        var outroCount = await dbReader.OneOnOneTemplates.IgnoreQueryFilters().CountAsync(t => t.TenantId == outroTenant);

        Assert.Equal(10, meuCount);
        Assert.Equal(10, outroCount);
    }

    [Fact]
    public async Task Seeder_PreservaCustomizacoesDoTenant_ApenasComplementa()
    {
        var (db, _, _) = CreateServices();

        // Cria template customizado com mesmo código de um do sistema, antes do seeder rodar.
        db.OneOnOneTemplates.Add(new OneOnOneTemplate
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            Codigo = OneOnOneTemplateSeeder.CodCheckin,
            Nome = "Customizado pelo RH",
            IsSystem = false,
            IsActive = true,
            Ordem = 999,
            CriadoEmUtc = DateTimeOffset.UtcNow,
            AtualizadoEmUtc = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        await OneOnOneTemplateSeeder.EnsureAsync(db, TenantId, default);

        // 1 customizado + 9 sistema = 10 total (CheckIn não foi sobrescrito)
        var todos = await db.OneOnOneTemplates
            .IgnoreQueryFilters()
            .Where(t => t.TenantId == TenantId)
            .ToListAsync();

        Assert.Equal(10, todos.Count);

        var checkin = todos.Single(t => t.Codigo == OneOnOneTemplateSeeder.CodCheckin);
        Assert.Equal("Customizado pelo RH", checkin.Nome);
        Assert.False(checkin.IsSystem);
    }

    [Fact]
    public async Task Seeder_TenantIdInvalido_LancaErro()
    {
        var (db, _, _) = CreateServices();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => OneOnOneTemplateSeeder.EnsureAsync(db, "", default));
    }

    // ── Service: ListAsync ───────────────────────────────────────────────

    [Fact]
    public async Task ListAsync_Default_RetornaApenasAtivos()
    {
        var (db, svc, _) = CreateServices();
        await OneOnOneTemplateSeeder.EnsureAsync(db, TenantId, default);

        var checkin = await db.OneOnOneTemplates.IgnoreQueryFilters()
            .FirstAsync(t => t.TenantId == TenantId && t.Codigo == OneOnOneTemplateSeeder.CodCheckin);
        checkin.IsActive = false;
        await db.SaveChangesAsync();

        var ativos = await svc.ListAsync(incluirInativos: false, default);
        var todos = await svc.ListAsync(incluirInativos: true, default);

        Assert.Equal(9, ativos.Count);
        Assert.Equal(10, todos.Count);
        Assert.DoesNotContain(ativos, t => t.Codigo == OneOnOneTemplateSeeder.CodCheckin);
    }

    [Fact]
    public async Task ListAsync_OrdenadoPorOrdem()
    {
        var (db, svc, _) = CreateServices();
        await OneOnOneTemplateSeeder.EnsureAsync(db, TenantId, default);

        var lista = await svc.ListAsync(incluirInativos: false, default);

        // Ordem do seed: CheckIn=10, Carreira=20, Performance=30, ..., Promocao=100
        Assert.Equal(OneOnOneTemplateSeeder.CodCheckin, lista[0].Codigo);
        Assert.Equal(OneOnOneTemplateSeeder.CodCarreira, lista[1].Codigo);
        Assert.Equal(OneOnOneTemplateSeeder.CodPromocao, lista[^1].Codigo);
    }

    // ── Service: CreateAsync ─────────────────────────────────────────────

    [Fact]
    public async Task CreateAsync_TemplateValido_CriaComIsSystemFalse()
    {
        var (_, svc, _) = CreateServices();

        var req = new OneOnOneTemplateCreateRequest(
            Codigo: "RhCustom",
            Nome: "Pauta da Empresa",
            Itens: new List<string> { "Item A", "Item B" },
            Descricao: "Modelo interno",
            Categoria: "Carreira");

        var result = await svc.CreateAsync(req, default);

        Assert.False(result.IsSystem);
        Assert.True(result.IsActive);
        Assert.Equal("Carreira", result.Categoria);
        Assert.Equal(2, result.Itens.Count);
        Assert.Equal("Item A", result.Itens[0].Texto);
        Assert.Equal(1, result.Itens[0].Ordem);
    }

    [Fact]
    public async Task CreateAsync_CodigoDuplicado_LancaErro()
    {
        var (db, svc, _) = CreateServices();
        await OneOnOneTemplateSeeder.EnsureAsync(db, TenantId, default);

        var req = new OneOnOneTemplateCreateRequest(
            Codigo: OneOnOneTemplateSeeder.CodCheckin, // já existe vindo do seed
            Nome: "Tentativa duplicada",
            Itens: new List<string> { "X" });

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.CreateAsync(req, default));
    }

    [Fact]
    public async Task CreateAsync_SemItens_LancaErro()
    {
        var (_, svc, _) = CreateServices();

        var req = new OneOnOneTemplateCreateRequest(
            Codigo: "Vazio",
            Nome: "Sem itens",
            Itens: new List<string>());

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.CreateAsync(req, default));
    }

    [Fact]
    public async Task CreateAsync_ItensComEspacoEmBranco_FiltradosETrimados()
    {
        var (_, svc, _) = CreateServices();

        var req = new OneOnOneTemplateCreateRequest(
            Codigo: "Trim",
            Nome: "Test trim",
            Itens: new List<string> { "  Item 1  ", "", "  ", "Item 2" });

        var result = await svc.CreateAsync(req, default);

        Assert.Equal(2, result.Itens.Count);
        Assert.Equal("Item 1", result.Itens[0].Texto);
        Assert.Equal("Item 2", result.Itens[1].Texto);
    }

    // ── Service: RenderForMeetingAsync ───────────────────────────────────

    [Fact]
    public async Task RenderForMeeting_TemplateAtivo_GeraSubjectENotesEmMarkdown()
    {
        var (db, svc, _) = CreateServices();
        await OneOnOneTemplateSeeder.EnsureAsync(db, TenantId, default);

        var template = await db.OneOnOneTemplates.IgnoreQueryFilters()
            .Include(t => t.Itens)
            .FirstAsync(t => t.Codigo == OneOnOneTemplateSeeder.CodCarreira);

        var rendered = await svc.RenderForMeetingAsync(template.Id, default);

        Assert.NotNull(rendered);
        var (subject, notes) = rendered!.Value;

        Assert.Equal(template.Nome, subject);
        Assert.Contains("**Pauta —", notes);
        Assert.Contains(template.Nome, notes);
        // Cada item do template aparece como bullet
        foreach (var item in template.Itens)
            Assert.Contains($"- {item.Texto}", notes);
    }

    [Fact]
    public async Task RenderForMeeting_TemplateInexistente_RetornaNull()
    {
        var (_, svc, _) = CreateServices();

        var rendered = await svc.RenderForMeetingAsync(Guid.NewGuid(), default);

        Assert.Null(rendered);
    }

    [Fact]
    public async Task RenderForMeeting_TemplateInativo_RetornaNull()
    {
        var (db, svc, _) = CreateServices();
        await OneOnOneTemplateSeeder.EnsureAsync(db, TenantId, default);

        var template = await db.OneOnOneTemplates.IgnoreQueryFilters()
            .FirstAsync(t => t.Codigo == OneOnOneTemplateSeeder.CodCheckin);
        template.IsActive = false;
        await db.SaveChangesAsync();

        var rendered = await svc.RenderForMeetingAsync(template.Id, default);

        Assert.Null(rendered);
    }

    // ── Integração com OneOnOneService.CreateAsync ───────────────────────

    [Fact]
    public async Task OneOnOneService_CreateComTemplate_PopulaSubjectENotes()
    {
        var (db, _, meetingSvc) = CreateServices();
        await OneOnOneTemplateSeeder.EnsureAsync(db, TenantId, default);
        var managerId = await SeedUserAsync(db, "Gestor");
        var collaboratorId = await SeedUserAsync(db, "Colaborador");

        var template = await db.OneOnOneTemplates.IgnoreQueryFilters()
            .FirstAsync(t => t.Codigo == OneOnOneTemplateSeeder.CodPerformance);

        var req = new OneOnOneCreateRequest(
            CollaboratorId: collaboratorId,
            MeetingDate: DateTimeOffset.UtcNow.AddDays(1),
            Subject: null,    // intencionalmente null pra acionar o template
            Notes: null,      // idem
            TemplateId: template.Id);

        var meeting = await meetingSvc.CreateAsync(req, managerId, default);

        Assert.Equal(template.Nome, meeting.Subject);
        Assert.NotNull(meeting.Notes);
        Assert.Contains("**Pauta —", meeting.Notes);
    }

    [Fact]
    public async Task OneOnOneService_CreateComSubjectExplicito_NaoSobrescreveDoTemplate()
    {
        var (db, _, meetingSvc) = CreateServices();
        await OneOnOneTemplateSeeder.EnsureAsync(db, TenantId, default);
        var managerId = await SeedUserAsync(db);
        var collaboratorId = await SeedUserAsync(db);

        var template = await db.OneOnOneTemplates.IgnoreQueryFilters()
            .FirstAsync(t => t.Codigo == OneOnOneTemplateSeeder.CodCarreira);

        var req = new OneOnOneCreateRequest(
            CollaboratorId: collaboratorId,
            MeetingDate: DateTimeOffset.UtcNow.AddDays(1),
            Subject: "Assunto do gestor",  // explícito — deve prevalecer
            Notes: "Notas do gestor",      // explícito — deve prevalecer
            TemplateId: template.Id);

        var meeting = await meetingSvc.CreateAsync(req, managerId, default);

        Assert.Equal("Assunto do gestor", meeting.Subject);
        Assert.Equal("Notas do gestor", meeting.Notes);
    }

    [Fact]
    public async Task OneOnOneService_CreateSemTemplate_ComportamentoLegado()
    {
        var (db, _, meetingSvc) = CreateServices();
        var managerId = await SeedUserAsync(db);
        var collaboratorId = await SeedUserAsync(db);

        var req = new OneOnOneCreateRequest(
            CollaboratorId: collaboratorId,
            MeetingDate: DateTimeOffset.UtcNow.AddDays(1),
            Subject: "Conversa rápida",
            Notes: "Sem template");

        var meeting = await meetingSvc.CreateAsync(req, managerId, default);

        Assert.Equal("Conversa rápida", meeting.Subject);
        Assert.Equal("Sem template", meeting.Notes);
    }
}
