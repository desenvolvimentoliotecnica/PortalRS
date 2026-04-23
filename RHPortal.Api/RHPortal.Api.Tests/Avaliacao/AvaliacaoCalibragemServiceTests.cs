using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Moq;
using RhPortal.Api.Application.Avaliacao;
using RhPortal.Api.Contracts.Avaliacao;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using Xunit;

namespace RhPortal.Api.Tests.Avaliacao;

public sealed class AvaliacaoCalibragemServiceTests
{
    private const string TenantId = "tenant-calibragem";

    private static (AppDbContext Db, AvaliacaoCalibragemService Service) CreateService()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantId);

        var db = new AppDbContext(options, tenantMock.Object);
        var svc = new AvaliacaoCalibragemService(db);
        return (db, svc);
    }

    private static async Task<Guid> SeedFuncionarioAsync(AppDbContext db, string name = "F")
    {
        var f = new Funcionario
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            Name = name,
            Email = $"{Guid.NewGuid():N}@test.local",
            Status = FuncionarioStatus.Active,
        };
        db.Funcionarios.Add(f);
        await db.SaveChangesAsync();
        return f.Id;
    }

    private static async Task<Guid> SeedCicloAsync(AppDbContext db, AvaliacaoCicloStatus status = AvaliacaoCicloStatus.Aberto)
    {
        var ciclo = new AvaliacaoCiclo
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            Nome = "Ciclo",
            Periodo = "Q2 2026",
            Status = status,
            CriadoEmUtc = DateTimeOffset.UtcNow,
            AtualizadoEmUtc = DateTimeOffset.UtcNow,
        };
        db.AvaliacaoCiclos.Add(ciclo);
        await db.SaveChangesAsync();
        return ciclo.Id;
    }

    private static async Task SeedRespostaAsync(AppDbContext db, Guid cicloId, Guid avaliadorId, Guid avaliandoId, decimal score)
    {
        db.AvaliacaoRespostas.Add(new AvaliacaoResposta
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            CicloId = cicloId,
            AvaliadorId = avaliadorId,
            AvaliandoId = avaliandoId,
            Score = score,
            RespostasJson = JsonSerializer.Serialize(new[] { new { PerguntaId = Guid.NewGuid(), Nota = (int)Math.Round(score) } }),
            CriadoEmUtc = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task Iniciar_CalculaMediaPorAvaliandoETransitaCicloParaEmCalibragem()
    {
        var (db, svc) = CreateService();
        var cicloId = await SeedCicloAsync(db);
        var avaliador = await SeedFuncionarioAsync(db, "Avaliador");
        var a1 = await SeedFuncionarioAsync(db, "A1");
        var a2 = await SeedFuncionarioAsync(db, "A2");

        await SeedRespostaAsync(db, cicloId, avaliador, a1, 4.8m);
        await SeedRespostaAsync(db, cicloId, avaliador, a1, 4.2m); // média 4.5
        await SeedRespostaAsync(db, cicloId, avaliador, a2, 2.0m);

        var criadas = await svc.IniciarCalibragemAsync(cicloId, default);

        Assert.Equal(2, criadas);
        var linhas = await db.AvaliacaoCalibragens.AsNoTracking().ToListAsync();
        var l1 = linhas.Single(l => l.FuncionarioId == a1);
        Assert.Equal(4.5m, l1.ScoreGestor);
        Assert.Equal(3, l1.DesempenhoGestor); // >=4 → cat 3

        var l2 = linhas.Single(l => l.FuncionarioId == a2);
        Assert.Equal(2.0m, l2.ScoreGestor);
        Assert.Equal(1, l2.DesempenhoGestor); // <2.5 → cat 1

        var ciclo = await db.AvaliacaoCiclos.AsNoTracking().FirstAsync(c => c.Id == cicloId);
        Assert.Equal(AvaliacaoCicloStatus.EmCalibragem, ciclo.Status);
    }

    [Fact]
    public async Task Iniciar_Rascunho_LancaErro()
    {
        var (db, svc) = CreateService();
        var cicloId = await SeedCicloAsync(db, AvaliacaoCicloStatus.Rascunho);

        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.IniciarCalibragemAsync(cicloId, default));
    }

    [Fact]
    public async Task Iniciar_EhIdempotente_NaoDuplicaLinhas()
    {
        var (db, svc) = CreateService();
        var cicloId = await SeedCicloAsync(db);
        var avaliador = await SeedFuncionarioAsync(db);
        var alvo = await SeedFuncionarioAsync(db);
        await SeedRespostaAsync(db, cicloId, avaliador, alvo, 3.5m);

        await svc.IniciarCalibragemAsync(cicloId, default);
        var criadas2 = await svc.IniciarCalibragemAsync(cicloId, default);

        Assert.Equal(0, criadas2);
        Assert.Equal(1, await db.AvaliacaoCalibragens.CountAsync());
    }

    [Fact]
    public async Task Ajustar_ComiteRegistraPotencialDesempenhoEJustificativa()
    {
        var (db, svc) = CreateService();
        var cicloId = await SeedCicloAsync(db);
        var avaliador = await SeedFuncionarioAsync(db);
        var alvo = await SeedFuncionarioAsync(db, "Alvo");
        await SeedRespostaAsync(db, cicloId, avaliador, alvo, 3.0m);
        await svc.IniciarCalibragemAsync(cicloId, default);

        var result = await svc.AjustarAsync(cicloId, new AvaliacaoCalibragemAjusteRequest(
            FuncionarioId: alvo,
            ScoreComite: 4.0m,
            DesempenhoComite: 3,
            PotencialComite: 2,
            Justificativa: "Entregou projeto crítico"), default);

        Assert.Equal(AvaliacaoCalibragemStatus.Calibrado, result.Status);
        Assert.Equal(4.0m, result.ScoreComite);
        Assert.Equal(3, result.DesempenhoComite);
        Assert.Equal(2, result.PotencialComite);
        Assert.Equal("Entregou projeto crítico", result.JustificativaComite);
    }

    [Fact]
    public async Task Ajustar_ScoreForaDoRange_LancaErro()
    {
        var (db, svc) = CreateService();
        var cicloId = await SeedCicloAsync(db);
        var avaliador = await SeedFuncionarioAsync(db);
        var alvo = await SeedFuncionarioAsync(db);
        await SeedRespostaAsync(db, cicloId, avaliador, alvo, 3.0m);
        await svc.IniciarCalibragemAsync(cicloId, default);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.AjustarAsync(cicloId, new AvaliacaoCalibragemAjusteRequest(alvo, 7.0m, null, null, null), default));
    }

    [Fact]
    public async Task Decidir_ComiteComGerarNineBox_CriaAssessmentAmarradoAoCiclo()
    {
        var (db, svc) = CreateService();
        var cicloId = await SeedCicloAsync(db);
        var avaliador = await SeedFuncionarioAsync(db);
        var alvo = await SeedFuncionarioAsync(db, "Alvo");
        await SeedRespostaAsync(db, cicloId, avaliador, alvo, 3.0m);
        await svc.IniciarCalibragemAsync(cicloId, default);

        await svc.AjustarAsync(cicloId, new AvaliacaoCalibragemAjusteRequest(
            alvo, 4.5m, 3, 3, "Alto potencial"), default);

        var decisor = Guid.NewGuid();
        var result = await svc.DecidirAsync(cicloId, decisor, new AvaliacaoCalibragemDecisaoRequest(
            FuncionarioId: alvo,
            Versao: AvaliacaoCalibragemVersao.Comite,
            Observacao: "Confirmo decisão do comitê",
            GerarNineBox: true), default);

        Assert.Equal(AvaliacaoCalibragemStatus.Decidido, result.Status);
        Assert.Equal(AvaliacaoCalibragemVersao.Comite, result.Decisao);
        Assert.Equal(decisor, result.DecididoPorUserId);
        Assert.NotNull(result.NineBoxAssessmentId);

        var nb = await db.NineBoxAssessments.AsNoTracking().SingleAsync(n => n.Id == result.NineBoxAssessmentId!.Value);
        Assert.Equal(3, nb.Desempenho);
        Assert.Equal(3, nb.Potencial);
        Assert.Equal(cicloId, nb.CicloAvaliacaoId);
    }

    [Fact]
    public async Task Decidir_GestorSemComite_UsaNotaDoGestor()
    {
        var (db, svc) = CreateService();
        var cicloId = await SeedCicloAsync(db);
        var avaliador = await SeedFuncionarioAsync(db);
        var alvo = await SeedFuncionarioAsync(db);
        await SeedRespostaAsync(db, cicloId, avaliador, alvo, 2.0m); // cat 1 gestor
        await svc.IniciarCalibragemAsync(cicloId, default);

        var decisor = Guid.NewGuid();
        var result = await svc.DecidirAsync(cicloId, decisor, new AvaliacaoCalibragemDecisaoRequest(
            FuncionarioId: alvo,
            Versao: AvaliacaoCalibragemVersao.Gestor,
            Observacao: null,
            GerarNineBox: false), default);

        Assert.Equal(AvaliacaoCalibragemVersao.Gestor, result.Decisao);
        Assert.Null(result.NineBoxAssessmentId);
    }

    [Fact]
    public async Task Decidir_VersaoIndefinida_LancaErro()
    {
        var (db, svc) = CreateService();
        var cicloId = await SeedCicloAsync(db);
        var alvo = await SeedFuncionarioAsync(db);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.DecidirAsync(cicloId, Guid.NewGuid(), new AvaliacaoCalibragemDecisaoRequest(
                alvo, AvaliacaoCalibragemVersao.Indefinida, null), default));
    }

    [Fact]
    public async Task Ajustar_Decidido_LancaErro()
    {
        var (db, svc) = CreateService();
        var cicloId = await SeedCicloAsync(db);
        var avaliador = await SeedFuncionarioAsync(db);
        var alvo = await SeedFuncionarioAsync(db);
        await SeedRespostaAsync(db, cicloId, avaliador, alvo, 3.0m);
        await svc.IniciarCalibragemAsync(cicloId, default);
        await svc.DecidirAsync(cicloId, Guid.NewGuid(), new AvaliacaoCalibragemDecisaoRequest(
            alvo, AvaliacaoCalibragemVersao.Gestor, null, GerarNineBox: false), default);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.AjustarAsync(cicloId, new AvaliacaoCalibragemAjusteRequest(alvo, 4.0m, null, null, null), default));
    }

    [Fact]
    public async Task Listar_OrdenaPorNomeEIncluiCargo()
    {
        var (db, svc) = CreateService();
        var cicloId = await SeedCicloAsync(db);

        var cargoId = Guid.NewGuid();
        db.JobPositions.Add(new JobPosition { Id = cargoId, TenantId = TenantId, Name = "Analista", Code = "ANL" });
        await db.SaveChangesAsync();

        var avaliador = await SeedFuncionarioAsync(db, "Avaliador");
        var bruno = new Funcionario { Id = Guid.NewGuid(), TenantId = TenantId, Name = "Bruno", Email = "b@test.local", Status = FuncionarioStatus.Active, JobPositionId = cargoId };
        var ana = new Funcionario { Id = Guid.NewGuid(), TenantId = TenantId, Name = "Ana", Email = "a@test.local", Status = FuncionarioStatus.Active, JobPositionId = cargoId };
        db.Funcionarios.AddRange(bruno, ana);
        await db.SaveChangesAsync();

        await SeedRespostaAsync(db, cicloId, avaliador, bruno.Id, 3.0m);
        await SeedRespostaAsync(db, cicloId, avaliador, ana.Id, 4.0m);
        await svc.IniciarCalibragemAsync(cicloId, default);

        var listagem = await svc.ListarAsync(cicloId, default);
        Assert.Equal("Ana", listagem[0].FuncionarioNome);
        Assert.Equal("Bruno", listagem[1].FuncionarioNome);
        Assert.Equal("Analista", listagem[0].Cargo);
    }
}
