using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RhPortal.Api.Application.Avaliacao;
using RhPortal.Api.Contracts.Avaliacao;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Messaging.Email;
using Xunit;

namespace RhPortal.Api.Tests.Avaliacao;

/// <summary>
/// Testes de Fase 4 MVP — ciclo de vida de AvaliacaoCiclo (Rascunho → Aberto → Fechado).
/// </summary>
public sealed class AvaliacaoServiceTests
{
    private const string TenantId = "tenant-avaliacao";

    private static (AppDbContext Db, AvaliacaoService Service) CreateService()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantId);

        var db = new AppDbContext(options, tenantMock.Object);
        var emailQueueMock = new Mock<IEmailQueueService>();
        var conviteService = new AvaliacaoConviteService(db, emailQueueMock.Object, NullLogger<AvaliacaoConviteService>.Instance);
        var calibragemService = new AvaliacaoCalibragemService(db);
        var service = new AvaliacaoService(db, conviteService, calibragemService, NullLogger<AvaliacaoService>.Instance);
        return (db, service);
    }

    private static async Task<Guid> SeedFuncionarioAsync(AppDbContext db, string name = "Funcionário")
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

    // ── CriarCicloAsync ───────────────────────────────────────────────

    [Fact]
    public async Task CriarCiclo_DefaultAberto_CriaComPerguntasOrdenadas()
    {
        var (db, svc) = CreateService();
        var criadorId = await SeedFuncionarioAsync(db, "RH");

        var req = new AvaliacaoCicloCreateRequest(
            Nome: "Q2 2026",
            Periodo: "Q2 2026",
            Perguntas: new List<string> { "Autonomia", "Colaboração", "Comunicação" });

        var result = await svc.CriarCicloAsync(req, criadorId, default);

        Assert.Equal(AvaliacaoCicloStatus.Aberto, result.Status);
        Assert.Equal(3, result.Perguntas.Count);
        Assert.Equal(1, result.Perguntas[0].Ordem);
        Assert.Equal("Autonomia", result.Perguntas[0].Texto);
    }

    [Fact]
    public async Task CriarCiclo_IniciarEmRascunho_NaoAceitaRespostas()
    {
        var (db, svc) = CreateService();
        var criadorId = await SeedFuncionarioAsync(db);

        var req = new AvaliacaoCicloCreateRequest(
            Nome: "Prévia",
            Periodo: "Q3 2026",
            Perguntas: new List<string> { "P1" },
            IniciarEmRascunho: true);

        var result = await svc.CriarCicloAsync(req, criadorId, default);

        Assert.Equal(AvaliacaoCicloStatus.Rascunho, result.Status);
    }

    [Fact]
    public async Task CriarCiclo_DataFimAnteriorInicio_LancaErro()
    {
        var (db, svc) = CreateService();
        var criadorId = await SeedFuncionarioAsync(db);

        var req = new AvaliacaoCicloCreateRequest(
            Nome: "Inválido",
            Periodo: "Q2 2026",
            Perguntas: new List<string> { "P1" },
            DataInicio: new DateOnly(2026, 06, 01),
            DataFim: new DateOnly(2026, 05, 01));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.CriarCicloAsync(req, criadorId, default));
    }

    [Fact]
    public async Task CriarCiclo_PopulaDescricaoEDatas()
    {
        var (db, svc) = CreateService();
        var criadorId = await SeedFuncionarioAsync(db);

        var req = new AvaliacaoCicloCreateRequest(
            Nome: "Completo",
            Periodo: "Q2 2026",
            Perguntas: new List<string> { "P1" },
            Descricao: "Contexto e objetivos",
            DataInicio: new DateOnly(2026, 04, 01),
            DataFim: new DateOnly(2026, 06, 30));

        var result = await svc.CriarCicloAsync(req, criadorId, default);

        Assert.Equal("Contexto e objetivos", result.Descricao);
        Assert.Equal(new DateOnly(2026, 04, 01), result.DataInicio);
        Assert.Equal(new DateOnly(2026, 06, 30), result.DataFim);
    }

    // ── AtivarCicloAsync ──────────────────────────────────────────────

    [Fact]
    public async Task Ativar_RascunhoVaiParaAberto()
    {
        var (db, svc) = CreateService();
        var criadorId = await SeedFuncionarioAsync(db);
        var ciclo = await svc.CriarCicloAsync(
            new AvaliacaoCicloCreateRequest("R", "Q2", new List<string> { "P1" }, IniciarEmRascunho: true),
            criadorId, default);

        await svc.AtivarCicloAsync(ciclo.Id, default);

        var reloaded = await svc.GetCicloAsync(ciclo.Id, default);
        Assert.Equal(AvaliacaoCicloStatus.Aberto, reloaded!.Status);
    }

    [Fact]
    public async Task Ativar_JaAberto_EhIdempotente()
    {
        var (db, svc) = CreateService();
        var criadorId = await SeedFuncionarioAsync(db);
        var ciclo = await svc.CriarCicloAsync(
            new AvaliacaoCicloCreateRequest("A", "Q2", new List<string> { "P1" }),
            criadorId, default);

        await svc.AtivarCicloAsync(ciclo.Id, default);
        await svc.AtivarCicloAsync(ciclo.Id, default);

        var reloaded = await svc.GetCicloAsync(ciclo.Id, default);
        Assert.Equal(AvaliacaoCicloStatus.Aberto, reloaded!.Status);
    }

    [Fact]
    public async Task Ativar_Fechado_LancaErro()
    {
        var (db, svc) = CreateService();
        var criadorId = await SeedFuncionarioAsync(db);
        var ciclo = await svc.CriarCicloAsync(
            new AvaliacaoCicloCreateRequest("F", "Q2", new List<string> { "P1" }),
            criadorId, default);
        await svc.FecharCicloAsync(ciclo.Id, default);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.AtivarCicloAsync(ciclo.Id, default));
    }

    [Fact]
    public async Task Ativar_Inexistente_LancaErro()
    {
        var (_, svc) = CreateService();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.AtivarCicloAsync(Guid.NewGuid(), default));
    }

    // ── ResponderAsync ────────────────────────────────────────────────

    [Fact]
    public async Task Responder_EmAberto_PersisteRespostaEScore()
    {
        var (db, svc) = CreateService();
        var criadorId = await SeedFuncionarioAsync(db, "RH");
        var avaliadorId = await SeedFuncionarioAsync(db, "Avaliador");
        var avaliandoId = await SeedFuncionarioAsync(db, "Avaliado");

        var ciclo = await svc.CriarCicloAsync(
            new AvaliacaoCicloCreateRequest("Q2", "Q2 2026", new List<string> { "P1", "P2" }),
            criadorId, default);

        var perguntaIds = ciclo.Perguntas.Select(p => p.Id).ToList();
        var req = new AvaliacaoResponderRequest(
            AvaliandoId: avaliandoId,
            Respostas: new List<RespostaItemRequest>
            {
                new(perguntaIds[0], 4),
                new(perguntaIds[1], 5),
            });

        await svc.ResponderAsync(ciclo.Id, avaliadorId, req, default);

        var resp = Assert.Single(db.AvaliacaoRespostas.ToList());
        Assert.Equal(4.5m, resp.Score);
    }

    [Fact]
    public async Task Responder_EmRascunho_LancaErro()
    {
        var (db, svc) = CreateService();
        var criadorId = await SeedFuncionarioAsync(db);
        var avaliadorId = await SeedFuncionarioAsync(db, "Av");
        var avaliandoId = await SeedFuncionarioAsync(db, "Alvo");

        var ciclo = await svc.CriarCicloAsync(
            new AvaliacaoCicloCreateRequest("R", "Q2", new List<string> { "P1" }, IniciarEmRascunho: true),
            criadorId, default);

        var req = new AvaliacaoResponderRequest(avaliandoId,
            new List<RespostaItemRequest> { new(ciclo.Perguntas[0].Id, 3) });

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.ResponderAsync(ciclo.Id, avaliadorId, req, default));
    }

    [Fact]
    public async Task Responder_EmFechado_LancaErro()
    {
        var (db, svc) = CreateService();
        var criadorId = await SeedFuncionarioAsync(db);
        var avaliadorId = await SeedFuncionarioAsync(db, "Av");
        var avaliandoId = await SeedFuncionarioAsync(db, "Alvo");

        var ciclo = await svc.CriarCicloAsync(
            new AvaliacaoCicloCreateRequest("F", "Q2", new List<string> { "P1" }),
            criadorId, default);
        await svc.FecharCicloAsync(ciclo.Id, default);

        var req = new AvaliacaoResponderRequest(avaliandoId,
            new List<RespostaItemRequest> { new(ciclo.Perguntas[0].Id, 3) });

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.ResponderAsync(ciclo.Id, avaliadorId, req, default));
    }

    [Fact]
    public async Task Responder_NotaForaDaEscala_LancaErro()
    {
        var (db, svc) = CreateService();
        var criadorId = await SeedFuncionarioAsync(db);
        var avaliadorId = await SeedFuncionarioAsync(db, "Av");
        var avaliandoId = await SeedFuncionarioAsync(db, "Alvo");

        var ciclo = await svc.CriarCicloAsync(
            new AvaliacaoCicloCreateRequest("E", "Q2", new List<string> { "P1" }),
            criadorId, default);

        var req = new AvaliacaoResponderRequest(avaliandoId,
            new List<RespostaItemRequest> { new(ciclo.Perguntas[0].Id, 6) });

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.ResponderAsync(ciclo.Id, avaliadorId, req, default));
    }

    [Fact]
    public async Task Responder_MesmoAvaliadorEAvaliando_FazUpsert()
    {
        var (db, svc) = CreateService();
        var criadorId = await SeedFuncionarioAsync(db);
        var avaliadorId = await SeedFuncionarioAsync(db, "Av");
        var avaliandoId = await SeedFuncionarioAsync(db, "Alvo");

        var ciclo = await svc.CriarCicloAsync(
            new AvaliacaoCicloCreateRequest("U", "Q2", new List<string> { "P1" }),
            criadorId, default);
        var pId = ciclo.Perguntas[0].Id;

        await svc.ResponderAsync(ciclo.Id, avaliadorId,
            new AvaliacaoResponderRequest(avaliandoId, new List<RespostaItemRequest> { new(pId, 2) }), default);
        await svc.ResponderAsync(ciclo.Id, avaliadorId,
            new AvaliacaoResponderRequest(avaliandoId, new List<RespostaItemRequest> { new(pId, 5) }), default);

        var all = db.AvaliacaoRespostas.ToList();
        Assert.Single(all);
        Assert.Equal(5m, all[0].Score);
    }

    // ── FecharCicloAsync ──────────────────────────────────────────────

    [Fact]
    public async Task Fechar_TransitaParaFechado()
    {
        var (db, svc) = CreateService();
        var criadorId = await SeedFuncionarioAsync(db);
        var ciclo = await svc.CriarCicloAsync(
            new AvaliacaoCicloCreateRequest("F", "Q2", new List<string> { "P1" }),
            criadorId, default);

        await svc.FecharCicloAsync(ciclo.Id, default);

        var reloaded = await svc.GetCicloAsync(ciclo.Id, default);
        Assert.Equal(AvaliacaoCicloStatus.Fechado, reloaded!.Status);
    }

    // ── ListResultadosAsync ───────────────────────────────────────────

    [Fact]
    public async Task ListResultados_AgrupaPorAvaliandoEMediaScores()
    {
        var (db, svc) = CreateService();
        var criadorId = await SeedFuncionarioAsync(db);
        var av1 = await SeedFuncionarioAsync(db, "Av1");
        var av2 = await SeedFuncionarioAsync(db, "Av2");
        var alvo = await SeedFuncionarioAsync(db, "Alvo");

        var ciclo = await svc.CriarCicloAsync(
            new AvaliacaoCicloCreateRequest("R", "Q2", new List<string> { "P1" }),
            criadorId, default);
        var pId = ciclo.Perguntas[0].Id;

        await svc.ResponderAsync(ciclo.Id, av1,
            new AvaliacaoResponderRequest(alvo, new List<RespostaItemRequest> { new(pId, 4) }), default);
        await svc.ResponderAsync(ciclo.Id, av2,
            new AvaliacaoResponderRequest(alvo, new List<RespostaItemRequest> { new(pId, 2) }), default);

        var resultados = await svc.ListResultadosAsync(ciclo.Id, default);

        var row = Assert.Single(resultados);
        Assert.Equal(alvo, row.AvaliandoId);
        Assert.Equal("Alvo", row.AvaliandoNome);
        Assert.Equal(3m, row.Score);
        Assert.Equal(2, row.TotalRespostas);
    }

    // ── GetCiclo (hidratação dos novos campos) ────────────────────────

    [Fact]
    public async Task GetCiclo_HidrataCamposDeLifecycleECountaRespostas()
    {
        var (db, svc) = CreateService();
        var criadorId = await SeedFuncionarioAsync(db, "RH Maria");
        var av = await SeedFuncionarioAsync(db, "Av");
        var alvo = await SeedFuncionarioAsync(db, "Alvo");

        var ciclo = await svc.CriarCicloAsync(
            new AvaliacaoCicloCreateRequest(
                "Completo", "Q2 2026", new List<string> { "P1" },
                Descricao: "desc",
                DataInicio: new DateOnly(2026, 04, 01),
                DataFim: new DateOnly(2026, 06, 30)),
            criadorId, default);

        await svc.ResponderAsync(ciclo.Id, av,
            new AvaliacaoResponderRequest(alvo, new List<RespostaItemRequest> { new(ciclo.Perguntas[0].Id, 5) }), default);

        var result = await svc.GetCicloAsync(ciclo.Id, default);

        Assert.NotNull(result);
        Assert.Equal("desc", result!.Descricao);
        Assert.Equal(new DateOnly(2026, 04, 01), result.DataInicio);
        Assert.Equal(new DateOnly(2026, 06, 30), result.DataFim);
        Assert.Equal("RH Maria", result.CriadoPorNome);
        Assert.Equal(1, result.TotalRespostas);
    }
}
