using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using RhPortal.Api.Application.ItaloIntegracao;
using RhPortal.Api.Application.PreAdmissao;
using RhPortal.Api.Contracts.PreAdmissao;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Storage;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Messaging.Email;
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
            userStore.Object, null, null, null, null, null, null, null, null);

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

        var service = new PreAdmissaoService(
            db, tenantMock.Object, userManager.Object,
            emailQueue.Object, italoService.Object, storageMock.Object, logger.Object,
            httpAccessor.Object);

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
