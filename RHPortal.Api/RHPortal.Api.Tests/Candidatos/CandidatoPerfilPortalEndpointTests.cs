using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Hosting;
using Moq;
using RhPortal.Api.Application.Candidatos;
using RhPortal.Api.Application.Candidatos.Handlers;
using RhPortal.Api.Contracts.Candidatos;
using RhPortal.Api.Contracts.Candidates;
using RhPortal.Api.Contracts.Portal;
using RhPortal.Api.Controllers;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RHPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Messaging.Email;
using Xunit;

namespace RhPortal.Api.Tests.Candidatos;

/// <summary>
/// Testes de <see cref="CandidatosController.GetPerfilPortal"/> — autorização espelhando
/// <see cref="CandidatosController.GetById"/> e agregado retornado pelo reader.
/// </summary>
public sealed class CandidatoPerfilPortalEndpointTests
{
    private const string TenantTeste = "tenant-perfil-portal";

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantTeste);

        return new AppDbContext(options, tenantMock.Object);
    }

    private static CandidatosController CreateController(
        AppDbContext db,
        ICurrentUserContext userContext)
    {
        var localizer = new Mock<IStringLocalizer<ControllerMessages>>();
        localizer.Setup(x => x[It.IsAny<string>()])
            .Returns<string>(k => new LocalizedString(k, k));

        return new CandidatosController(localizer.Object, userContext)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
        };
    }

    private static PortalCandidatesController CreatePortalController()
    {
        var localizer = new Mock<IStringLocalizer<ControllerMessages>>();
        localizer.Setup(x => x[It.IsAny<string>()])
            .Returns<string>(k => new LocalizedString(k, k));

        return new PortalCandidatesController(localizer.Object)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
        };
    }

    private static ICurrentUserContext CreateUserContext(
        bool isAdmin = false,
        bool isOwner = false,
        Guid? userId = null,
        VagasDataScope scope = VagasDataScope.All,
        Guid? centroCustoId = null)
    {
        var m = new Mock<ICurrentUserContext>();
        m.Setup(x => x.IsAdmin).Returns(isAdmin);
        m.Setup(x => x.IsInRole(It.Is<string>(r => r == "Owner"))).Returns(isOwner);
        m.Setup(x => x.UserId).Returns(userId);
        m.Setup(x => x.VagasDataScope).Returns(scope);
        m.Setup(x => x.CentroCustoId).Returns(centroCustoId);
        return m.Object;
    }

    private static CandidateResponse DummyCandidate(
        Guid id,
        Guid? vagaId = null,
        Guid? vagaAreaId = null,
        Guid? vagaRecrutadorResponsavelUserId = null) =>
        new(
            id,
            Nome: "Fulano",
            Email: "a@b.com",
            Fone: null,
            Celular: "11",
            Cidade: null,
            Uf: null,
            LinkedinUrl: null,
            Fonte: CandidateOrigin.Site,
            Status: CandidateStatus.Novo,
            TrabalhandoAtualmente: null,
            PretensaoSalarial: null,
            VagaId: vagaId,
            VagaCodigo: null,
            VagaTitulo: null,
            VagaAreaId: vagaAreaId,
            VagaRecrutadorResponsavelUserId: vagaRecrutadorResponsavelUserId,
            TalentoId: null,
            Obs: null,
            ResumoProfissional: null,
            CvText: null,
            LastMatch: null,
            Documentos: Array.Empty<CandidateDocumentoResponse>(),
            ApplicationRecruiterUserId: null,
            ApplicationRecruiterUserName: null,
            CreatedAtUtc: DateTimeOffset.UtcNow,
            UpdatedAtUtc: DateTimeOffset.UtcNow);

    private static CandidatoPortalPerfilCompletoResponse DummyPerfil(Guid candidatoId) =>
        new(
            PerfilBasico: new PortalCandidateProfileResponse(
                candidatoId,
                "Fulano",
                "a@b.com",
                Fone: null,
                Celular: null,
                Cidade: null,
                Uf: null,
                LinkedinUrl: null,
                ResumoProfissional: null,
                AvatarUrl: null,
                Curriculo: null,
                TrabalhandoAtualmente: null),
            SkillsPortfolio: new PortalCandidateSkillsPortfolioResponse(
                Array.Empty<PortalCandidateSkillDto>(),
                Array.Empty<PortalCandidateCertificationDto>(),
                new PortalCandidatePortfolioLinksDto(null, null, null, null),
                new PortalCandidatePortfolioPrefsDto(null, null, null, null, null),
                Tags: null),
            Education: new PortalCandidateEducationResponse(
                new PortalCandidateEducationSummaryDto(null, null, null, null, null),
                Array.Empty<PortalCandidateEducationItemDto>()),
            Preferences: new PortalCandidatePreferencesResponse(
                null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
                null),
            Accessibility: new PortalCandidateAccessibilityDto(
                null, null, null, null,
                false, false, false, false, false, false,
                null, false, null, null, null, null,
                DateTimeOffset.UtcNow),
            Agenda: new PortalCandidateAgendaResponse(
                new PortalCandidateAgendaPreferencesDto(
                    null, null, null, null,
                    false, false, false, false, false, false, false,
                    false, false, false,
                    null, null,
                    UpdatedAtUtc: DateTimeOffset.UtcNow),
                Array.Empty<PortalCandidateAgendaBlockDto>()),
            Notifications: new PortalCandidateNotificationsResponse(
                false, false, false, false,
                null, null, null, null,
                false,
                false, false, false, false, false, false,
                null, null, null, null, null,
                UpdatedAtUtc: null),
            PortalDocuments: new PortalCandidateDocumentsResponse(Array.Empty<PortalCandidateDocumentDto>()),
            Lgpd: new PortalCandidateLgpdResponse(
                false, false, false, null, null, false, false, null, null, null),
            References: new PortalCandidateReferencesResponse(Array.Empty<PortalCandidateReferenceDto>()),
            ExperienceProjects: new PortalCandidateExperienceProjectResponse(
                Array.Empty<PortalCandidateExperienceDto>(),
                Array.Empty<PortalCandidateProjectDto>()));

    private static IGetCandidatoByIdHandler HandlerReturning(CandidateResponse? item)
    {
        var m = new Mock<IGetCandidatoByIdHandler>();
        m.Setup(x => x.HandleAsync(It.IsAny<Guid>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(item);
        return m.Object;
    }

    private static ICandidatoPortalPerfilReader ReaderReturning(CandidatoPortalPerfilCompletoResponse? payload)
    {
        var m = new Mock<ICandidatoPortalPerfilReader>();
        m.Setup(x => x.GetCompletoAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(payload);
        return m.Object;
    }

    private static Mock<IEmailQueueService> EmailQueueMock()
    {
        var m = new Mock<IEmailQueueService>();
        m.Setup(x => x.EnqueueRawAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string?>(),
                It.IsAny<bool>(),
                It.IsAny<string?>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new EmailMessage { Id = Guid.NewGuid(), TenantId = TenantTeste, To = "teste@local", Subject = "Teste" });
        m.Setup(x => x.EnqueueRawAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string?>(),
                It.IsAny<IReadOnlyList<EmailAttachmentPayload>>(),
                It.IsAny<bool>(),
                It.IsAny<string?>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new EmailMessage { Id = Guid.NewGuid(), TenantId = TenantTeste, To = "teste@local", Subject = "Teste" });
        return m;
    }

    private static Mock<IEmailConfigService> EmailConfigMock(bool testRedirect = false)
    {
        var m = new Mock<IEmailConfigService>();
        m.Setup(x => x.GetDecryptedAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new EmailConfigDto
            {
                SmtpUseTestRedirect = testRedirect,
                SmtpTestRedirectAddress = testRedirect ? "qa@renderrh.local" : null,
            });
        return m;
    }

    [Fact]
    public async Task PortalProfile_Get_RetornaCelularDoCandidato()
    {
        await using var db = CreateDb();
        var ctl = CreatePortalController();
        var candidatoId = Guid.NewGuid();

        db.Candidatos.Add(new Candidato
        {
            Id = candidatoId,
            TenantId = TenantTeste,
            Nome = "Fulano",
            Email = "a@b.com",
            Fone = "(11) 3000-0000",
            Celular = "(11) 99999-0000",
        });
        await db.SaveChangesAsync();

        var tenant = new Mock<ITenantContext>();
        tenant.Setup(x => x.TenantId).Returns(TenantTeste);

        var result = await ctl.GetProfile(
            candidatoId,
            db,
            Mock.Of<IHostEnvironment>(),
            tenant.Object,
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var profile = Assert.IsType<PortalCandidateProfileResponse>(ok.Value);
        Assert.Equal("(11) 99999-0000", profile.Celular);
    }

    [Fact]
    public async Task PortalProfile_Update_PersisteCelularDoCandidato()
    {
        await using var db = CreateDb();
        var ctl = CreatePortalController();
        var candidatoId = Guid.NewGuid();

        db.Candidatos.Add(new Candidato
        {
            Id = candidatoId,
            TenantId = TenantTeste,
            Nome = "Fulano",
            Email = "a@b.com",
            Fone = "(11) 3000-0000",
            Celular = null,
            Cidade = "Santos",
            Uf = "SP",
        });
        await db.SaveChangesAsync();

        var tenant = new Mock<ITenantContext>();
        tenant.Setup(x => x.TenantId).Returns(TenantTeste);

        var result = await ctl.UpdateProfile(
            candidatoId,
            new PortalCandidateProfileUpdateRequest(
                "Fulano",
                "(11) 3000-0000",
                "(11) 99999-0000",
                "Santos",
                "SP",
                LinkedinUrl: null,
                ResumoProfissional: null,
                TrabalhandoAtualmente: null),
            db,
            notificationPublisher: null!,
            Mock.Of<IHostEnvironment>(),
            tenant.Object,
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var profile = Assert.IsType<PortalCandidateProfileResponse>(ok.Value);
        Assert.Equal("(11) 99999-0000", profile.Celular);
        Assert.Equal("(11) 99999-0000", await db.Candidatos.Where(c => c.Id == candidatoId).Select(c => c.Celular).SingleAsync());
    }

    [Fact]
    public async Task GetPerfilPortal_CandidatoInexistente_Retorna404()
    {
        await using var db = CreateDb();
        var id = Guid.NewGuid();
        var ctl = CreateController(db, CreateUserContext(isAdmin: true));

        var result = await ctl.GetPerfilPortal(
            id,
            db,
            ReaderReturning(DummyPerfil(id)),
            HandlerReturning(null),
            CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task GetPerfilPortal_Admin_Retorna200_ComAgregado()
    {
        await using var db = CreateDb();
        var ctl = CreateController(db, CreateUserContext(isAdmin: true));
        var id = Guid.NewGuid();
        var candidato = DummyCandidate(id, vagaId: Guid.NewGuid());
        var perfil = DummyPerfil(id);

        var result = await ctl.GetPerfilPortal(
            id,
            db,
            ReaderReturning(perfil),
            HandlerReturning(candidato),
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Same(perfil, ok.Value);
    }

    [Fact]
    public async Task GetPerfilPortal_EscopoArea_DiferenteDaVaga_SemAnalista_Retorna404()
    {
        await using var db = CreateDb();
        var areaUser = Guid.NewGuid();
        var areaVaga = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var ctl = CreateController(
            db,
            CreateUserContext(
                userId: userId,
                scope: VagasDataScope.ByArea,
                centroCustoId: areaUser));

        var id = Guid.NewGuid();
        var vagaId = Guid.NewGuid();
        var candidato = DummyCandidate(id, vagaId: vagaId, vagaAreaId: areaVaga);

        var result = await ctl.GetPerfilPortal(
            id,
            db,
            ReaderReturning(DummyPerfil(id)),
            HandlerReturning(candidato),
            CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task GetPerfilPortal_EscopoArea_DiferenteDaVaga_MasAnalistaDistribuido_Retorna200()
    {
        await using var db = CreateDb();
        var areaUser = Guid.NewGuid();
        var areaVaga = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var solicitanteId = Guid.NewGuid();
        var vagaId = Guid.NewGuid();

        db.Funcionarios.Add(new Funcionario
        {
            Id = solicitanteId,
            TenantId = TenantTeste,
            Name = "Solicitante",
        });
        db.SolicitacoesVaga.Add(new SolicitacaoVaga
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Titulo = "Solicitação teste",
            SolicitanteId = solicitanteId,
            VagaId = vagaId,
            AnalistaRhResponsavelUserId = userId,
        });
        await db.SaveChangesAsync();

        var ctl = CreateController(
            db,
            CreateUserContext(
                userId: userId,
                scope: VagasDataScope.ByArea,
                centroCustoId: areaUser));

        var id = Guid.NewGuid();
        var candidato = DummyCandidate(id, vagaId: vagaId, vagaAreaId: areaVaga);
        var perfil = DummyPerfil(id);

        var result = await ctl.GetPerfilPortal(
            id,
            db,
            ReaderReturning(perfil),
            HandlerReturning(candidato),
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Same(perfil, ok.Value);
    }

    [Fact]
    public async Task GetPerfilPortal_ReaderRetornaNull_Retorna404()
    {
        await using var db = CreateDb();
        var ctl = CreateController(db, CreateUserContext(isOwner: true));
        var id = Guid.NewGuid();
        var candidato = DummyCandidate(id);

        var result = await ctl.GetPerfilPortal(
            id,
            db,
            ReaderReturning(null),
            HandlerReturning(candidato),
            CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task SolicitarAtualizacaoDadosPortal_Admin_CriaMensagemInterna()
    {
        await using var db = CreateDb();
        var ctl = CreateController(db, CreateUserContext(isAdmin: true));
        var candidatoId = Guid.NewGuid();
        var vagaId = Guid.NewGuid();

        db.Vagas.Add(new RHPortal.Api.Domain.Entities.Vaga
        {
            Id = vagaId,
            TenantId = TenantTeste,
            Titulo = "Analista de Sistemas",
        });
        db.Candidatos.Add(new Candidato
        {
            Id = candidatoId,
            TenantId = TenantTeste,
            Nome = "Fulano",
            Email = "",
            Celular = "",
            VagaId = vagaId,
        });
        await db.SaveChangesAsync();

        var emailQueue = EmailQueueMock();
        var result = await ctl.SolicitarAtualizacaoDadosPortal(
            candidatoId,
            new SolicitarAtualizacaoDadosCandidatoRequest(
                vagaId,
                CandidaturaId: null,
                new[] { "e-mail", "celular" },
                Titulo: null,
                Mensagem: null),
            db,
            emailQueue.Object,
            EmailConfigMock(testRedirect: true).Object,
            Mock.Of<ILogger<CandidatosController>>(),
            CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        var dto = Assert.IsType<PortalCandidateInternalNotificationDto>(created.Value);
        Assert.Equal(candidatoId, dto.CandidatoId);
        Assert.Equal(new[] { "e-mail", "celular" }, dto.CamposPendentes);
        Assert.Equal(1, await db.CandidatoPortalNotificacoes.CountAsync());
        emailQueue.Verify(x => x.EnqueueRawAsync(
            "candidato-sem-email@renderrh.local",
            It.IsAny<string>(),
            It.Is<string>(body => body.Contains("e-mail") && body.Contains("celular")),
            It.IsAny<string?>(),
            true,
            "portal-candidato-completar-dados",
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task EnviarMensagemPortal_Admin_CriaNotificacaoEEnfileiraEmailComAnexo()
    {
        await using var db = CreateDb();
        var ctl = CreateController(db, CreateUserContext(isAdmin: true));
        var candidatoId = Guid.NewGuid();
        var vagaId = Guid.NewGuid();

        db.Vagas.Add(new RHPortal.Api.Domain.Entities.Vaga
        {
            Id = vagaId,
            TenantId = TenantTeste,
            Titulo = "Analista de Sistemas",
        });
        db.Candidatos.Add(new Candidato
        {
            Id = candidatoId,
            TenantId = TenantTeste,
            Nome = "Fulano",
            Email = "fulano@teste.local",
            VagaId = vagaId,
        });
        await db.SaveChangesAsync();

        var bytes = new byte[] { 1, 2, 3, 4 };
        var file = new FormFile(new MemoryStream(bytes), 0, bytes.Length, "anexos", "convite.pdf")
        {
            Headers = new HeaderDictionary(),
            ContentType = "application/pdf"
        };
        var emailQueue = EmailQueueMock();

        var result = await ctl.EnviarMensagemPortal(
            candidatoId,
            new EnviarMensagemCandidatoFormRequest
            {
                VagaId = vagaId,
                Assunto = "Convite para entrevista",
                Corpo = "Olá, seguem detalhes da próxima etapa.",
                Anexos = new List<IFormFile> { file }
            },
            db,
            emailQueue.Object,
            EmailConfigMock().Object,
            CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        var dto = Assert.IsType<PortalCandidateInternalNotificationDto>(created.Value);
        Assert.Equal("MensagemRh", dto.Tipo);
        Assert.Equal("Convite para entrevista", dto.Titulo);
        Assert.Equal("Olá, seguem detalhes da próxima etapa.", dto.Mensagem);
        Assert.Equal(1, await db.CandidatoPortalNotificacoes.CountAsync());
        emailQueue.Verify(x => x.EnqueueRawAsync(
            "fulano@teste.local",
            "Convite para entrevista",
            It.Is<string>(body => body.Contains("seguem detalhes")),
            It.IsAny<string?>(),
            It.Is<IReadOnlyList<EmailAttachmentPayload>>(a =>
                a.Count == 1
                && a[0].FileName == "convite.pdf"
                && a[0].ContentType == "application/pdf"
                && a[0].ContentBytes.SequenceEqual(bytes)),
            false,
            "portal-candidato-mensagem-rh",
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task EnviarMensagemPortal_AnexosAcimaDoLimite_RetornaBadRequest()
    {
        await using var db = CreateDb();
        var ctl = CreateController(db, CreateUserContext(isAdmin: true));
        var candidatoId = Guid.NewGuid();

        db.Candidatos.Add(new Candidato
        {
            Id = candidatoId,
            TenantId = TenantTeste,
            Nome = "Fulano",
            Email = "fulano@teste.local",
        });
        await db.SaveChangesAsync();

        var anexos = Enumerable.Range(1, 6)
            .Select(i => (IFormFile)new FormFile(new MemoryStream(new byte[] { 1 }), 0, 1, "anexos", $"a{i}.txt")
            {
                Headers = new HeaderDictionary(),
                ContentType = "text/plain"
            })
            .ToList();

        var result = await ctl.EnviarMensagemPortal(
            candidatoId,
            new EnviarMensagemCandidatoFormRequest
            {
                Assunto = "Teste",
                Corpo = "Mensagem",
                Anexos = anexos
            },
            db,
            EmailQueueMock().Object,
            EmailConfigMock().Object,
            CancellationToken.None);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Contains("no máximo", badRequest.Value?.ToString());
    }

    [Fact]
    public async Task PortalNotifications_ListReadResolve_AtualizaStatusDaMensagem()
    {
        await using var db = CreateDb();
        var ctl = CreatePortalController();
        var candidatoId = Guid.NewGuid();
        var notificationId = Guid.NewGuid();

        db.Candidatos.Add(new Candidato
        {
            Id = candidatoId,
            TenantId = TenantTeste,
            Nome = "Fulano",
            Email = "a@b.com",
            Celular = "11",
        });
        db.CandidatoPortalNotificacoes.Add(new CandidatoPortalNotificacao
        {
            Id = notificationId,
            TenantId = TenantTeste,
            CandidatoId = candidatoId,
            Tipo = "CompletarDados",
            Titulo = "Complete seus dados",
            Mensagem = "Atualize e-mail e celular.",
            CamposPendentesJson = "[\"e-mail\",\"celular\"]",
        });
        await db.SaveChangesAsync();

        var listResult = await ctl.GetPortalNotifications(candidatoId, db, CancellationToken.None);
        var listOk = Assert.IsType<OkObjectResult>(listResult.Result);
        var list = Assert.IsType<PortalCandidateInternalNotificationsResponse>(listOk.Value);
        Assert.Equal(1, list.Pendentes);
        Assert.Equal(1, list.NaoLidas);

        var readResult = await ctl.ReadPortalNotification(candidatoId, notificationId, db, CancellationToken.None);
        var readOk = Assert.IsType<OkObjectResult>(readResult.Result);
        var readDto = Assert.IsType<PortalCandidateInternalNotificationDto>(readOk.Value);
        Assert.NotNull(readDto.LidaEmUtc);
        Assert.Null(readDto.ResolvidaEmUtc);

        var resolveResult = await ctl.ResolvePortalNotification(candidatoId, notificationId, db, CancellationToken.None);
        var resolveOk = Assert.IsType<OkObjectResult>(resolveResult.Result);
        var resolveDto = Assert.IsType<PortalCandidateInternalNotificationDto>(resolveOk.Value);
        Assert.NotNull(resolveDto.LidaEmUtc);
        Assert.NotNull(resolveDto.ResolvidaEmUtc);
    }
}
