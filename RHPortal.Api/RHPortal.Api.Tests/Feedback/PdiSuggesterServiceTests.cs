using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RhPortal.Api.Application.Feedback;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using Xunit;

namespace RhPortal.Api.Tests.Feedback;

/// <summary>
/// Cobertura da Entrega 1.4 (Fase 1 — Paridade Feedz): PDI auto-gerado por IA + fallback heurístico.
/// IA é opcional — todos os testes usam fallback determinístico para não depender de RHPortal.Ai.
/// </summary>
public sealed class PdiSuggesterServiceTests
{
    private const string TenantId = "tenant-pdi";

    private static (AppDbContext Db, PdiSuggesterService Svc) Create()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var tenant = new Mock<ITenantContext>();
        tenant.Setup(x => x.TenantId).Returns(TenantId);
        var db = new AppDbContext(options, tenant.Object);
        // llm = null força fallback heurístico em todos os testes (determinístico)
        var svc = new PdiSuggesterService(db, tenant.Object, NullLogger<PdiSuggesterService>.Instance, llm: null);
        return (db, svc);
    }

    private static async Task<(Guid CicloId, Guid FuncionarioId, List<Guid> PerguntaIds)>
        SeedCicloEFuncionario(AppDbContext db, decimal[] notasMedias)
    {
        var funcId = Guid.NewGuid();
        db.Funcionarios.Add(new Funcionario
        {
            Id = funcId, TenantId = TenantId, Name = "João Silva",
            Email = $"f-{funcId:N}@x.com",
        });

        var criadorId = Guid.NewGuid();
        db.Funcionarios.Add(new Funcionario
        {
            Id = criadorId, TenantId = TenantId, Name = "RH",
            Email = $"f-{criadorId:N}@x.com",
        });

        var perguntaIds = notasMedias.Select(_ => Guid.NewGuid()).ToList();
        var cicloId = Guid.NewGuid();
        db.AvaliacaoCiclos.Add(new AvaliacaoCiclo
        {
            Id = cicloId,
            TenantId = TenantId,
            Nome = "Q2 2026",
            Periodo = "Q2 2026",
            Status = AvaliacaoCicloStatus.Fechado,
            CriadoPorId = criadorId,
            CriadoEmUtc = DateTimeOffset.UtcNow,
            AtualizadoEmUtc = DateTimeOffset.UtcNow,
            Perguntas = perguntaIds.Select((pid, i) => new AvaliacaoPergunta
            {
                Id = pid,
                CicloId = cicloId,
                Texto = $"Pergunta {i + 1}",
                Ordem = i + 1,
            }).ToList(),
        });

        // Cria 1 resposta por avaliador, com a nota desejada para cada pergunta
        var avaliadorId = Guid.NewGuid();
        db.Funcionarios.Add(new Funcionario
        {
            Id = avaliadorId, TenantId = TenantId, Name = "Avaliador",
            Email = $"a-{avaliadorId:N}@x.com",
        });

        var respostaItens = perguntaIds
            .Zip(notasMedias, (pid, nota) => new { perguntaId = pid, nota })
            .ToArray();

        db.AvaliacaoRespostas.Add(new AvaliacaoResposta
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            CicloId = cicloId,
            AvaliadorId = avaliadorId,
            AvaliandoId = funcId,
            Score = notasMedias.Average(),
            RespostasJson = JsonSerializer.Serialize(respostaItens),
            CriadoEmUtc = DateTimeOffset.UtcNow,
        });

        await db.SaveChangesAsync();
        return (cicloId, funcId, perguntaIds);
    }

    [Fact]
    public async Task SugerirPdi_CicloInexistente_RetornaNull()
    {
        var (_, svc) = Create();
        var r = await svc.SuggestForFuncionarioAsync(Guid.NewGuid(), Guid.NewGuid(), default);
        Assert.Null(r);
    }

    [Fact]
    public async Task SugerirPdi_FuncionarioInexistente_RetornaNull()
    {
        var (db, svc) = Create();
        var (cicloId, _, _) = await SeedCicloEFuncionario(db, new[] { 4m, 4m, 4m });

        var r = await svc.SuggestForFuncionarioAsync(cicloId, Guid.NewGuid(), default);
        Assert.Null(r);
    }

    [Fact]
    public async Task SugerirPdi_FuncionarioSemRespostas_RetornaNull()
    {
        var (db, svc) = Create();
        var funcId = Guid.NewGuid();
        db.Funcionarios.Add(new Funcionario { Id = funcId, TenantId = TenantId, Name = "Sozinho", Email = "s@x.com" });
        var criadorId = Guid.NewGuid();
        db.Funcionarios.Add(new Funcionario { Id = criadorId, TenantId = TenantId, Name = "RH", Email = "rh@x.com" });
        var cicloId = Guid.NewGuid();
        db.AvaliacaoCiclos.Add(new AvaliacaoCiclo
        {
            Id = cicloId, TenantId = TenantId, Nome = "X", Periodo = "X",
            CriadoPorId = criadorId, CriadoEmUtc = DateTimeOffset.UtcNow, AtualizadoEmUtc = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var r = await svc.SuggestForFuncionarioAsync(cicloId, funcId, default);
        Assert.Null(r);
    }

    [Fact]
    public async Task SugerirPdi_ComGapsClaros_GeraMetasNaOrdemDeMaiorGap()
    {
        var (db, svc) = Create();
        // 5 perguntas: a 3a tem nota 1.5 (pior), a 1a tem 4.5 (melhor)
        var (cicloId, funcId, perguntaIds) = await SeedCicloEFuncionario(db,
            new[] { 4.5m, 3.5m, 1.5m, 2.5m, 4.0m });

        var r = await svc.SuggestForFuncionarioAsync(cicloId, funcId, default);

        Assert.NotNull(r);
        Assert.Equal("heuristic", r!.Source);
        Assert.NotEmpty(r.Goals);
        Assert.True(r.Goals.Count <= 5);

        // Primeira meta deve ser sobre a pergunta com pior nota (1.5 = pergunta 3)
        Assert.Contains("Pergunta 3", r.Goals[0].Description);
    }

    [Fact]
    public async Task SugerirPdi_FallbackHeuristico_GeraJustificativaPorMeta()
    {
        var (db, svc) = Create();
        var (cicloId, funcId, _) = await SeedCicloEFuncionario(db, new[] { 2m, 3m, 4m });

        var r = await svc.SuggestForFuncionarioAsync(cicloId, funcId, default);

        Assert.NotNull(r);
        Assert.All(r!.Goals, g => Assert.False(string.IsNullOrWhiteSpace(g.Justification)));
    }

    [Fact]
    public async Task SugerirPdi_GeraTituloComPeriodoENomeFuncionario()
    {
        var (db, svc) = Create();
        var (cicloId, funcId, _) = await SeedCicloEFuncionario(db, new[] { 3m, 3m });

        var r = await svc.SuggestForFuncionarioAsync(cicloId, funcId, default);

        Assert.NotNull(r);
        Assert.Contains("Q2 2026", r!.Title);
        Assert.Contains("João Silva", r.Title);
    }

    [Fact]
    public async Task SugerirPdi_CalculaScoreMedio()
    {
        var (db, svc) = Create();
        var (cicloId, funcId, _) = await SeedCicloEFuncionario(db, new[] { 2m, 4m });
        // notas 2 e 4 → score médio individual = 3 → média de uma única resposta = 3

        var r = await svc.SuggestForFuncionarioAsync(cicloId, funcId, default);
        Assert.NotNull(r);
        Assert.NotNull(r!.ScoreMedio);
        Assert.Equal(3m, r.ScoreMedio);
    }

    [Fact]
    public async Task SugerirPdi_DueDateDefaultEh4MesesAFrente()
    {
        var (db, svc) = Create();
        var (cicloId, funcId, _) = await SeedCicloEFuncionario(db, new[] { 2m, 3m });

        var r = await svc.SuggestForFuncionarioAsync(cicloId, funcId, default);
        Assert.NotNull(r);
        Assert.All(r!.Goals, g =>
        {
            Assert.NotNull(g.DueDate);
            var diasNoFuturo = (g.DueDate!.Value - DateTimeOffset.UtcNow).TotalDays;
            Assert.InRange(diasNoFuturo, 115, 125);
        });
    }

    [Fact]
    public async Task SugerirPdi_OrderField_SequencialApartirDe1()
    {
        var (db, svc) = Create();
        var (cicloId, funcId, _) = await SeedCicloEFuncionario(db, new[] { 1m, 2m, 3m });

        var r = await svc.SuggestForFuncionarioAsync(cicloId, funcId, default);
        Assert.NotNull(r);
        for (int i = 0; i < r!.Goals.Count; i++)
            Assert.Equal(i + 1, r.Goals[i].Order);
    }

    [Fact]
    public async Task SugerirPdi_NotasBaixas_GeramTextoMaisAssertivo()
    {
        var (db, svc) = Create();
        // Nota 2.0 (gap forte) vs 3.5 (gap moderado)
        var (cicloId, funcId, _) = await SeedCicloEFuncionario(db, new[] { 2.0m, 3.5m });

        var r = await svc.SuggestForFuncionarioAsync(cicloId, funcId, default);
        Assert.NotNull(r);
        // Primeira meta (gap forte) → "Desenvolver de forma estruturada"
        Assert.Contains("Desenvolver de forma estruturada", r!.Goals[0].Description);
        // Segunda (gap moderado) → "Aprimorar a prática de"
        Assert.Contains("Aprimorar a prática de", r.Goals[1].Description);
    }

    [Fact]
    public async Task SugerirPdi_Maximo5Metas_MesmoCom10PerguntasGap()
    {
        var (db, svc) = Create();
        var notas = Enumerable.Range(1, 10).Select(i => (decimal)i / 2).ToArray(); // 0.5, 1.0, ... 5.0
        var (cicloId, funcId, _) = await SeedCicloEFuncionario(db, notas);

        var r = await svc.SuggestForFuncionarioAsync(cicloId, funcId, default);
        Assert.NotNull(r);
        Assert.Equal(5, r!.Goals.Count); // capped no MaxGoals
    }

    [Fact]
    public async Task SugerirPdi_RespostasJsonCorrompido_NaoQuebraEignora()
    {
        var (db, svc) = Create();
        var (cicloId, funcId, _) = await SeedCicloEFuncionario(db, new[] { 3m, 3m });

        // Insere uma resposta com JSON inválido
        db.AvaliacaoRespostas.Add(new AvaliacaoResposta
        {
            Id = Guid.NewGuid(), TenantId = TenantId,
            CicloId = cicloId, AvaliadorId = Guid.NewGuid(), AvaliandoId = funcId,
            Score = 0, RespostasJson = "{ json corrompido!",
            CriadoEmUtc = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var r = await svc.SuggestForFuncionarioAsync(cicloId, funcId, default);
        Assert.NotNull(r);
        // Continua gerando metas a partir da resposta válida
        Assert.NotEmpty(r!.Goals);
    }
}
