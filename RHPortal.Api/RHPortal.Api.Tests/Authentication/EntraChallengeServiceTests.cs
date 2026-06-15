using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Moq.Protected;
using RhPortal.Api.Application.Authentication;
using RhPortal.Api.Infrastructure.Security;
using Xunit;

namespace RhPortal.Api.Tests.Authentication;

/// <summary>
/// Testes do <see cref="EntraChallengeService"/>:
///  1) Assinatura/verificação HMAC do state (roundtrip, tamper, expiração).
///  2) Montagem da URL de autorização Microsoft (parâmetros obrigatórios).
///  3) Troca de code por id_token (happy path + erros de rede e config).
///  4) Retorno null quando a configuração Entra ID está ausente/desabilitada.
/// </summary>
public sealed class EntraChallengeServiceTests
{
    private const string SigningKey = "ChangeThisSigningKeyToAStrongValue1234567890";
    private const string DefaultTenantId = "liotecnica";
    private const string DefaultRedirect = "https://api.example.com/api/auth/entra/callback";

    // ── fábricas ─────────────────────────────────────────────────────────────

    private static IOptions<JwtOptions> JwtOpts(string key = SigningKey) =>
        Options.Create(new JwtOptions
        {
            Issuer = "RhPortal",
            Audience = "RhPortal",
            SigningKey = key,
            AccessTokenExpirationMinutes = 1440,
        });

    private static Mock<IEntraIdConfigService> ConfigMock(EntraIdConfigDto? dto)
    {
        var m = new Mock<IEntraIdConfigService>();
        m.Setup(x => x.GetDecryptedAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(dto);
        return m;
    }

    private static EntraIdConfigDto ValidConfig() => new()
    {
        IsEnabled = true,
        EntraTenantId = "00000000-0000-0000-0000-000000000001",
        ClientId = "client-123",
        ClientSecret = "super-secret",
        CallbackPath = "/api/auth/entra/callback",
    };

    private static IHttpClientFactory HttpFactoryReturning(HttpStatusCode status, string body)
    {
        var handler = new Mock<HttpMessageHandler>();
        handler
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage(status)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json"),
            });

        var client = new HttpClient(handler.Object);
        var factory = new Mock<IHttpClientFactory>();
        factory.Setup(x => x.CreateClient(It.IsAny<string>())).Returns(client);
        return factory.Object;
    }

    private static IHttpClientFactory HttpFactoryThrowing()
    {
        var handler = new Mock<HttpMessageHandler>();
        handler
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ThrowsAsync(new HttpRequestException("network down"));

        var client = new HttpClient(handler.Object);
        var factory = new Mock<IHttpClientFactory>();
        factory.Setup(x => x.CreateClient(It.IsAny<string>())).Returns(client);
        return factory.Object;
    }

    private static EntraChallengeService Criar(
        EntraIdConfigDto? config,
        IHttpClientFactory? http = null,
        string? signingKey = null)
    {
        var cfg = ConfigMock(config).Object;
        var factory = http ?? HttpFactoryReturning(HttpStatusCode.OK, "{}");
        var protector = new Mock<ISecretProtector>().Object;
        return new EntraChallengeService(cfg, factory, JwtOpts(signingKey ?? SigningKey), protector, NullLogger<EntraChallengeService>.Instance);
    }

    // ── BuildAuthorizationUrlAsync ──────────────────────────────────────────

    [Fact]
    public async Task BuildAuthorizationUrl_ConfigAusente_RetornaNull()
    {
        var svc = Criar(config: null);
        var result = await svc.BuildAuthorizationUrlAsync(
            DefaultTenantId, DefaultRedirect, "/dashboard", CancellationToken.None);
        Assert.Null(result);
    }

    [Fact]
    public async Task BuildAuthorizationUrl_ConfigDesabilitada_RetornaNull()
    {
        var cfg = ValidConfig();
        cfg.IsEnabled = false;
        var svc = Criar(cfg);
        var result = await svc.BuildAuthorizationUrlAsync(
            DefaultTenantId, DefaultRedirect, "/dashboard", CancellationToken.None);
        Assert.Null(result);
    }

    [Fact]
    public async Task BuildAuthorizationUrl_SemClientId_RetornaNull()
    {
        var cfg = ValidConfig();
        cfg.ClientId = null;
        var svc = Criar(cfg);
        var result = await svc.BuildAuthorizationUrlAsync(
            DefaultTenantId, DefaultRedirect, "/dashboard", CancellationToken.None);
        Assert.Null(result);
    }

    [Fact]
    public async Task BuildAuthorizationUrl_SemEntraTenantId_RetornaNull()
    {
        var cfg = ValidConfig();
        cfg.EntraTenantId = "   ";
        var svc = Criar(cfg);
        var result = await svc.BuildAuthorizationUrlAsync(
            DefaultTenantId, DefaultRedirect, "/dashboard", CancellationToken.None);
        Assert.Null(result);
    }

    [Fact]
    public async Task BuildAuthorizationUrl_ConfigValida_RetornaUrlMicrosoftComTodosParametros()
    {
        var cfg = ValidConfig();
        var svc = Criar(cfg);

        var result = await svc.BuildAuthorizationUrlAsync(
            DefaultTenantId, DefaultRedirect, "/app/dashboard", CancellationToken.None);

        Assert.NotNull(result);
        Assert.StartsWith(
            $"https://login.microsoftonline.com/{cfg.EntraTenantId}/oauth2/v2.0/authorize",
            result!.Url);
        Assert.Contains("client_id=client-123", result.Url);
        Assert.Contains("response_type=code", result.Url);
        Assert.Contains("response_mode=query", result.Url);
        Assert.Contains("scope=openid%20profile%20email", result.Url);
        Assert.Contains("redirect_uri=" + Uri.EscapeDataString(DefaultRedirect), result.Url);
        Assert.Contains("state=" + Uri.EscapeDataString(result.EncodedState), result.Url);
        Assert.False(string.IsNullOrWhiteSpace(result.EncodedState));
        Assert.Contains('.', result.EncodedState); // payload.sig
    }

    [Fact]
    public async Task BuildAuthorizationUrl_ReturnUrlVazia_UsaDefault()
    {
        var svc = Criar(ValidConfig());
        var result = await svc.BuildAuthorizationUrlAsync(
            DefaultTenantId, DefaultRedirect, "", CancellationToken.None);

        Assert.NotNull(result);
        var decoded = svc.TryDecodeState(result!.EncodedState);
        Assert.NotNull(decoded);
        Assert.Equal("/app/dashboard", decoded!.ReturnUrl);
    }

    // ── TryDecodeState: roundtrip / tamper / expiração / formato inválido ──

    [Fact]
    public async Task TryDecodeState_RoundtripAssinaturaCorreta_PreservaCampos()
    {
        var svc = Criar(ValidConfig());
        var built = await svc.BuildAuthorizationUrlAsync(
            DefaultTenantId, DefaultRedirect, "/app/vagas", CancellationToken.None);

        Assert.NotNull(built);
        var payload = svc.TryDecodeState(built!.EncodedState);

        Assert.NotNull(payload);
        Assert.Equal(DefaultTenantId, payload!.TenantId);
        Assert.Equal("/app/vagas", payload.ReturnUrl);
        Assert.False(string.IsNullOrWhiteSpace(payload.Nonce));
        Assert.InRange(
            payload.IssuedAtUnix,
            DateTimeOffset.UtcNow.AddMinutes(-1).ToUnixTimeSeconds(),
            DateTimeOffset.UtcNow.AddMinutes(1).ToUnixTimeSeconds());
    }

    [Fact]
    public void TryDecodeState_Vazio_RetornaNull()
    {
        var svc = Criar(ValidConfig());
        Assert.Null(svc.TryDecodeState(""));
        Assert.Null(svc.TryDecodeState("   "));
    }

    [Fact]
    public void TryDecodeState_SemPonto_RetornaNull()
    {
        var svc = Criar(ValidConfig());
        Assert.Null(svc.TryDecodeState("abcdefg"));
    }

    [Fact]
    public void TryDecodeState_PartesVazias_RetornaNull()
    {
        var svc = Criar(ValidConfig());
        Assert.Null(svc.TryDecodeState(".abc"));
        Assert.Null(svc.TryDecodeState("abc."));
    }

    [Fact]
    public async Task TryDecodeState_PayloadAdulterado_RetornaNull()
    {
        var svc = Criar(ValidConfig());
        var built = await svc.BuildAuthorizationUrlAsync(
            DefaultTenantId, DefaultRedirect, "/app/vagas", CancellationToken.None);
        Assert.NotNull(built);

        var parts = built!.EncodedState.Split('.');
        // Payload adulterado com outro JSON válido, mas a assinatura continua a antiga.
        var novoPayload = new EntraStatePayload(
            "OUTRO_TENANT", "/app/hackeado", "00", DateTimeOffset.UtcNow.ToUnixTimeSeconds());
        var tamperedPayloadBytes = JsonSerializer.SerializeToUtf8Bytes(novoPayload);
        var tamperedB64 = Convert.ToBase64String(tamperedPayloadBytes)
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var tampered = $"{tamperedB64}.{parts[1]}";

        var result = svc.TryDecodeState(tampered);
        Assert.Null(result);
    }

    [Fact]
    public async Task TryDecodeState_AssinaturaAdulterada_RetornaNull()
    {
        var svc = Criar(ValidConfig());
        var built = await svc.BuildAuthorizationUrlAsync(
            DefaultTenantId, DefaultRedirect, "/app/vagas", CancellationToken.None);
        Assert.NotNull(built);

        var parts = built!.EncodedState.Split('.');
        // Troca 1 byte da assinatura: flip do último char (válido base64url).
        var last = parts[1][^1];
        var replacement = last == 'A' ? 'B' : 'A';
        var tampered = $"{parts[0]}.{parts[1][..^1]}{replacement}";

        var result = svc.TryDecodeState(tampered);
        Assert.Null(result);
    }

    [Fact]
    public void TryDecodeState_AssinadoComOutraChave_RetornaNull()
    {
        var svcA = Criar(ValidConfig(), signingKey: "KEY_A_0000000000000000000000000000");
        var svcB = Criar(ValidConfig(), signingKey: "KEY_B_1111111111111111111111111111");

        var payload = new EntraStatePayload(
            DefaultTenantId, "/app/dashboard", "00", DateTimeOffset.UtcNow.ToUnixTimeSeconds());
        var encodedByA = svcA.EncodeAndSignState(payload);

        Assert.Null(svcB.TryDecodeState(encodedByA));
        Assert.NotNull(svcA.TryDecodeState(encodedByA)); // sanity check
    }

    [Fact]
    public void TryDecodeState_Expirado_RetornaNull()
    {
        var svc = Criar(ValidConfig());
        var payloadExpirado = new EntraStatePayload(
            DefaultTenantId,
            "/app/dashboard",
            "deadbeef",
            DateTimeOffset.UtcNow.AddMinutes(-20).ToUnixTimeSeconds()); // > 10 min

        var encoded = svc.EncodeAndSignState(payloadExpirado);
        var result = svc.TryDecodeState(encoded);

        Assert.Null(result);
    }

    [Fact]
    public void TryDecodeState_IssuedAtFuturo_RetornaNull()
    {
        var svc = Criar(ValidConfig());
        var payloadFuturo = new EntraStatePayload(
            DefaultTenantId,
            "/app/dashboard",
            "deadbeef",
            DateTimeOffset.UtcNow.AddMinutes(5).ToUnixTimeSeconds()); // relógio futuro

        var encoded = svc.EncodeAndSignState(payloadFuturo);
        var result = svc.TryDecodeState(encoded);

        Assert.Null(result);
    }

    // ── ExchangeCodeForIdTokenAsync ────────────────────────────────────────

    [Fact]
    public async Task ExchangeCodeForIdToken_ConfigAusente_RetornaNull()
    {
        var svc = Criar(config: null);
        var result = await svc.ExchangeCodeForIdTokenAsync(
            DefaultTenantId, "code-1", DefaultRedirect, CancellationToken.None);
        Assert.Null(result);
    }

    [Fact]
    public async Task ExchangeCodeForIdToken_ConfigDesabilitada_RetornaNull()
    {
        var cfg = ValidConfig();
        cfg.IsEnabled = false;
        var svc = Criar(cfg);
        var result = await svc.ExchangeCodeForIdTokenAsync(
            DefaultTenantId, "code-1", DefaultRedirect, CancellationToken.None);
        Assert.Null(result);
    }

    [Fact]
    public async Task ExchangeCodeForIdToken_SemClientSecret_RetornaNull()
    {
        var cfg = ValidConfig();
        cfg.ClientSecret = null;
        var svc = Criar(cfg);
        var result = await svc.ExchangeCodeForIdTokenAsync(
            DefaultTenantId, "code-1", DefaultRedirect, CancellationToken.None);
        Assert.Null(result);
    }

    [Fact]
    public async Task ExchangeCodeForIdToken_RedeFalha_RetornaNull()
    {
        var svc = Criar(ValidConfig(), HttpFactoryThrowing());
        var result = await svc.ExchangeCodeForIdTokenAsync(
            DefaultTenantId, "code-1", DefaultRedirect, CancellationToken.None);
        Assert.Null(result);
    }

    [Fact]
    public async Task ExchangeCodeForIdToken_HttpStatusNaoSuccess_RetornaNull()
    {
        var svc = Criar(ValidConfig(), HttpFactoryReturning(HttpStatusCode.BadRequest, "{\"error\":\"invalid_grant\"}"));
        var result = await svc.ExchangeCodeForIdTokenAsync(
            DefaultTenantId, "code-1", DefaultRedirect, CancellationToken.None);
        Assert.Null(result);
    }

    [Fact]
    public async Task ExchangeCodeForIdToken_RespostaSemIdToken_RetornaNull()
    {
        var svc = Criar(ValidConfig(), HttpFactoryReturning(HttpStatusCode.OK, "{\"access_token\":\"abc\"}"));
        var result = await svc.ExchangeCodeForIdTokenAsync(
            DefaultTenantId, "code-1", DefaultRedirect, CancellationToken.None);
        Assert.Null(result);
    }

    [Fact]
    public async Task ExchangeCodeForIdToken_JsonInvalido_RetornaNull()
    {
        var svc = Criar(ValidConfig(), HttpFactoryReturning(HttpStatusCode.OK, "<<<not-json>>>"));
        var result = await svc.ExchangeCodeForIdTokenAsync(
            DefaultTenantId, "code-1", DefaultRedirect, CancellationToken.None);
        Assert.Null(result);
    }

    [Fact]
    public async Task ExchangeCodeForIdToken_HappyPath_RetornaIdToken()
    {
        const string idToken = "eyJhbGciOi.header.body.sig";
        var json = $"{{\"id_token\":\"{idToken}\",\"access_token\":\"xyz\"}}";
        var svc = Criar(ValidConfig(), HttpFactoryReturning(HttpStatusCode.OK, json));

        var result = await svc.ExchangeCodeForIdTokenAsync(
            DefaultTenantId, "code-1", DefaultRedirect, CancellationToken.None);

        Assert.Equal(idToken, result);
    }
}
