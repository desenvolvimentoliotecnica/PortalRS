using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RhPortal.Api.Application.Avaliacao;
using RhPortal.Api.Contracts.Avaliacao;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Data.Seeders;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Messaging.Email;
using Xunit;

namespace RhPortal.Api.Tests.Avaliacao;

/// <summary>
/// Cobertura da Entrega 1.1 (Fase 1 — Paridade Feedz): templates de avaliação.
///
/// - Service: ListAsync, GetAsync, CreateAsync (custom), CriarCicloFromTemplateAsync
/// - Seeder: idempotência, 5 templates de sistema, isolamento entre tenants
///
/// Padrão segue AvaliacaoServiceTests.cs (xUnit + Moq + EF InMemory).
/// </summary>
public sealed class AvaliacaoTemplateServiceTests
{
    private const string TenantId = "tenant-templates";

    private static (AppDbContext Db, AvaliacaoTemplateService TemplateSvc, AvaliacaoService CicloSvc) CreateServices()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantId);

        var db = new AppDbContext(options, tenantMock.Object);

        var emailQueueMock = new Mock<IEmailQueueService>();
        var conviteSvc = new AvaliacaoConviteService(db, emailQueueMock.Object, NullLogger<AvaliacaoConviteService>.Instance);
        var calibragemSvc = new AvaliacaoCalibragemService(db);
        var cicloSvc = new AvaliacaoService(db, conviteSvc, calibragemSvc, NullLogger<AvaliacaoService>.Instance);

        var templateSvc = new AvaliacaoTemplateService(db, tenantMock.Object, cicloSvc, NullLogger<AvaliacaoTemplateService>.Instance);
        return (db, templateSvc, cicloSvc);
    }

    private static async Task<Guid> SeedFuncionarioAsync(AppDbContext db, string name = "RH")
    {
        var id = Guid.NewGuid();
        db.Funcionarios.Add(new Funcionario
        {
            Id = id,
            TenantId = TenantId,
            Name = name,
            Email = $"f-{id:N}@test.local",
        });
        await db.SaveChangesAsync();
        return id;
    }

    // ── Seeder ───────────────────────────────────────────────────────────

    [Fact]
    public async Task Seeder_RodadaInicial_Cria7TemplatesDeSistema()
    {
        var (db, _, _) = CreateServices();

        await AvaliacaoTemplateSeeder.EnsureAsync(db, TenantId, default);

        var templates = await db.AvaliacaoTemplates
            .IgnoreQueryFilters()
            .Where(t => t.TenantId == TenantId)
            .Include(t => t.Perguntas)
            .ToListAsync();

        Assert.Equal(7, templates.Count);
        Assert.All(templates, t => Assert.True(t.IsSystem));
        Assert.All(templates, t => Assert.True(t.IsActive));
        Assert.All(templates, t => Assert.NotEmpty(t.Perguntas));

        var codigos = templates.Select(t => t.Codigo).ToHashSet();
        Assert.Contains(AvaliacaoTemplateSeeder.CodAnual, codigos);
        Assert.Contains(AvaliacaoTemplateSeeder.Cod180Graus, codigos);
        Assert.Contains(AvaliacaoTemplateSeeder.Cod90Graus, codigos);
        Assert.Contains(AvaliacaoTemplateSeeder.CodSemestral, codigos);
        Assert.Contains(AvaliacaoTemplateSeeder.CodTrintaSessenta, codigos);
        Assert.Contains(AvaliacaoTemplateSeeder.CodAutoAvaliacao, codigos);
        Assert.Contains(AvaliacaoTemplateSeeder.CodLider, codigos);
    }

    [Fact]
    public async Task Seeder_RodadaDuplaNoMesmoTenant_NaoDuplica()
    {
        var (db, _, _) = CreateServices();

        await AvaliacaoTemplateSeeder.EnsureAsync(db, TenantId, default);
        await AvaliacaoTemplateSeeder.EnsureAsync(db, TenantId, default);

        var count = await db.AvaliacaoTemplates
            .IgnoreQueryFilters()
            .CountAsync(t => t.TenantId == TenantId);

        Assert.Equal(7, count);
    }

    [Fact]
    public async Task Seeder_TenantsDiferentes_IsolamCorretamente()
    {
        // Em produção (DbSeeder), cada tenant tem seu próprio scope com TenantContext setado.
        // Repetimos esse pattern aqui — cada chamada do seeder usa um DbContext novo com
        // TenantContext correspondente, porque AppDbContext.SaveChangesAsync sobrescreve
        // ITenantEntity.TenantId com _tenantContext.TenantId no INSERT.
        const string outroTenant = "tenant-outro";
        var dbName = Guid.NewGuid().ToString();

        AppDbContext NewDbForTenant(string tenant)
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(dbName)  // mesma DB compartilhada
                .Options;
            var tenantMock = new Mock<ITenantContext>();
            tenantMock.Setup(x => x.TenantId).Returns(tenant);
            return new AppDbContext(options, tenantMock.Object);
        }

        using (var dbA = NewDbForTenant(TenantId))
            await AvaliacaoTemplateSeeder.EnsureAsync(dbA, TenantId, default);

        using (var dbB = NewDbForTenant(outroTenant))
            await AvaliacaoTemplateSeeder.EnsureAsync(dbB, outroTenant, default);

        using var dbReader = NewDbForTenant(TenantId);
        var meuCount = await dbReader.AvaliacaoTemplates.IgnoreQueryFilters().CountAsync(t => t.TenantId == TenantId);
        var outroCount = await dbReader.AvaliacaoTemplates.IgnoreQueryFilters().CountAsync(t => t.TenantId == outroTenant);

        Assert.Equal(7, meuCount);
        Assert.Equal(7, outroCount);
    }

    [Fact]
    public async Task Seeder_PreservaCustomizacoesDoTenant_ApenasComplementa()
    {
        var (db, _, _) = CreateServices();

        // Cria manualmente 1 template com mesmo código "Anual" mas customizado (IsSystem=false)
        // simulando RH que editou. Seeder não deve sobrescrever.
        db.AvaliacaoTemplates.Add(new AvaliacaoTemplate
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            Codigo = AvaliacaoTemplateSeeder.CodAnual,
            Nome = "Customizado pelo RH",
            IsSystem = false,
            IsActive = true,
            Ordem = 999,
            CriadoEmUtc = DateTimeOffset.UtcNow,
            AtualizadoEmUtc = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        await AvaliacaoTemplateSeeder.EnsureAsync(db, TenantId, default);

        // Templates totais: 1 customizado (Anual) + 6 sistema (180°/90°/Semestral/30-60-90/Auto/Líder vieram do seed)
        var todos = await db.AvaliacaoTemplates
            .IgnoreQueryFilters()
            .Where(t => t.TenantId == TenantId)
            .ToListAsync();

        Assert.Equal(7, todos.Count);

        var anual = todos.Single(t => t.Codigo == AvaliacaoTemplateSeeder.CodAnual);
        Assert.Equal("Customizado pelo RH", anual.Nome);
        Assert.False(anual.IsSystem);
    }

    [Fact]
    public async Task Seeder_TenantIdInvalido_LancaErro()
    {
        var (db, _, _) = CreateServices();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => AvaliacaoTemplateSeeder.EnsureAsync(db, "", default));
    }

    // ── Service: ListAsync ───────────────────────────────────────────────

    [Fact]
    public async Task ListAsync_Default_RetornaApenasAtivos()
    {
        var (db, svc, _) = CreateServices();
        await AvaliacaoTemplateSeeder.EnsureAsync(db, TenantId, default);

        // Desativa um deles
        var anual = await db.AvaliacaoTemplates.IgnoreQueryFilters()
            .FirstAsync(t => t.TenantId == TenantId && t.Codigo == AvaliacaoTemplateSeeder.CodAnual);
        anual.IsActive = false;
        await db.SaveChangesAsync();

        var ativos = await svc.ListAsync(incluirInativos: false, default);
        var todos = await svc.ListAsync(incluirInativos: true, default);

        Assert.Equal(6, ativos.Count);
        Assert.Equal(7, todos.Count);
        Assert.DoesNotContain(ativos, t => t.Codigo == AvaliacaoTemplateSeeder.CodAnual);
    }

    [Fact]
    public async Task ListAsync_OrdenadoPorOrdemEDepoisNome()
    {
        var (db, svc, _) = CreateServices();
        await AvaliacaoTemplateSeeder.EnsureAsync(db, TenantId, default);

        var lista = await svc.ListAsync(incluirInativos: false, default);

        // Ordem do seed: Anual=10, 180=12, 90=14, Semestral=20, 30-60-90=30, Auto=40, Lider=50
        Assert.Equal(AvaliacaoTemplateSeeder.CodAnual, lista[0].Codigo);
        Assert.Equal(AvaliacaoTemplateSeeder.Cod180Graus, lista[1].Codigo);
        Assert.Equal(AvaliacaoTemplateSeeder.Cod90Graus, lista[2].Codigo);
        Assert.Equal(AvaliacaoTemplateSeeder.CodLider, lista[^1].Codigo);
    }

    // ── Service: CreateAsync (template customizado) ──────────────────────

    [Fact]
    public async Task CreateAsync_TemplateValido_CriaComIsSystemFalse()
    {
        var (_, svc, _) = CreateServices();

        var req = new AvaliacaoTemplateCreateRequest(
            Codigo: "CustomQ4",
            Nome: "Avaliação Q4 Customizada",
            Perguntas: new List<string> { "Pergunta A", "Pergunta B" },
            Descricao: "Modelo da empresa",
            PeriodoSugerido: "Q4");

        var result = await svc.CreateAsync(req, default);

        Assert.False(result.IsSystem);
        Assert.True(result.IsActive);
        Assert.Equal(2, result.Perguntas.Count);
        Assert.Equal("Pergunta A", result.Perguntas[0].Texto);
        Assert.Equal(1, result.Perguntas[0].Ordem);
    }

    [Fact]
    public async Task CreateAsync_CodigoDuplicado_LancaErro()
    {
        var (db, svc, _) = CreateServices();
        await AvaliacaoTemplateSeeder.EnsureAsync(db, TenantId, default);

        var req = new AvaliacaoTemplateCreateRequest(
            Codigo: AvaliacaoTemplateSeeder.CodAnual, // já existe vindo do seed
            Nome: "Tentativa duplicada",
            Perguntas: new List<string> { "P1" });

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.CreateAsync(req, default));
    }

    [Fact]
    public async Task CreateAsync_SemPerguntas_LancaErro()
    {
        var (_, svc, _) = CreateServices();

        var req = new AvaliacaoTemplateCreateRequest(
            Codigo: "Vazio",
            Nome: "Sem perguntas",
            Perguntas: new List<string>());

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.CreateAsync(req, default));
    }

    [Fact]
    public async Task CreateAsync_PerguntasComEspacosEmBranco_FiltradasETrimadas()
    {
        var (_, svc, _) = CreateServices();

        var req = new AvaliacaoTemplateCreateRequest(
            Codigo: "Trim",
            Nome: "Test trim",
            Perguntas: new List<string> { "  P1  ", "", "  ", "P2" });

        var result = await svc.CreateAsync(req, default);

        Assert.Equal(2, result.Perguntas.Count);
        Assert.Equal("P1", result.Perguntas[0].Texto);
        Assert.Equal("P2", result.Perguntas[1].Texto);
    }

    // ── Service: CriarCicloFromTemplateAsync ─────────────────────────────

    [Fact]
    public async Task CriarCicloFromTemplate_TemplateAtivo_GeraCicloComMesmasPerguntas()
    {
        var (db, svc, _) = CreateServices();
        await AvaliacaoTemplateSeeder.EnsureAsync(db, TenantId, default);
        var criadorId = await SeedFuncionarioAsync(db);

        var template = await db.AvaliacaoTemplates
            .Include(t => t.Perguntas)
            .IgnoreQueryFilters()
            .FirstAsync(t => t.Codigo == AvaliacaoTemplateSeeder.CodSemestral);

        var req = new AvaliacaoCicloFromTemplateRequest(
            TemplateId: template.Id,
            Nome: "Avaliação Semestral 2026/2",
            Periodo: "S2 2026");

        var ciclo = await svc.CriarCicloFromTemplateAsync(req, criadorId, default);

        Assert.Equal("Avaliação Semestral 2026/2", ciclo.Nome);
        Assert.Equal("S2 2026", ciclo.Periodo);
        Assert.Equal(template.Perguntas.Count, ciclo.Perguntas.Count);
        Assert.Equal(AvaliacaoCicloStatus.Aberto, ciclo.Status);

        // Perguntas vêm na mesma ordem do template
        var ordemTemplate = template.Perguntas.OrderBy(p => p.Ordem).Select(p => p.Texto).ToList();
        var ordemCiclo = ciclo.Perguntas.OrderBy(p => p.Ordem).Select(p => p.Texto).ToList();
        Assert.Equal(ordemTemplate, ordemCiclo);
    }

    [Fact]
    public async Task CriarCicloFromTemplate_TemplateInexistente_LancaErro()
    {
        var (db, svc, _) = CreateServices();
        var criadorId = await SeedFuncionarioAsync(db);

        var req = new AvaliacaoCicloFromTemplateRequest(
            TemplateId: Guid.NewGuid(),
            Nome: "X",
            Periodo: "Q1 2026");

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.CriarCicloFromTemplateAsync(req, criadorId, default));
    }

    [Fact]
    public async Task CriarCicloFromTemplate_TemplateInativo_LancaErro()
    {
        var (db, svc, _) = CreateServices();
        await AvaliacaoTemplateSeeder.EnsureAsync(db, TenantId, default);
        var criadorId = await SeedFuncionarioAsync(db);

        var template = await db.AvaliacaoTemplates.IgnoreQueryFilters()
            .FirstAsync(t => t.Codigo == AvaliacaoTemplateSeeder.CodAnual);
        template.IsActive = false;
        await db.SaveChangesAsync();

        var req = new AvaliacaoCicloFromTemplateRequest(
            TemplateId: template.Id,
            Nome: "X",
            Periodo: "Q1 2026");

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.CriarCicloFromTemplateAsync(req, criadorId, default));
    }

    [Fact]
    public async Task CriarCicloFromTemplate_NomeVazio_LancaErro()
    {
        var (db, svc, _) = CreateServices();
        await AvaliacaoTemplateSeeder.EnsureAsync(db, TenantId, default);
        var criadorId = await SeedFuncionarioAsync(db);
        var template = await db.AvaliacaoTemplates.IgnoreQueryFilters().FirstAsync();

        var req = new AvaliacaoCicloFromTemplateRequest(
            TemplateId: template.Id,
            Nome: "  ",
            Periodo: "Q1 2026");

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.CriarCicloFromTemplateAsync(req, criadorId, default));
    }

    [Fact]
    public async Task CriarCicloFromTemplate_RespeitaIniciarEmRascunho()
    {
        var (db, svc, _) = CreateServices();
        await AvaliacaoTemplateSeeder.EnsureAsync(db, TenantId, default);
        var criadorId = await SeedFuncionarioAsync(db);
        var template = await db.AvaliacaoTemplates.IgnoreQueryFilters()
            .FirstAsync(t => t.Codigo == AvaliacaoTemplateSeeder.CodAnual);

        var req = new AvaliacaoCicloFromTemplateRequest(
            TemplateId: template.Id,
            Nome: "Em rascunho",
            Periodo: "2026",
            IniciarEmRascunho: true);

        var ciclo = await svc.CriarCicloFromTemplateAsync(req, criadorId, default);
        Assert.Equal(AvaliacaoCicloStatus.Rascunho, ciclo.Status);
    }
}
