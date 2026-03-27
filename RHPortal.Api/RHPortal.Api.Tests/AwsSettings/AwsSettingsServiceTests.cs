using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Moq;
using RhPortal.Api.Application.AwsSettings;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Storage;
using RhPortal.Api.Infrastructure.Tenancy;
using Xunit;

namespace RhPortal.Api.Tests.AwsSettings;

/// <summary>
/// Testes para AwsSettingsService — GetView, Save, GetDecrypted, mascaramento e fallback.
/// </summary>
public sealed class AwsSettingsServiceTests
{
    private const string TenantTeste = "tenant-teste";

    // ── factory ──────────────────────────────────────────────────────────────

    /// <summary>
    /// Protector simples que faz round-trip "encrypt" / "decrypt" sem criptografia real,
    /// permitindo verificar que os valores corretos são persistidos e recuperados.
    /// </summary>
    private sealed class FakeProtector : ISecretProtector
    {
        public string Encrypt(string plainText) => $"ENC:{plainText}";
        public string Decrypt(string cipherText)
            => cipherText.StartsWith("ENC:") ? cipherText[4..] : cipherText;
    }

    private static (AppDbContext Db, AwsSettingsService Service) CriarServico(
        string tenantId = TenantTeste,
        AwsOptions? fallback = null)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(tenantId);

        var db = new AppDbContext(options, tenantMock.Object);

        var fallbackOptions = Options.Create(fallback ?? new AwsOptions());
        var service = new AwsSettingsService(db, new FakeProtector(), tenantMock.Object, fallbackOptions);

        return (db, service);
    }

    // ── GetViewAsync ──────────────────────────────────────────────────────────

    [Fact]
    public async Task GetView_SemRegistroNoBanco_RetornaViewVazia()
    {
        var (_, svc) = CriarServico();

        var view = await svc.GetViewAsync(CancellationToken.None);

        Assert.Null(view.AccessKeyIdMasked);
        Assert.False(view.HasSecretAccessKey);
        Assert.False(view.IsConfigured);
        Assert.Equal(15, view.PresignedUrlExpirationMinutes);
    }

    [Fact]
    public async Task GetView_ComRegistroCompleto_IsConfiguredTrue()
    {
        var (db, svc) = CriarServico();

        // Persiste direto no banco para simular configuração já salva
        db.Set<TenantAwsSettings>().Add(new TenantAwsSettings
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            AccessKeyIdEncrypted = "ENC:AKIAIOSFODNN7EXAMPLE",
            SecretAccessKeyEncrypted = "ENC:wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            Region = "us-east-2",
            BucketName = "meu-bucket",
            PresignedUrlExpirationMinutes = 30,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var view = await svc.GetViewAsync(CancellationToken.None);

        Assert.True(view.IsConfigured);
        Assert.True(view.HasSecretAccessKey);
        Assert.Equal("us-east-2", view.Region);
        Assert.Equal("meu-bucket", view.BucketName);
        Assert.Equal(30, view.PresignedUrlExpirationMinutes);
    }

    // ── Mascaramento de AccessKeyId ───────────────────────────────────────────

    [Fact]
    public async Task GetView_AccessKeyId_MascaraUltimos4Caracteres()
    {
        var (db, svc) = CriarServico();

        db.Set<TenantAwsSettings>().Add(new TenantAwsSettings
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            AccessKeyIdEncrypted = "ENC:AKIAIOSFODNN7ABCD",
            BucketName = "b",
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var view = await svc.GetViewAsync(CancellationToken.None);

        // Últimos 4 chars de "AKIAIOSFODNN7ABCD" = "ABCD"
        Assert.Equal("••••••••ABCD", view.AccessKeyIdMasked);
    }

    [Fact]
    public async Task GetView_SemAccessKeyId_MascaradoEhNull()
    {
        var (db, svc) = CriarServico();

        db.Set<TenantAwsSettings>().Add(new TenantAwsSettings
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            BucketName = "b",
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var view = await svc.GetViewAsync(CancellationToken.None);

        Assert.Null(view.AccessKeyIdMasked);
    }

    // ── SaveAsync ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Save_NovoRegistro_PersisteCriptografado()
    {
        var (db, svc) = CriarServico();

        await svc.SaveAsync(new AwsSettingsDto
        {
            AccessKeyId = "AKIAIOSFODNN7EXAMPLE",
            SecretAccessKey = "minha-chave-secreta",
            Region = "us-east-2",
            BucketName = "renderrh-bucket",
            PresignedUrlExpirationMinutes = 20,
        }, CancellationToken.None);

        var entity = await db.Set<TenantAwsSettings>()
            .AsNoTracking()
            .FirstAsync(x => x.TenantId == TenantTeste);

        // FakeProtector prefixou com "ENC:" — garante que foi criptografado
        Assert.StartsWith("ENC:", entity.AccessKeyIdEncrypted);
        Assert.StartsWith("ENC:", entity.SecretAccessKeyEncrypted);
        Assert.Equal("us-east-2", entity.Region);
        Assert.Equal("renderrh-bucket", entity.BucketName);
        Assert.Equal(20, entity.PresignedUrlExpirationMinutes);
    }

    [Fact]
    public async Task Save_CamposEmBranco_MantemValorExistente()
    {
        var (db, svc) = CriarServico();

        // Primeira gravação
        await svc.SaveAsync(new AwsSettingsDto
        {
            AccessKeyId = "ORIGINAL-KEY",
            SecretAccessKey = "ORIGINAL-SECRET",
            Region = "us-east-1",
            BucketName = "original-bucket",
        }, CancellationToken.None);

        // Segunda gravação — campos sensíveis em branco
        await svc.SaveAsync(new AwsSettingsDto
        {
            AccessKeyId = "",        // em branco → não altera
            SecretAccessKey = "",    // em branco → não altera
            Region = "us-east-2",   // alterado
            BucketName = "novo-bucket",
        }, CancellationToken.None);

        var entity = await db.Set<TenantAwsSettings>()
            .AsNoTracking()
            .FirstAsync(x => x.TenantId == TenantTeste);

        // Credenciais devem ser as originais
        Assert.Equal("ENC:ORIGINAL-KEY", entity.AccessKeyIdEncrypted);
        Assert.Equal("ENC:ORIGINAL-SECRET", entity.SecretAccessKeyEncrypted);
        // Outros campos devem ter sido atualizados
        Assert.Equal("us-east-2", entity.Region);
        Assert.Equal("novo-bucket", entity.BucketName);
    }

    [Fact]
    public async Task Save_RetornaViewAtualizada()
    {
        var (_, svc) = CriarServico();

        var view = await svc.SaveAsync(new AwsSettingsDto
        {
            AccessKeyId = "AKIAIOSFODNN7WXYZ",
            SecretAccessKey = "secret",
            Region = "us-east-2",
            BucketName = "meu-bucket",
            PresignedUrlExpirationMinutes = 60,
        }, CancellationToken.None);

        Assert.True(view.IsConfigured);
        Assert.Equal("••••••••WXYZ", view.AccessKeyIdMasked);
        Assert.Equal(60, view.PresignedUrlExpirationMinutes);
    }

    // ── GetDecryptedAsync ─────────────────────────────────────────────────────

    [Fact]
    public async Task GetDecrypted_BancoConfigurado_RetornaCredenciaisDecriptografadas()
    {
        var (db, svc) = CriarServico();

        db.Set<TenantAwsSettings>().Add(new TenantAwsSettings
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            AccessKeyIdEncrypted = "ENC:CHAVE-KEY",
            SecretAccessKeyEncrypted = "ENC:CHAVE-SECRET",
            Region = "us-east-2",
            BucketName = "meu-bucket",
            PresignedUrlExpirationMinutes = 15,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var opts = await svc.GetDecryptedAsync(CancellationToken.None);

        Assert.NotNull(opts);
        Assert.Equal("CHAVE-KEY", opts!.AccessKeyId);
        Assert.Equal("CHAVE-SECRET", opts.SecretAccessKey);
        Assert.Equal("us-east-2", opts.Region);
        Assert.Equal("meu-bucket", opts.BucketName);
    }

    [Fact]
    public async Task GetDecrypted_BancoNaoConfigurado_UsaFallbackAppsettings()
    {
        var fallback = new AwsOptions
        {
            AccessKeyId = "FALLBACK-KEY",
            SecretAccessKey = "FALLBACK-SECRET",
            Region = "us-east-1",
            BucketName = "fallback-bucket",
            PresignedUrlExpirationMinutes = 15,
        };
        var (_, svc) = CriarServico(fallback: fallback);

        var opts = await svc.GetDecryptedAsync(CancellationToken.None);

        Assert.NotNull(opts);
        Assert.Equal("FALLBACK-KEY", opts!.AccessKeyId);
        Assert.Equal("fallback-bucket", opts.BucketName);
    }

    [Fact]
    public async Task GetDecrypted_SemBancoESemFallback_RetornaNull()
    {
        var (_, svc) = CriarServico(fallback: new AwsOptions { BucketName = "" });

        var opts = await svc.GetDecryptedAsync(CancellationToken.None);

        Assert.Null(opts);
    }

    [Fact]
    public async Task GetDecrypted_BancoParcialmentePreeenchido_UsaFallback()
    {
        // Bucket configurado mas sem credenciais — não usa banco, vai pro fallback
        var (db, svc) = CriarServico(fallback: new AwsOptions
        {
            BucketName = "fallback-bucket",
            AccessKeyId = "FALLBACK",
            SecretAccessKey = "FALLBACK-SECRET",
            Region = "us-east-1",
        });

        db.Set<TenantAwsSettings>().Add(new TenantAwsSettings
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            BucketName = "bucket-sem-credenciais",
            // AccessKeyIdEncrypted e SecretAccessKeyEncrypted nulos
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var opts = await svc.GetDecryptedAsync(CancellationToken.None);

        // Banco incompleto → fallback
        Assert.NotNull(opts);
        Assert.Equal("FALLBACK", opts!.AccessKeyId);
    }

    // ── Isolamento por tenant ─────────────────────────────────────────────────

    [Fact]
    public async Task GetView_TenantsDiferentes_SaoIsolados()
    {
        var (db, svcA) = CriarServico("tenant-a");

        db.Set<TenantAwsSettings>().Add(new TenantAwsSettings
        {
            Id = Guid.NewGuid(),
            TenantId = "tenant-a",
            AccessKeyIdEncrypted = "ENC:KEY-A",
            SecretAccessKeyEncrypted = "ENC:SECRET-A",
            BucketName = "bucket-a",
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        // svcA enxerga bucket-a
        var viewA = await svcA.GetViewAsync(CancellationToken.None);
        Assert.Equal("bucket-a", viewA.BucketName);

        // Novo serviço com tenant-b na mesma instância de DB
        var tenantBMock = new Mock<ITenantContext>();
        tenantBMock.Setup(x => x.TenantId).Returns("tenant-b");
        var svcB = new AwsSettingsService(db, new FakeProtector(), tenantBMock.Object, Options.Create(new AwsOptions()));

        var viewB = await svcB.GetViewAsync(CancellationToken.None);
        Assert.False(viewB.IsConfigured); // tenant-b não tem configuração
        Assert.Null(viewB.BucketName);
    }
}
