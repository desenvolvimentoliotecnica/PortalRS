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

public sealed class AvaliacaoConviteServiceTests
{
    private const string TenantId = "tenant-convite";

    private static (AppDbContext Db, AvaliacaoConviteService Service, Mock<IEmailQueueService> EmailMock) CreateService()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantId);

        var db = new AppDbContext(options, tenantMock.Object);
        var emailMock = new Mock<IEmailQueueService>();
        emailMock.Setup(x => x.EnqueueRawAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(),
                It.IsAny<bool>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new EmailMessage());

        var svc = new AvaliacaoConviteService(db, emailMock.Object, NullLogger<AvaliacaoConviteService>.Instance);
        return (db, svc, emailMock);
    }

    private static async Task<Funcionario> SeedFuncionarioAsync(AppDbContext db, string name, Guid? gestorId = null)
    {
        var f = new Funcionario
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            Name = name,
            Email = $"{name.ToLowerInvariant().Replace(' ', '.')}@test.local",
            Status = FuncionarioStatus.Active,
            GestorDiretoId = gestorId,
        };
        db.Funcionarios.Add(f);
        await db.SaveChangesAsync();
        return f;
    }

    private static async Task<Guid> SeedCicloAsync(AppDbContext db, AvaliacaoCicloStatus status = AvaliacaoCicloStatus.Aberto)
    {
        var ciclo = new AvaliacaoCiclo
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            Nome = "Ciclo Teste",
            Periodo = "Q2 2026",
            Status = status,
            CriadoEmUtc = DateTimeOffset.UtcNow,
            AtualizadoEmUtc = DateTimeOffset.UtcNow,
        };
        db.AvaliacaoCiclos.Add(ciclo);
        await db.SaveChangesAsync();
        return ciclo.Id;
    }

    [Fact]
    public async Task GerarConvites_IncluiAutoavaliacaoGestorParaDiretoEDiretoParaGestor_PorPadrao()
    {
        var (db, svc, _) = CreateService();
        var gestor = await SeedFuncionarioAsync(db, "Gestor");
        var direto1 = await SeedFuncionarioAsync(db, "Direto 1", gestor.Id);
        var direto2 = await SeedFuncionarioAsync(db, "Direto 2", gestor.Id);

        var cicloId = await SeedCicloAsync(db);

        var result = await svc.GerarConvitesAsync(cicloId, new AvaliacaoGerarConvitesRequest(EnviarEmail: false), default);

        var todos = await db.AvaliacaoConvites.AsNoTracking().ToListAsync();

        // 3 autoavaliações + 2 gestor→direto + 2 direto→gestor = 7
        Assert.Equal(7, todos.Count);
        Assert.Equal(3, todos.Count(c => c.Tipo == AvaliacaoConviteTipo.Autoavaliacao));
        Assert.Equal(2, todos.Count(c => c.Tipo == AvaliacaoConviteTipo.GestorParaDireto));
        Assert.Equal(2, todos.Count(c => c.Tipo == AvaliacaoConviteTipo.DiretoParaGestor));
        Assert.Equal(7, result.ConvitesCriados);
    }

    [Fact]
    public async Task GerarConvites_IncluirPares_GeraParesEntreMembrosDoMesmoGestor()
    {
        var (db, svc, _) = CreateService();
        var gestor = await SeedFuncionarioAsync(db, "Gestor");
        await SeedFuncionarioAsync(db, "Par A", gestor.Id);
        await SeedFuncionarioAsync(db, "Par B", gestor.Id);
        await SeedFuncionarioAsync(db, "Par C", gestor.Id);

        var cicloId = await SeedCicloAsync(db);

        await svc.GerarConvitesAsync(cicloId, new AvaliacaoGerarConvitesRequest(
            IncluirAutoavaliacao: false,
            IncluirGestorParaDireto: false,
            IncluirDiretoParaGestor: false,
            IncluirPares: true,
            EnviarEmail: false), default);

        var pares = await db.AvaliacaoConvites.Where(c => c.Tipo == AvaliacaoConviteTipo.Par).CountAsync();
        // 3 membros → 3 * 2 = 6 pares (cada um avalia os outros 2)
        Assert.Equal(6, pares);
    }

    [Fact]
    public async Task GerarConvites_EhIdempotente_DuplicatasSaoIgnoradas()
    {
        var (db, svc, _) = CreateService();
        var gestor = await SeedFuncionarioAsync(db, "Gestor");
        await SeedFuncionarioAsync(db, "Direto", gestor.Id);

        var cicloId = await SeedCicloAsync(db);

        var r1 = await svc.GerarConvitesAsync(cicloId, new AvaliacaoGerarConvitesRequest(EnviarEmail: false), default);
        var r2 = await svc.GerarConvitesAsync(cicloId, new AvaliacaoGerarConvitesRequest(EnviarEmail: false), default);

        Assert.True(r1.ConvitesCriados > 0);
        Assert.Equal(0, r2.ConvitesCriados);
        Assert.True(r2.ConvitesExistentesIgnorados > 0);
    }

    [Fact]
    public async Task GerarConvites_EnviarEmail_EnfileiraUmEmailPorAvaliador()
    {
        var (db, svc, emailMock) = CreateService();
        var gestor = await SeedFuncionarioAsync(db, "Gestor");
        await SeedFuncionarioAsync(db, "Direto 1", gestor.Id);
        await SeedFuncionarioAsync(db, "Direto 2", gestor.Id);

        var cicloId = await SeedCicloAsync(db);

        var result = await svc.GerarConvitesAsync(cicloId, new AvaliacaoGerarConvitesRequest(), default);

        // Avaliadores distintos: gestor + 2 diretos (cada um se autoavalia e avalia gestor).
        Assert.Equal(3, result.EmailsEnfileirados);
        emailMock.Verify(x => x.EnqueueRawAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(),
            true, "Desempenho.Convocacao", It.IsAny<CancellationToken>()), Times.Exactly(3));

        var notificados = await db.AvaliacaoConvites.CountAsync(c => c.NotificadoEmUtc != null);
        Assert.True(notificados > 0);
    }

    [Fact]
    public async Task GerarConvites_CicloFechado_LancaErro()
    {
        var (db, svc, _) = CreateService();
        await SeedFuncionarioAsync(db, "A");
        var cicloId = await SeedCicloAsync(db, AvaliacaoCicloStatus.Fechado);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.GerarConvitesAsync(cicloId, new AvaliacaoGerarConvitesRequest(EnviarEmail: false), default));
    }

    [Fact]
    public async Task MarcarRespondido_AtualizaStatusEData()
    {
        var (db, svc, _) = CreateService();
        var gestor = await SeedFuncionarioAsync(db, "Gestor");
        var direto = await SeedFuncionarioAsync(db, "Direto", gestor.Id);
        var cicloId = await SeedCicloAsync(db);

        await svc.GerarConvitesAsync(cicloId, new AvaliacaoGerarConvitesRequest(
            IncluirAutoavaliacao: false,
            IncluirDiretoParaGestor: false,
            IncluirPares: false,
            EnviarEmail: false), default);

        await svc.MarcarRespondidoAsync(cicloId, gestor.Id, direto.Id, default);

        var convite = await db.AvaliacaoConvites.AsNoTracking().SingleAsync();
        Assert.Equal(AvaliacaoConviteStatus.Respondido, convite.Status);
        Assert.NotNull(convite.RespondidoEmUtc);
    }

    [Fact]
    public async Task CancelarPendentes_TransitaTodosParaCancelado()
    {
        var (db, svc, _) = CreateService();
        var gestor = await SeedFuncionarioAsync(db, "Gestor");
        await SeedFuncionarioAsync(db, "Direto", gestor.Id);
        var cicloId = await SeedCicloAsync(db);

        await svc.GerarConvitesAsync(cicloId, new AvaliacaoGerarConvitesRequest(EnviarEmail: false), default);
        await svc.CancelarConvitesPendentesDoCicloAsync(cicloId, default);

        var pendentes = await db.AvaliacaoConvites.CountAsync(c => c.Status == AvaliacaoConviteStatus.Pendente);
        var cancelados = await db.AvaliacaoConvites.CountAsync(c => c.Status == AvaliacaoConviteStatus.Cancelado);
        Assert.Equal(0, pendentes);
        Assert.True(cancelados > 0);
    }

    [Fact]
    public async Task ListarPendentesDoAvaliador_SoRetornaDeCiclosAbertos()
    {
        var (db, svc, _) = CreateService();
        var gestor = await SeedFuncionarioAsync(db, "Gestor");
        await SeedFuncionarioAsync(db, "Direto", gestor.Id);

        var aberto = await SeedCicloAsync(db, AvaliacaoCicloStatus.Aberto);
        var rascunho = await SeedCicloAsync(db, AvaliacaoCicloStatus.Rascunho);

        await svc.GerarConvitesAsync(aberto, new AvaliacaoGerarConvitesRequest(EnviarEmail: false), default);
        await svc.GerarConvitesAsync(rascunho, new AvaliacaoGerarConvitesRequest(EnviarEmail: false), default);

        var pendentes = await svc.ListarPendentesDoAvaliadorAsync(gestor.Id, default);
        Assert.All(pendentes, p => Assert.Equal(aberto, p.CicloId));
        Assert.NotEmpty(pendentes);
    }
}
