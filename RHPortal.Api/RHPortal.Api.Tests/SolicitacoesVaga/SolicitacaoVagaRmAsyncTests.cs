using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using RhPortal.Api.Application.Common;
using RhPortal.Api.Application.IntegracaoTotvs;
using RhPortal.Api.Application.OcupacaoHistorico;
using RhPortal.Api.Application.Pessoas;
using RhPortal.Api.Application.PreAdmissao;
using RhPortal.Api.Application.PublicApproval;
using RhPortal.Api.Application.SolicitacoesVaga;
using RhPortal.Api.Application.Vagas;
using RhPortal.Api.Application.WorkflowRH;
using RhPortal.Api.Contracts.IntegracaoTotvs;
using RhPortal.Api.Contracts.Rm;
using RhPortal.Api.Contracts.SolicitacoesVaga;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Frontend;
using RhPortal.Api.Infrastructure.Notifications;
using RhPortal.Api.Infrastructure.Rm;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Messaging.Email;
using RHPortal.Api.Domain.Enums;
using Xunit;

namespace RhPortal.Api.Tests.SolicitacoesVaga;

public sealed class SolicitacaoVagaRmAsyncTests
{
    private const string TenantTeste = "tenant-rm-async";

    private static (AppDbContext Db, Mock<ITenantContext> TenantContext) CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantContext = new Mock<ITenantContext>();
        tenantContext.Setup(x => x.TenantId).Returns(TenantTeste);

        return (new AppDbContext(options, tenantContext.Object), tenantContext);
    }

    private static NotificationPublisher CreateNotifications(AppDbContext db)
    {
        var masterOptions = new DbContextOptionsBuilder<MasterDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var masterDb = new MasterDbContext(masterOptions);

        var hubCtx = new Mock<IHubContext<NotificationsHub>>();
        var hubClients = new Mock<IHubClients>();
        var clientProxy = new Mock<IClientProxy>();
        hubCtx.Setup(x => x.Clients).Returns(hubClients.Object);
        hubClients.Setup(x => x.Group(It.IsAny<string>())).Returns(clientProxy.Object);
        clientProxy
            .Setup(x => x.SendCoreAsync(It.IsAny<string>(), It.IsAny<object[]>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        return new NotificationPublisher(db, masterDb, hubCtx.Object);
    }

    private static SolicitacaoVagaService CreateSolicitacaoService(
        AppDbContext db,
        ITenantContext tenantContext,
        Mock<ISolicitacaoVagaRmIntegracaoService>? rmIntegracaoMock = null)
    {
        var vagaMock = new Mock<IVagaService>();
        var currentUserMock = new Mock<ICurrentUserContext>();
        currentUserMock.Setup(x => x.IsReadOnly).Returns(false);
        currentUserMock.Setup(x => x.IsAdmin).Returns(true);
        currentUserMock.Setup(x => x.VagasDataScope).Returns(VagasDataScope.All);
        currentUserMock.Setup(x => x.UserId).Returns((Guid?)null);
        currentUserMock.Setup(x => x.HasPermission(It.IsAny<string>())).Returns(false);

        var pessoaMock = new Mock<IPessoaService>();
        var notifications = CreateNotifications(db);
        var workflow = new ApprovalWorkflowHelper(db, tenantContext, notifications);

        var emailMock = new Mock<IEmailQueueService>();
        emailMock
            .Setup(e => e.EnqueueRawAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(),
                It.IsAny<bool>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new EmailMessage
            {
                Id = Guid.NewGuid(),
                TenantId = TenantTeste,
                To = "-",
                Subject = "-",
                BodyHtml = "<p>-</p>",
            });

        var magicMock = new Mock<IMagicLinkService>();
        magicMock
            .Setup(m => m.CreateAndSendAsync(
                It.IsAny<SolicitacaoAprovacaoEtapa>(), It.IsAny<TipoFluxoAprovacao>(), It.IsAny<Guid>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<CancellationToken>(), It.IsAny<bool>()))
            .Returns(Task.CompletedTask);

        var httpAccessor = new Mock<IHttpContextAccessor>();
        httpAccessor.Setup(h => h.HttpContext).Returns((HttpContext?)null);

        var serviceProvider = new Mock<IServiceProvider>();
        var statusHistorico = new StatusHistoricoService(db, tenantContext);

        rmIntegracaoMock ??= new Mock<ISolicitacaoVagaRmIntegracaoService>();
        rmIntegracaoMock
            .Setup(x => x.ExecutarCriacaoRequisicaoRmAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var frontendUrlMock = new Mock<IFrontendPublicUrlBuilder>();
        frontendUrlMock
            .Setup(x => x.BuildAbsoluteUrl(It.IsAny<string>()))
            .Returns((string p) => "http://frontend.test" + p);

        var recruiterNotifier = new SolicitacaoVagaRecrutadorNotifier(db, emailMock.Object, frontendUrlMock.Object);

        return new SolicitacaoVagaService(
            db,
            tenantContext,
            vagaMock.Object,
            currentUserMock.Object,
            pessoaMock.Object,
            notifications,
            workflow,
            emailMock.Object,
            magicMock.Object,
            httpAccessor.Object,
            serviceProvider.Object,
            statusHistorico,
            rmIntegracaoMock.Object,
            recruiterNotifier);
    }

    private static IntegracaoTotvsService CreatePainelService(AppDbContext db, ITenantContext tenantContext)
    {
        var ocupacao = new Mock<IOcupacaoHistoricoService>();
        var preAdmissao = new Mock<IPreAdmissaoService>();
        var emailQueue = new Mock<IEmailQueueService>();
        var rmIntegracao = new Mock<ISolicitacaoVagaRmIntegracaoService>();

        return new IntegracaoTotvsService(
            db,
            ocupacao.Object,
            preAdmissao.Object,
            new ApprovalWorkflowHelper(db, tenantContext, CreateNotifications(db)),
            emailQueue.Object,
            tenantContext,
            new StatusHistoricoService(db, tenantContext),
            rmIntegracao.Object);
    }

    private static (Guid FuncionarioId, Guid JobPositionId, Guid UnitId, Guid EmpresaId, Guid CentroCustoId, Guid MotivoId)
        SeedBaseCatalog(AppDbContext db)
    {
        var now = DateTimeOffset.UtcNow;

        var empresaId = Guid.NewGuid();
        db.Empresas.Add(new Empresa
        {
            Id = empresaId,
            TenantId = TenantTeste,
            Code = "01",
            Description = "Matriz",
            IsActive = true,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });

        var unitId = Guid.NewGuid();
        db.Units.Add(new Unit
        {
            Id = unitId,
            TenantId = TenantTeste,
            Code = "01",
            Name = "Matriz",
            Status = UnitStatus.Active,
            EmpresaId = empresaId,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });

        var centroCustoId = Guid.NewGuid();
        db.CentrosCusto.Add(new CentroCusto
        {
            Id = centroCustoId,
            TenantId = TenantTeste,
            Code = "01.01",
            Description = "Operações",
            IsActive = true,
            EmpresaId = empresaId,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });

        var jobPositionId = Guid.NewGuid();
        db.JobPositions.Add(new JobPosition
        {
            Id = jobPositionId,
            TenantId = TenantTeste,
            Code = "DIR",
            Name = "Diretor",
            Status = CargoStatus.Active,
            Seniority = SeniorityLevel.Pleno,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });

        var motivoId = Guid.NewGuid();
        db.MotivosRequisicaoVagaConfig.Add(new MotivoRequisicaoVagaConfig
        {
            Id = motivoId,
            TenantId = TenantTeste,
            Codigo = "EXPANSAO_BASE",
            Nome = "Expansão da Base",
            EfeitoHeadcount = EfeitoHeadcount.Aumenta,
            IsActive = true,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });

        var funcionarioId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        db.Users.Add(new ApplicationUser
        {
            Id = userId,
            TenantId = TenantTeste,
            Email = "solicitante@teste.com",
            UserName = "solicitante@teste.com",
            NormalizedEmail = "SOLICITANTE@TESTE.COM",
            NormalizedUserName = "SOLICITANTE@TESTE.COM",
            FullName = "Solicitante RM",
            IsActive = true,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        db.Funcionarios.Add(new Funcionario
        {
            Id = funcionarioId,
            TenantId = TenantTeste,
            Name = "Solicitante RM",
            Email = "solicitante@teste.com",
            Status = FuncionarioStatus.Active,
            UserId = userId,
            MatriculaRm = "00001",
            UnitId = unitId,
            CentroCustoId = centroCustoId,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });

        db.SaveChanges();
        return (funcionarioId, jobPositionId, unitId, empresaId, centroCustoId, motivoId);
    }

    private static SolicitacaoVaga SeedSolicitacaoAumentoQuadro(
        AppDbContext db,
        SolicitacaoStatus status,
        IntegracaoResultado? integracaoResultado = null,
        TipoSolicitacaoVaga tipoSolicitacao = TipoSolicitacaoVaga.AumentoQuadro)
    {
        var ids = SeedBaseCatalog(db);
        var now = DateTimeOffset.UtcNow;

        var entity = new SolicitacaoVaga
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            SolicitanteId = ids.FuncionarioId,
            JobPositionId = ids.JobPositionId,
            UnitId = ids.UnitId,
            EmpresaId = ids.EmpresaId,
            CentroCustoId = ids.CentroCustoId,
            Titulo = tipoSolicitacao == TipoSolicitacaoVaga.VagaNova ? "Vaga nova RM" : "Aumento quadro RM",
            CodFuncaoRm = "00001",
            FuncaoNomeRm = "Diretor",
            Justificativa = "Expansão do time",
            QtdPosicoes = 1,
            Urgencia = SolicitacaoVagaUrgencia.Alta,
            Status = status,
            TipoSolicitacao = tipoSolicitacao,
            TipoContrato = TipoContratoVaga.CLT,
            MotivoRequisicao = MotivoRequisicaoVaga.ExpansaoBase,
            MotivoRequisicaoId = ids.MotivoId,
            EscalaTrabalho = "5x2",
            DecisaoRH = TipoDecisaoHeadcount.AumentoDefinitivo,
            FaixaSalarialMin = 1000,
            FaixaSalarialMax = 1500,
            IntegracaoResultado = integracaoResultado,
            CreatedAtUtc = now.AddDays(-1),
            UpdatedAtUtc = now.AddHours(-2),
        };

        db.SolicitacoesVaga.Add(entity);
        db.SaveChanges();
        return entity;
    }

    [Fact]
    public async Task Create_AumentoQuadro_EnfileiraCriacaoRmSemBloquearSave()
    {
        var (db, tenantContext) = CreateDb();
        var service = CreateSolicitacaoService(db, tenantContext.Object);
        var ids = SeedBaseCatalog(db);

        var request = new SolicitacaoVagaCreateRequest
        {
            Titulo = "Aumento quadro teste",
            Justificativa = "Aumentar headcount",
            QtdPosicoes = 2,
            Urgencia = SolicitacaoVagaUrgencia.Alta,
            TipoSolicitacao = TipoSolicitacaoVaga.AumentoQuadro,
            TipoContrato = TipoContratoVaga.CLT,
            DecisaoRH = TipoDecisaoHeadcount.AumentoDefinitivo,
            JobPositionId = ids.JobPositionId,
            UnitId = ids.UnitId,
            EmpresaId = ids.EmpresaId,
            CentroCustoId = ids.CentroCustoId,
            MotivoRequisicaoId = ids.MotivoId,
            FaixaSalarialMin = 1200,
            FaixaSalarialMax = 1800,
            CodFuncaoRm = "00001",
            EscalaTrabalho = "5x2",
        };

        var result = await service.CreateAsync(request, ids.FuncionarioId, CancellationToken.None);
        var entity = await db.SolicitacoesVaga.FirstAsync(x => x.Id == result.Id);

        Assert.Equal(SolicitacaoStatus.PendenteAprovacao, result.Status);
        Assert.NotNull(entity.RmCriacaoSolicitadaEmUtc);
        Assert.Null(entity.IntegracaoResultado);
        Assert.Equal("Aguardando envio assíncrono da requisição ao RM.", entity.IntegracaoMensagem);
        Assert.Equal(0, entity.TentativasIntegracao);
    }

    [Fact]
    public async Task Create_VagaNova_EnfileiraCriacaoRmSemBloquearSave()
    {
        var (db, tenantContext) = CreateDb();
        var service = CreateSolicitacaoService(db, tenantContext.Object);
        var ids = SeedBaseCatalog(db);

        var request = new SolicitacaoVagaCreateRequest
        {
            Titulo = "Vaga nova teste",
            Justificativa = "Nova posição",
            QtdPosicoes = 1,
            Urgencia = SolicitacaoVagaUrgencia.Media,
            TipoSolicitacao = TipoSolicitacaoVaga.VagaNova,
            TipoContrato = TipoContratoVaga.CLT,
            DecisaoRH = TipoDecisaoHeadcount.AumentoDefinitivo,
            JobPositionId = ids.JobPositionId,
            UnitId = ids.UnitId,
            EmpresaId = ids.EmpresaId,
            CentroCustoId = ids.CentroCustoId,
            MotivoRequisicaoId = ids.MotivoId,
            FaixaSalarialMin = 1200,
            FaixaSalarialMax = 1800,
            CodFuncaoRm = "00001",
            EscalaTrabalho = "5x2",
        };

        var result = await service.CreateAsync(request, ids.FuncionarioId, CancellationToken.None);
        var entity = await db.SolicitacoesVaga.FirstAsync(x => x.Id == result.Id);

        Assert.NotNull(entity.RmCriacaoSolicitadaEmUtc);
        Assert.Null(entity.IntegracaoResultado);
        Assert.Equal("Aguardando envio assíncrono da requisição ao RM.", entity.IntegracaoMensagem);
        Assert.Equal(0, entity.TentativasIntegracao);
    }

    [Fact]
    public async Task ExecutarCriacaoRm_Sucesso_PersisteVinculoSemAlterarWorkflow()
    {
        var (db, tenantContext) = CreateDb();
        var entity = SeedSolicitacaoAumentoQuadro(db, SolicitacaoStatus.PendenteTriagem);
        entity.RmCriacaoSolicitadaEmUtc = DateTimeOffset.UtcNow.AddMinutes(-5);
        db.SaveChanges();

        var rmClient = new Mock<IRmRequisicaoCreateClient>();
        rmClient
            .Setup(x => x.EnviarOuObterJaCriadoAsync(It.IsAny<SolicitacaoVaga>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new RmCreateRequisicaoOutcome(
                true,
                false,
                null,
                6,
                null,
                200,
                1,
                290));

        var service = new SolicitacaoVagaRmIntegracaoService(
            db,
            tenantContext.Object,
            rmClient.Object,
            Options.Create(new RmRequisicaoCreateOptions { MaxTentativas = 3 }),
            new StatusHistoricoService(db, tenantContext.Object),
            Mock.Of<ICurrentUserContext>());

        await service.ExecutarCriacaoRequisicaoRmAsync(entity.Id, CancellationToken.None);

        var updated = await db.SolicitacoesVaga.FirstAsync(x => x.Id == entity.Id);
        Assert.Equal(SolicitacaoStatus.PendenteTriagem, updated.Status);
        Assert.Equal(IntegracaoResultado.Sucesso, updated.IntegracaoResultado);
        Assert.Equal((short)1, updated.RmCodColRequisicao);
        Assert.Equal(290, updated.RmIdReq);
        Assert.Equal("AUMENTO_QUADRO|1|290", updated.RmRequisicaoCodigo);
        Assert.Equal((short)6, updated.RmCodStatus);
        Assert.Equal(1, updated.TentativasIntegracao);
    }

    [Fact]
    public async Task ExecutarCriacaoRm_VagaNova_Sucesso_PersisteVinculoRm()
    {
        var (db, tenantContext) = CreateDb();
        var entity = SeedSolicitacaoAumentoQuadro(
            db,
            SolicitacaoStatus.Aprovada,
            tipoSolicitacao: TipoSolicitacaoVaga.VagaNova);
        entity.RmCriacaoSolicitadaEmUtc = DateTimeOffset.UtcNow.AddMinutes(-5);
        db.SaveChanges();

        var rmClient = new Mock<IRmRequisicaoCreateClient>();
        rmClient
            .Setup(x => x.EnviarOuObterJaCriadoAsync(It.IsAny<SolicitacaoVaga>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new RmCreateRequisicaoOutcome(
                true,
                false,
                null,
                6,
                null,
                200,
                1,
                291));

        var service = new SolicitacaoVagaRmIntegracaoService(
            db,
            tenantContext.Object,
            rmClient.Object,
            Options.Create(new RmRequisicaoCreateOptions { MaxTentativas = 3 }),
            new StatusHistoricoService(db, tenantContext.Object),
            Mock.Of<ICurrentUserContext>());

        await service.ExecutarCriacaoRequisicaoRmAsync(entity.Id, CancellationToken.None);

        var updated = await db.SolicitacoesVaga.FirstAsync(x => x.Id == entity.Id);
        Assert.Equal(SolicitacaoStatus.Aprovada, updated.Status);
        Assert.Equal(IntegracaoResultado.Sucesso, updated.IntegracaoResultado);
        Assert.Equal("AUMENTO_QUADRO|1|291", updated.RmRequisicaoCodigo);
        Assert.Equal(1, updated.TentativasIntegracao);
    }

    [Fact]
    public async Task ExecutarCriacaoRm_FalhaDefinitiva_NaoSobrescreveStatus()
    {
        var (db, tenantContext) = CreateDb();
        var entity = SeedSolicitacaoAumentoQuadro(db, SolicitacaoStatus.EmTriagem);
        entity.RmCriacaoSolicitadaEmUtc = DateTimeOffset.UtcNow.AddMinutes(-5);
        db.SaveChanges();

        var rmClient = new Mock<IRmRequisicaoCreateClient>();
        rmClient
            .Setup(x => x.EnviarOuObterJaCriadoAsync(It.IsAny<SolicitacaoVaga>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new RmCreateRequisicaoOutcome(false, false, null, null, "timeout", 504));

        var service = new SolicitacaoVagaRmIntegracaoService(
            db,
            tenantContext.Object,
            rmClient.Object,
            Options.Create(new RmRequisicaoCreateOptions { MaxTentativas = 1 }),
            new StatusHistoricoService(db, tenantContext.Object),
            Mock.Of<ICurrentUserContext>());

        await service.ExecutarCriacaoRequisicaoRmAsync(entity.Id, CancellationToken.None);

        var updated = await db.SolicitacoesVaga.FirstAsync(x => x.Id == entity.Id);
        Assert.Equal(SolicitacaoStatus.EmTriagem, updated.Status);
        Assert.Equal(IntegracaoResultado.FalhaDefinitiva, updated.IntegracaoResultado);
        Assert.Equal("timeout", updated.IntegracaoMensagem);
        Assert.Equal(1, updated.TentativasIntegracao);
        Assert.Null(updated.IntegradaEmUtc);
    }

    [Fact]
    public async Task SyncCodStatus_EmWorkflowInterno_ApenasAtualizaCamposRm()
    {
        var (db, tenantContext) = CreateDb();
        var entity = SeedSolicitacaoAumentoQuadro(db, SolicitacaoStatus.EmTriagem);
        entity.RmRequisicaoCodigo = "AUMENTO_QUADRO|1|290";
        db.SaveChanges();

        db.RmRequisicaoStatusMaps.Add(new RmRequisicaoStatusMap
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            CodStatusRm = 6,
            PortalStatusKey = nameof(SolicitacaoStatus.EmIntegracao),
            Priority = 1,
            CreatedAtUtc = DateTimeOffset.UtcNow,
        });
        db.SaveChanges();

        var rmRead = new Mock<IRmRequisicoesReadService>();
        rmRead
            .Setup(x => x.TryGetCodStatusByPortalCodigoAsync("AUMENTO_QUADRO|1|290", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new RmRequisicaoCodStatusSnapshot(6, "Cancelada", "AUMENTO_QUADRO", 1, 290));

        var syncRuns = new Mock<IRmSyncRunService>();
        syncRuns.Setup(x => x.StartAsync(It.IsAny<StartRmSyncRunRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Guid.NewGuid());
        syncRuns.Setup(x => x.FinishAsync(It.IsAny<Guid>(), It.IsAny<FinishRmSyncRunRequest>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var service = new SolicitacaoVagaRmCodStatusSyncService(
            db,
            tenantContext.Object,
            rmRead.Object,
            syncRuns.Object,
            new StatusHistoricoService(db, tenantContext.Object),
            Mock.Of<ILogger<SolicitacaoVagaRmCodStatusSyncService>>());

        var result = await service.RunBatchAsync(new RmSolicitacaoStatusSyncRequest(), 10, CancellationToken.None);

        var updated = await db.SolicitacoesVaga.FirstAsync(x => x.Id == entity.Id);
        Assert.Equal(1, result.Ignorados);
        Assert.Equal(SolicitacaoStatus.EmTriagem, updated.Status);
        Assert.Equal((short)6, updated.RmCodStatus);
        Assert.Equal("Cancelada", updated.RmUltimaStatusDescricaoRm);
        Assert.Contains("sem alterar o workflow interno", updated.RmStatusSyncUltimaMensagem);
    }

    [Fact]
    public async Task PainelSolicitacoesRm_ProjetaTentativasEIdentificadoresRm()
    {
        var (db, tenantContext) = CreateDb();
        var entity = SeedSolicitacaoAumentoQuadro(db, SolicitacaoStatus.PendenteTriagem, IntegracaoResultado.Falha);
        entity.RmCriacaoSolicitadaEmUtc = DateTimeOffset.UtcNow.AddHours(-3);
        entity.RmCodColRequisicao = 1;
        entity.RmIdReq = 290;
        entity.RmRequisicaoCodigo = "AUMENTO_QUADRO|1|290";
        entity.RmCodStatus = 6;
        entity.TentativasIntegracao = 2;
        entity.UltimaTentativaUtc = DateTimeOffset.UtcNow.AddMinutes(-30);
        entity.IntegracaoMensagem = "Timeout na criação";
        db.SaveChanges();

        var service = CreatePainelService(db, tenantContext.Object);

        var response = await service.ListPainelAsync(
            new IntegracaoTotvsPainelQuery(TipoIntegracao.SolicitacaoVaga, null, null, 0, 50),
            CancellationToken.None);

        var item = Assert.Single(response.Items);
        Assert.Equal((short)TipoIntegracao.SolicitacaoVaga, item.TipoIntegracao);
        Assert.Equal(2, item.TentativasIntegracao);
        Assert.Equal(290, item.RmIdReq);
        Assert.Equal((short)1, item.RmCodColRequisicao);
        Assert.Equal(nameof(SolicitacaoStatus.PendenteTriagem), item.Status);
    }
}
