using Microsoft.EntityFrameworkCore;
using Moq;
using RhPortal.Api.Application.TenantBranding;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using Xunit;

namespace RhPortal.Api.Tests.TenantBranding;

/// <summary>
/// Testes do TenantBrandingService — white-label por tenant (Sessão 29).
/// Cobre:
/// - Defaults quando não há registro
/// - Upsert cria / atualiza / zera (strings vazias viram null)
/// - Normalização de cores (hex válido → uppercase, inválido → null)
/// - Clamp de tamanho (defensivo)
/// - Reset (idempotente)
/// - Isolamento por tenant
/// - Get público (versão consumida pela tela de login)
/// </summary>
public sealed class TenantBrandingServiceTests
{
    private const string TenantTeste = "tenant-branding-teste";

    private static (AppDbContext Db, TenantBrandingService Service) CriarServico(string tenantId = TenantTeste)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(tenantId);
        var db = new AppDbContext(options, tenantMock.Object);

        var service = new TenantBrandingService(db, tenantMock.Object);
        return (db, service);
    }

    // ── GetAsync ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetAsync_SemRegistro_RetornaCamposNull()
    {
        var (_, svc) = CriarServico();

        var dto = await svc.GetAsync(CancellationToken.None);

        Assert.NotNull(dto);
        Assert.Null(dto.NomePortal);
        Assert.Null(dto.Subtitulo);
        Assert.Null(dto.RodapeTexto);
        Assert.Null(dto.CorPrimariaHex);
        Assert.Null(dto.CorSecundariaHex);
        Assert.Null(dto.LogoUrl);
        Assert.Null(dto.VersaoExibida);
        Assert.Null(dto.UpdatedAtUtc);
    }

    // ── UpsertAsync ──────────────────────────────────────────────────────────

    [Fact]
    public async Task UpsertAsync_SemRegistro_Cria()
    {
        var (db, svc) = CriarServico();

        var dto = await svc.UpsertAsync(new TenantBrandingUpsertRequest
        {
            NomePortal = "Portal Liotecnica",
            Subtitulo = "Gestão de pessoas da Liotecnica",
            CorPrimariaHex = "#112244",
            CorSecundariaHex = "#334455",
            LogoUrl = "https://cdn.liotecnica.com/logo.png",
            VersaoExibida = "v3.0",
        }, CancellationToken.None);

        Assert.Equal("Portal Liotecnica", dto.NomePortal);
        Assert.Equal("Gestão de pessoas da Liotecnica", dto.Subtitulo);
        Assert.Equal("#112244", dto.CorPrimariaHex);
        Assert.Equal("#334455", dto.CorSecundariaHex);
        Assert.Equal("https://cdn.liotecnica.com/logo.png", dto.LogoUrl);
        Assert.Equal("v3.0", dto.VersaoExibida);
        Assert.NotNull(dto.UpdatedAtUtc);

        // Confirma persistência e unicidade.
        var count = await db.TenantBrandings.IgnoreQueryFilters().CountAsync();
        Assert.Equal(1, count);
    }

    [Fact]
    public async Task UpsertAsync_ComRegistro_Atualiza_NaoDuplica()
    {
        var (db, svc) = CriarServico();

        await svc.UpsertAsync(new TenantBrandingUpsertRequest { NomePortal = "Original" }, CancellationToken.None);
        var dto2 = await svc.UpsertAsync(new TenantBrandingUpsertRequest { NomePortal = "Atualizado", Subtitulo = "novo sub" }, CancellationToken.None);

        Assert.Equal("Atualizado", dto2.NomePortal);
        Assert.Equal("novo sub", dto2.Subtitulo);

        var total = await db.TenantBrandings.IgnoreQueryFilters().CountAsync();
        Assert.Equal(1, total);
    }

    [Fact]
    public async Task UpsertAsync_StringVazia_ViraNull()
    {
        // Semântica "usar default": campo vazio = remover override do tenant.
        var (_, svc) = CriarServico();

        var dto = await svc.UpsertAsync(new TenantBrandingUpsertRequest
        {
            NomePortal = "",
            Subtitulo = "   ",
            RodapeTexto = null,
            LogoUrl = "",
        }, CancellationToken.None);

        Assert.Null(dto.NomePortal);
        Assert.Null(dto.Subtitulo);
        Assert.Null(dto.RodapeTexto);
        Assert.Null(dto.LogoUrl);
    }

    [Fact]
    public async Task UpsertAsync_StringLonga_ClampaNoMax()
    {
        var (_, svc) = CriarServico();

        var nomeGigante = new string('A', 500);  // MaxNomePortal = 80
        var dto = await svc.UpsertAsync(new TenantBrandingUpsertRequest { NomePortal = nomeGigante }, CancellationToken.None);

        Assert.Equal(TenantBrandingService.MaxNomePortal, dto.NomePortal!.Length);
        Assert.All(dto.NomePortal, c => Assert.Equal('A', c));
    }

    [Fact]
    public async Task UpsertAsync_CorInvalida_ViraNull()
    {
        var (_, svc) = CriarServico();

        var dto = await svc.UpsertAsync(new TenantBrandingUpsertRequest
        {
            CorPrimariaHex = "azul-escuro",      // sem #
            CorSecundariaHex = "#GGHHII",        // hex inválido
        }, CancellationToken.None);

        Assert.Null(dto.CorPrimariaHex);
        Assert.Null(dto.CorSecundariaHex);
    }

    [Fact]
    public async Task UpsertAsync_CorMinuscula_NormalizaParaUpperCase()
    {
        var (_, svc) = CriarServico();

        var dto = await svc.UpsertAsync(new TenantBrandingUpsertRequest { CorPrimariaHex = "#0c3a64" }, CancellationToken.None);

        Assert.Equal("#0C3A64", dto.CorPrimariaHex);
    }

    // ── ResetAsync ───────────────────────────────────────────────────────────

    [Fact]
    public async Task ResetAsync_ComRegistro_Remove()
    {
        var (db, svc) = CriarServico();

        await svc.UpsertAsync(new TenantBrandingUpsertRequest { NomePortal = "X" }, CancellationToken.None);
        await svc.ResetAsync(CancellationToken.None);

        var count = await db.TenantBrandings.IgnoreQueryFilters().CountAsync();
        Assert.Equal(0, count);
    }

    [Fact]
    public async Task ResetAsync_SemRegistro_NoOp()
    {
        var (_, svc) = CriarServico();

        // Não deve lançar.
        await svc.ResetAsync(CancellationToken.None);
        var dto = await svc.GetAsync(CancellationToken.None);
        Assert.Null(dto.NomePortal);
    }

    // ── GetPublicAsync ──────────────────────────────────────────────────────

    [Fact]
    public async Task GetPublicAsync_SemRegistro_RetornaDtoVazio()
    {
        var (_, svc) = CriarServico();

        var dto = await svc.GetPublicAsync(CancellationToken.None);

        Assert.NotNull(dto);
        Assert.Null(dto.NomePortal);
    }

    [Fact]
    public async Task GetPublicAsync_ComRegistro_RetornaCampos()
    {
        var (_, svc) = CriarServico();

        await svc.UpsertAsync(new TenantBrandingUpsertRequest
        {
            NomePortal = "Liotecnica",
            Subtitulo = "RH digital",
            RodapeTexto = "© {ano} Liotecnica",
            CorPrimariaHex = "#112244",
            VersaoExibida = "v3.0",
        }, CancellationToken.None);

        var pub = await svc.GetPublicAsync(CancellationToken.None);

        Assert.Equal("Liotecnica", pub.NomePortal);
        Assert.Equal("RH digital", pub.Subtitulo);
        Assert.Equal("© {ano} Liotecnica", pub.RodapeTexto);
        Assert.Equal("#112244", pub.CorPrimariaHex);
        Assert.Equal("v3.0", pub.VersaoExibida);
    }

    // ── Normalização (unit tests das helpers) ───────────────────────────────

    [Theory]
    [InlineData("#0C3A64", "#0C3A64")]
    [InlineData("#0c3a64", "#0C3A64")]
    [InlineData("  #abcdef  ", "#ABCDEF")]
    [InlineData("#000000", "#000000")]
    [InlineData("#FFFFFF", "#FFFFFF")]
    public void NormalizeColor_HexValido_Preservado(string input, string expected)
    {
        var result = TenantBrandingService.NormalizeColor(input);
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("azul")]
    [InlineData("#12345")]      // curto demais
    [InlineData("#1234567")]    // longo demais
    [InlineData("#GGHHII")]     // caracteres fora de hex
    [InlineData("0C3A64")]      // sem #
    public void NormalizeColor_FormatoInvalido_Null(string? input)
    {
        var result = TenantBrandingService.NormalizeColor(input);
        Assert.Null(result);
    }

    [Fact]
    public void NormalizeText_VazioOuWhitespace_Null()
    {
        Assert.Null(TenantBrandingService.NormalizeText(null, 10));
        Assert.Null(TenantBrandingService.NormalizeText("", 10));
        Assert.Null(TenantBrandingService.NormalizeText("   ", 10));
    }

    [Fact]
    public void NormalizeText_TrimEClamp()
    {
        Assert.Equal("abc", TenantBrandingService.NormalizeText("  abc  ", 10));
        Assert.Equal("abc", TenantBrandingService.NormalizeText("abcdefghij", 3));
    }

    // ── Isolamento por tenant (leitura cruzada via query filter) ────────────

    [Fact]
    public async Task Get_NaoVeRegistroDeOutroTenant()
    {
        // Dois services no mesmo banco, cada um com seu tenant.
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("shared-" + Guid.NewGuid())
            .Options;

        var mockA = new Mock<ITenantContext>();
        mockA.Setup(x => x.TenantId).Returns("tenant-a");
        var dbA = new AppDbContext(options, mockA.Object);
        var svcA = new TenantBrandingService(dbA, mockA.Object);

        var mockB = new Mock<ITenantContext>();
        mockB.Setup(x => x.TenantId).Returns("tenant-b");
        var dbB = new AppDbContext(options, mockB.Object);
        var svcB = new TenantBrandingService(dbB, mockB.Object);

        await svcA.UpsertAsync(new TenantBrandingUpsertRequest { NomePortal = "Portal A" }, CancellationToken.None);

        // B não vê o registro de A.
        var dtoB = await svcB.GetAsync(CancellationToken.None);
        Assert.Null(dtoB.NomePortal);

        // Upsert em B cria registro próprio — ambos coexistem.
        await svcB.UpsertAsync(new TenantBrandingUpsertRequest { NomePortal = "Portal B" }, CancellationToken.None);

        var dtoA2 = await svcA.GetAsync(CancellationToken.None);
        Assert.Equal("Portal A", dtoA2.NomePortal);
        var dtoB2 = await svcB.GetAsync(CancellationToken.None);
        Assert.Equal("Portal B", dtoB2.NomePortal);

        // E não duplicou nada — 2 registros no total (um por tenant).
        var total = await dbA.TenantBrandings.IgnoreQueryFilters().CountAsync();
        Assert.Equal(2, total);
    }
}
