using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
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
}
