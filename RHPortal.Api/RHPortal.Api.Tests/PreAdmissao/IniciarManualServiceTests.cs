using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using RhPortal.Api.Application.Blip;
using RhPortal.Api.Application.ItaloIntegracao;
using RhPortal.Api.Application.OcupacaoHistorico;
using RhPortal.Api.Application.PreAdmissao;
using RhPortal.Api.Contracts.PreAdmissao;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Storage;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Messaging.Email;
using RHPortal.Api.Domain.Enums;
using Xunit;

namespace RhPortal.Api.Tests.PreAdmissao;

/// <summary>
/// Testes para PreAdmissaoService.IniciarManualAsync e upload/exclusão de documentos via S3.
/// </summary>
public sealed class IniciarManualServiceTests
{
    private const string TenantTeste = "tenant-teste";

    // ── factory ──────────────────────────────────────────────────────────────

    private static (AppDbContext Db, PreAdmissaoService Service, Mock<IS3StorageService> StorageMock)
        CriarServico(string tenantId = TenantTeste)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(tenantId);

        var db = new AppDbContext(options, tenantMock.Object);

        var userStore = new Mock<IUserStore<ApplicationUser>>();
        var userManager = new Mock<UserManager<ApplicationUser>>(
            userStore.Object, null!, null!, null!, null!, null!, null!, null!, null!);

        userManager
            .Setup(x => x.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync((ApplicationUser?)null);
        userManager
            .Setup(x => x.CreateAsync(It.IsAny<ApplicationUser>(), It.IsAny<string>()))
            .ReturnsAsync(IdentityResult.Failed());

        var emailQueue = new Mock<IEmailQueueService>();
        var italoService = new Mock<IItaloIntegrationService>();

        var storageMock = new Mock<IS3StorageService>();
        storageMock
            .Setup(x => x.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Stream _, string key, string _, CancellationToken _) => key);
        storageMock
            .Setup(x => x.GetPresignedUrl(It.IsAny<string>(), It.IsAny<TimeSpan?>()))
            .Returns("https://s3.mock/presigned");
        storageMock
            .Setup(x => x.DeleteAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var logger = new Mock<ILogger<PreAdmissaoService>>();
        var httpAccessor = new Mock<IHttpContextAccessor>();
        var ocupacaoService = new Mock<IOcupacaoHistoricoService>();
        var hostEnvironment = new Mock<Microsoft.Extensions.Hosting.IHostEnvironment>();
        hostEnvironment.Setup(x => x.ContentRootPath).Returns(Path.GetTempPath());
        var httpClientFactory = new Mock<IHttpClientFactory>();
        var blipMessaging = new BlipMessagingService(
            db,
            httpClientFactory.Object,
            new Mock<ILogger<BlipMessagingService>>().Object);

        var service = new PreAdmissaoService(
            db, tenantMock.Object, userManager.Object,
            emailQueue.Object, italoService.Object, storageMock.Object, logger.Object,
            httpAccessor.Object,
            ocupacaoService.Object,
            blipMessaging,
            new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build(),
            hostEnvironment.Object,
            httpClientFactory.Object);

        return (db, service, storageMock);
    }

    private static Guid SeedCandidato(
        AppDbContext db,
        CandidateStatus status = CandidateStatus.Aprovado,
        string tenantId = TenantTeste)
    {
        var candidato = new Candidato
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Nome = "João da Silva",
            Email = "joao@exemplo.com",
            Fone = "11999999999",
            Status = status,
        };
        db.Set<Candidato>().Add(candidato);
        db.SaveChanges();
        return candidato.Id;
    }

    private static (Guid CandidatoId, Guid VagaId, Guid CandidaturaId) SeedCandidatoComCandidaturaEmProposta(
        AppDbContext db,
        string tenantId = TenantTeste)
    {
        var vaga = new global::RHPortal.Api.Domain.Entities.Vaga
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Titulo = "Analista de Infraestrutura SR",
            Status = VagaStatus.Aberta,
        };
        db.Vagas.Add(vaga);

        var candidato = new Candidato
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Nome = "João da Silva",
            Email = "joao@exemplo.com",
            Fone = "11999999999",
            Status = CandidateStatus.Aprovado,
            VagaId = vaga.Id,
        };
        db.Set<Candidato>().Add(candidato);

        var candidatura = new Candidatura
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CandidatoId = candidato.Id,
            VagaId = vaga.Id,
            Status = CandidaturaStatus.Ativa,
            EtapaMacro = EtapaMacroCandidatura.Proposta,
            AplicadaEmUtc = DateTimeOffset.UtcNow,
            EtapaAtualDesdeUtc = DateTimeOffset.UtcNow,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        db.Candidaturas.Add(candidatura);
        db.SaveChanges();

        return (candidato.Id, vaga.Id, candidatura.Id);
    }

    // ── IniciarManualAsync ────────────────────────────────────────────────────

    [Fact]
    public async Task IniciarManual_CandidatoAprovado_CriaPreAdmissaoEmRascunho()
    {
        var (db, svc, _) = CriarServico();
        var candidatoId = SeedCandidato(db);

        var result = await svc.IniciarManualAsync(
            new IniciarManualRequest(candidatoId, null, null, null, null, null, null),
            CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(PreAdmissaoStatus.Rascunho, result.Status);
        Assert.NotEqual(Guid.Empty, result.Id);
    }

    [Fact]
    public async Task IniciarManual_CandidatoAprovado_PreencheDadosDoCandidato()
    {
        var (db, svc, _) = CriarServico();
        var candidatoId = SeedCandidato(db);

        var result = await svc.IniciarManualAsync(
            new IniciarManualRequest(candidatoId, null, null, null, null, null, null),
            CancellationToken.None);

        Assert.Equal("João da Silva", result.Nome);
        Assert.Equal("joao@exemplo.com", result.Email);
    }

    [Fact]
    public async Task IniciarManual_CandidatoNaoAprovado_AutoAprovaECriaPreAdmissao()
    {
        var (db, svc, _) = CriarServico();
        var candidatoId = SeedCandidato(db, CandidateStatus.Triagem);

        var result = await svc.IniciarManualAsync(
            new IniciarManualRequest(candidatoId, null, null, null, null, null, null),
            CancellationToken.None);

        Assert.NotNull(result);
        var c = await db.Candidatos.IgnoreQueryFilters().FirstAsync(x => x.Id == candidatoId);
        Assert.Equal(CandidateStatus.Aprovado, c.Status);
    }

    [Fact]
    public async Task IniciarManual_CandidaturaEmProposta_MarcaComoContratado()
    {
        var (db, svc, _) = CriarServico();
        var (candidatoId, _, candidaturaId) = SeedCandidatoComCandidaturaEmProposta(db);

        await svc.IniciarManualAsync(
            new IniciarManualRequest(candidatoId, null, null, null, null, null, null),
            CancellationToken.None);

        var candidatura = await db.Candidaturas.FirstAsync(c => c.Id == candidaturaId);
        Assert.Equal(CandidaturaStatus.Contratado, candidatura.Status);
        Assert.Equal(EtapaMacroCandidatura.Contratado, candidatura.EtapaMacro);
        Assert.NotNull(candidatura.EtapaAtualDesdeUtc);
        Assert.Contains(await db.Set<CandidaturaEtapaHistorico>().ToListAsync(), h =>
            h.CandidaturaId == candidaturaId
            && h.EtapaAnterior == EtapaMacroCandidatura.Proposta
            && h.EtapaNova == EtapaMacroCandidatura.Contratado
            && h.Observacao == "Pré-admissão iniciada pelo RH.");
    }

    [Fact]
    public async Task IniciarManual_CandidatoInexistente_LancaInvalidOperationException()
    {
        var (_, svc, _) = CriarServico();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.IniciarManualAsync(
                new IniciarManualRequest(Guid.NewGuid(), null, null, null, null, null, null),
                CancellationToken.None));
    }

    [Fact]
    public async Task IniciarManual_TenantId_HerdadoDoContexto()
    {
        var (db, svc, _) = CriarServico();
        var candidatoId = SeedCandidato(db);

        var result = await svc.IniciarManualAsync(
            new IniciarManualRequest(candidatoId, null, null, null, null, null, null),
            CancellationToken.None);

        var entity = await db.Set<Domain.Entities.PreAdmissao>()
            .IgnoreQueryFilters()
            .FirstAsync(x => x.Id == result.Id);

        Assert.Equal(TenantTeste, entity.TenantId);
    }

    [Fact]
    public async Task IniciarManual_PreenchidoPor_EhRH()
    {
        var (db, svc, _) = CriarServico();
        var candidatoId = SeedCandidato(db);

        var result = await svc.IniciarManualAsync(
            new IniciarManualRequest(candidatoId, null, null, null, null, null, null),
            CancellationToken.None);

        var entity = await db.Set<Domain.Entities.PreAdmissao>()
            .IgnoreQueryFilters()
            .FirstAsync(x => x.Id == result.Id);

        Assert.Equal(PreenchidoPor.RH, entity.PreenchidoPor);
    }

    [Fact]
    public async Task IniciarManual_ComPreAdmissaoPreenchidaAnterior_CriaNovaEmRascunho()
    {
        var (db, svc, _) = CriarServico();
        var candidatoId = SeedCandidato(db);

        db.Set<Domain.Entities.PreAdmissao>().Add(new Domain.Entities.PreAdmissao
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            CandidatoId = candidatoId,
            Nome = "João da Silva",
            Status = PreAdmissaoStatus.Preenchido,
            PreenchidoPor = PreenchidoPor.Candidato,
            CreatedAtUtc = DateTimeOffset.UtcNow.AddDays(-30),
            UpdatedAtUtc = DateTimeOffset.UtcNow.AddDays(-30),
        });
        await db.SaveChangesAsync();

        var result = await svc.IniciarManualAsync(
            new IniciarManualRequest(candidatoId, null, null, null, null, null, null),
            CancellationToken.None);

        Assert.Equal(PreAdmissaoStatus.Rascunho, result.Status);
        var total = await db.Set<Domain.Entities.PreAdmissao>().CountAsync(x => x.CandidatoId == candidatoId);
        Assert.Equal(2, total);
    }

    [Fact]
    public async Task IniciarManual_ComRascunhoExistente_ReutilizaRegistro()
    {
        var (db, svc, _) = CriarServico();
        var candidatoId = SeedCandidato(db);

        var first = await svc.IniciarManualAsync(
            new IniciarManualRequest(candidatoId, null, null, null, null, null, null),
            CancellationToken.None);

        var second = await svc.IniciarManualAsync(
            new IniciarManualRequest(candidatoId, null, null, null, null, null, null),
            CancellationToken.None);

        Assert.Equal(first.Id, second.Id);
        var total = await db.Set<Domain.Entities.PreAdmissao>().CountAsync(x => x.CandidatoId == candidatoId);
        Assert.Equal(1, total);
    }

    // ── Upload de documento via S3 ────────────────────────────────────────────

    [Fact]
    public async Task UploadDocumento_ChamaS3UploadComChaveNoPatternEsperado()
    {
        var (db, svc, storageMock) = CriarServico();

        var preAdmissao = new Domain.Entities.PreAdmissao
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Status = PreAdmissaoStatus.Rascunho,
            PreenchidoPor = PreenchidoPor.RH,
            Nome = "Upload Test",
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        db.Set<Domain.Entities.PreAdmissao>().Add(preAdmissao);
        await db.SaveChangesAsync();

        var stream = new MemoryStream(new byte[] { 1, 2, 3 });

        await svc.UploadDocumentoAsync(
            preAdmissao.Id, TipoDocumento.RG,
            "rg.pdf", "application/pdf", stream.Length, stream,
            CancellationToken.None);

        storageMock.Verify(x => x.UploadAsync(
            It.IsAny<Stream>(),
            It.Is<string>(k => k.StartsWith($"{TenantTeste}/admissao/{preAdmissao.Id:N}/")),
            "application/pdf",
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UploadDocumento_PersisteLRegistroNoBanco()
    {
        var (db, svc, _) = CriarServico();

        var preAdmissao = new Domain.Entities.PreAdmissao
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Status = PreAdmissaoStatus.Rascunho,
            PreenchidoPor = PreenchidoPor.RH,
            Nome = "Upload Test",
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        db.Set<Domain.Entities.PreAdmissao>().Add(preAdmissao);
        await db.SaveChangesAsync();

        var stream = new MemoryStream(new byte[] { 1, 2, 3 });

        await svc.UploadDocumentoAsync(
            preAdmissao.Id, TipoDocumento.ComprovanteResidencia,
            "comprovante.pdf", "application/pdf", stream.Length, stream,
            CancellationToken.None);

        var docs = await db.Set<PreAdmissaoDocumento>()
            .Where(d => d.PreAdmissaoId == preAdmissao.Id)
            .ToListAsync();

        Assert.Single(docs);
        Assert.Equal(TipoDocumento.ComprovanteResidencia, docs[0].Tipo);
        Assert.Equal("comprovante.pdf", docs[0].NomeArquivo);
        Assert.False(string.IsNullOrWhiteSpace(docs[0].StoragePath));
    }

    [Fact]
    public async Task DeleteDocumento_ChamaS3DeleteERemoveRegistro()
    {
        var (db, svc, storageMock) = CriarServico();

        var preAdmissao = new Domain.Entities.PreAdmissao
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Status = PreAdmissaoStatus.Rascunho,
            PreenchidoPor = PreenchidoPor.RH,
            Nome = "Delete Test",
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        db.Set<Domain.Entities.PreAdmissao>().Add(preAdmissao);

        var storagePath = $"admissao/{TenantTeste}/{preAdmissao.Id}/rg.pdf";
        var doc = new PreAdmissaoDocumento
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            PreAdmissaoId = preAdmissao.Id,
            Tipo = TipoDocumento.RG,
            NomeArquivo = "rg.pdf",
            ContentType = "application/pdf",
            TamanhoBytes = 100,
            StoragePath = storagePath,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        db.Set<PreAdmissaoDocumento>().Add(doc);
        await db.SaveChangesAsync();

        var deleted = await svc.DeleteDocumentoAsync(preAdmissao.Id, doc.Id, CancellationToken.None);

        Assert.True(deleted);
        storageMock.Verify(x => x.DeleteAsync(storagePath, It.IsAny<CancellationToken>()), Times.Once);

        var remaining = await db.Set<PreAdmissaoDocumento>()
            .Where(d => d.Id == doc.Id)
            .ToListAsync();
        Assert.Empty(remaining);
    }

    [Fact]
    public async Task DeleteDocumento_DocInexistente_RetornaFalse()
    {
        var (_, svc, storageMock) = CriarServico();

        var deleted = await svc.DeleteDocumentoAsync(Guid.NewGuid(), Guid.NewGuid(), CancellationToken.None);

        Assert.False(deleted);
        storageMock.Verify(x => x.DeleteAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetById_Documentos_RetornamComPresignedUrl()
    {
        var (db, svc, _) = CriarServico();

        var preAdmissao = new Domain.Entities.PreAdmissao
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Status = PreAdmissaoStatus.Rascunho,
            PreenchidoPor = PreenchidoPor.RH,
            Nome = "PresignedUrl Test",
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        db.Set<Domain.Entities.PreAdmissao>().Add(preAdmissao);

        db.Set<PreAdmissaoDocumento>().Add(new PreAdmissaoDocumento
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            PreAdmissaoId = preAdmissao.Id,
            Tipo = TipoDocumento.RG,
            NomeArquivo = "rg.pdf",
            ContentType = "application/pdf",
            TamanhoBytes = 100,
            StoragePath = $"admissao/{TenantTeste}/{preAdmissao.Id}/rg.pdf",
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var result = await svc.GetByIdAsync(preAdmissao.Id, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Single(result.Documentos);
        Assert.Equal("https://s3.mock/presigned", result.Documentos[0].PresignedUrl);
    }
}
