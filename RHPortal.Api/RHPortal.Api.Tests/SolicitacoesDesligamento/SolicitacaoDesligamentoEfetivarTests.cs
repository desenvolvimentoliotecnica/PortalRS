using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using RhPortal.Api.Application.Common;
using RhPortal.Api.Application.EntrevistasSaida;
using RhPortal.Api.Application.OcupacaoHistorico;
using RhPortal.Api.Application.SolicitacoesDesligamento;
using RhPortal.Api.Contracts.EntrevistasSaida;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Notifications;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Messaging.Email;
using Xunit;

namespace RhPortal.Api.Tests.SolicitacoesDesligamento;

public sealed class SolicitacaoDesligamentoEfetivarTests
{
    private const string TenantId = "tenant-desl-efetivar";

    private static (
        AppDbContext Db,
        SolicitacaoDesligamentoService Service,
        Mock<IEntrevistaSaidaService> EntrevistaMock,
        Mock<IOcupacaoHistoricoService> OcupacaoMock) CreateServices()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantId);

        var db = new AppDbContext(options, tenantMock.Object);

        var userMock = new Mock<ICurrentUserContext>();
        userMock.Setup(x => x.UserId).Returns(Guid.NewGuid());

        var emailMock = new Mock<IEmailQueueService>();
        var notificationsMock = new Mock<NotificationPublisher>(
            MockBehavior.Loose,
            null!,
            null!,
            null!);

        var workflow = new ApprovalWorkflowHelper(db, tenantMock.Object, notificationsMock.Object);
        var statusHistorico = new StatusHistoricoService(db, tenantMock.Object);

        var entrevistaMock = new Mock<IEntrevistaSaidaService>();
        var ocupacaoMock = new Mock<IOcupacaoHistoricoService>();

        var sp = new ServiceCollection().BuildServiceProvider();

        var service = new SolicitacaoDesligamentoService(
            db,
            tenantMock.Object,
            userMock.Object,
            workflow,
            emailMock.Object,
            entrevistaMock.Object,
            ocupacaoMock.Object,
            sp,
            statusHistorico);

        return (db, service, entrevistaMock, ocupacaoMock);
    }

    private static async Task<(Guid SolicitacaoId, Guid FuncionarioId)> SeedAprovadaAsync(AppDbContext db)
    {
        var funcionarioId = Guid.NewGuid();
        var solicitacaoId = Guid.NewGuid();
        var solicitanteId = Guid.NewGuid();

        db.Set<Funcionario>().AddRange(
            new Funcionario
            {
                Id = solicitanteId,
                TenantId = TenantId,
                Name = "Solicitante",
                Email = "solicitante@test.local",
                Status = FuncionarioStatus.Active,
            },
            new Funcionario
            {
                Id = funcionarioId,
                TenantId = TenantId,
                Name = "Colaborador",
                Email = "colaborador@test.local",
                Status = FuncionarioStatus.Active,
            });

        db.SolicitacoesDesligamento.Add(new SolicitacaoDesligamento
        {
            Id = solicitacaoId,
            TenantId = TenantId,
            SolicitanteId = solicitanteId,
            FuncionarioId = funcionarioId,
            DataDesligamento = DateOnly.FromDateTime(DateTime.UtcNow),
            MotivoDesligamento = "Teste",
            TipoDesligamento = TipoDesligamento.PedidoDemissao,
            TipoAvisoPrevio = TipoAvisoPrevio.Dispensado,
            DiasAvisoPrevio = 30,
            Status = SolicitacaoStatus.Aprovada,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        });

        await db.SaveChangesAsync();
        return (solicitacaoId, funcionarioId);
    }

    [Fact]
    public async Task EfetivarAsync_SemEntrevistaRespondida_LancaErro()
    {
        var (db, service, entrevistaMock, _) = CreateServices();
        var (solicitacaoId, funcionarioId) = await SeedAprovadaAsync(db);

        entrevistaMock
            .Setup(x => x.GetStatusBatchAsync(
                It.IsAny<IReadOnlyList<(Guid DesligamentoId, Guid FuncionarioId)>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, EntrevistaSaidaGridStatus>
            {
                [solicitacaoId] = new(EntrevistaSaidaStatusCode.Enviada, DateTimeOffset.UtcNow, null),
            });

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.EfetivarAsync(solicitacaoId, CancellationToken.None));

        Assert.Contains("entrevista de saída", ex.Message, StringComparison.OrdinalIgnoreCase);

        var entity = await db.SolicitacoesDesligamento.SingleAsync();
        Assert.Equal(SolicitacaoStatus.Aprovada, entity.Status);
    }

    [Fact]
    public async Task EfetivarAsync_ComEntrevistaRespondida_ConcluiInativaELiberaHeadcount()
    {
        var (db, service, entrevistaMock, ocupacaoMock) = CreateServices();
        var (solicitacaoId, funcionarioId) = await SeedAprovadaAsync(db);

        entrevistaMock
            .Setup(x => x.GetStatusBatchAsync(
                It.IsAny<IReadOnlyList<(Guid DesligamentoId, Guid FuncionarioId)>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, EntrevistaSaidaGridStatus>
            {
                [solicitacaoId] = new(
                    EntrevistaSaidaStatusCode.Respondida,
                    DateTimeOffset.UtcNow.AddDays(-1),
                    DateTimeOffset.UtcNow),
            });

        var result = await service.EfetivarAsync(solicitacaoId, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(SolicitacaoStatus.Concluida, result!.Status);

        var entity = await db.SolicitacoesDesligamento.SingleAsync();
        Assert.Equal(SolicitacaoStatus.Concluida, entity.Status);

        var funcionario = await db.Set<Funcionario>().SingleAsync(f => f.Id == funcionarioId);
        Assert.Equal(FuncionarioStatus.Inactive, funcionario.Status);

        ocupacaoMock.Verify(
            x => x.FecharOcupacaoAsync(
                funcionarioId,
                MotivoSaidaOcupacao.Desligamento,
                solicitacaoId,
                It.IsAny<CancellationToken>()),
            Times.Once);
    }
}
