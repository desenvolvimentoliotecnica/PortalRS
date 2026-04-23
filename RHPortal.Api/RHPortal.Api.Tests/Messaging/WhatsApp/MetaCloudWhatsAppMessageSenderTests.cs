using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using RhPortal.Api.Messaging.WhatsApp;
using Xunit;

namespace RhPortal.Api.Tests.Messaging.WhatsApp;

/// <summary>
/// Cobertura do provedor WhatsApp Cloud API (Meta) — REST direto via HttpClient.
/// Validamos: montagem da URL com GraphVersion+PhoneNumberId, Bearer token,
/// payload JSON whatsapp/text, parsing do messages[0].id, parsing do error
/// (code/message) e fast-fail sem credenciais.
/// </summary>
public class MetaCloudWhatsAppMessageSenderTests
{
    private static (MetaCloudWhatsAppMessageSender sender, FakeHttpMessageHandler handler) Build(
        WhatsAppOptions opts,
        Func<HttpRequestMessage, HttpResponseMessage> respond)
    {
        var handler = new FakeHttpMessageHandler(respond);
        var http = new HttpClient(handler);
        var monitor = new StaticOptionsMonitor<WhatsAppOptions>(opts);
        var sender = new MetaCloudWhatsAppMessageSender(http, monitor, NullLogger<MetaCloudWhatsAppMessageSender>.Instance);
        return (sender, handler);
    }

    [Fact]
    public async Task EnvioBemSucedido_RetornaMessageIdEMontaPayloadCorreto()
    {
        var opts = new WhatsAppOptions
        {
            Provider = "MetaCloud",
            MetaCloud = new MetaCloudOptions
            {
                PhoneNumberId = "1234567890",
                AccessToken = "EAAGtokenLongo",
                GraphVersion = "v19.0",
                BaseUrl = "https://graph.facebook.com",
            },
        };

        var (sender, handler) = Build(opts, _ =>
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    """{"messaging_product":"whatsapp","contacts":[{"input":"5511999","wa_id":"5511999"}],"messages":[{"id":"wamid.HBgL"}]}""",
                    Encoding.UTF8, "application/json"),
            });

        var result = await sender.SendAsync("+5511987654321", "olá meta", CancellationToken.None);

        Assert.True(result.Accepted);
        Assert.Equal("wamid.HBgL", result.ProviderMessageId);

        Assert.Equal(HttpMethod.Post, handler.LastMethod);
        Assert.Equal("https://graph.facebook.com/v19.0/1234567890/messages", handler.LastUri!.ToString());
        Assert.Equal("Bearer", handler.LastAuthorization!.Scheme);
        Assert.Equal("EAAGtokenLongo", handler.LastAuthorization.Parameter);

        var body = handler.LastBody!;
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;
        Assert.Equal("whatsapp", root.GetProperty("messaging_product").GetString());
        // O "+" deve ser removido — Meta exige número puro.
        Assert.Equal("5511987654321", root.GetProperty("to").GetString());
        Assert.Equal("text", root.GetProperty("type").GetString());
        Assert.Equal("olá meta", root.GetProperty("text").GetProperty("body").GetString());
    }

    [Fact]
    public async Task GraphVersionVazio_UsaDefaultV18()
    {
        var opts = new WhatsAppOptions
        {
            MetaCloud = new MetaCloudOptions
            {
                PhoneNumberId = "PN1",
                AccessToken = "tk",
                GraphVersion = "",
                BaseUrl = "https://graph.facebook.com",
            },
        };

        var (sender, handler) = Build(opts, _ =>
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("""{"messages":[{"id":"x"}]}""", Encoding.UTF8, "application/json"),
            });

        await sender.SendAsync("+551199", "x", CancellationToken.None);

        Assert.Equal("https://graph.facebook.com/v18.0/PN1/messages", handler.LastUri!.ToString());
    }

    [Fact]
    public async Task ErroDoMeta_ExtraiCodeEMessage()
    {
        var opts = new WhatsAppOptions
        {
            MetaCloud = new MetaCloudOptions { PhoneNumberId = "PN1", AccessToken = "tk" },
        };

        var (sender, _) = Build(opts, _ =>
            new HttpResponseMessage(HttpStatusCode.BadRequest)
            {
                Content = new StringContent(
                    """{"error":{"message":"Invalid OAuth access token","code":190,"type":"OAuthException"}}""",
                    Encoding.UTF8, "application/json"),
            });

        var result = await sender.SendAsync("+551199", "x", CancellationToken.None);

        Assert.False(result.Accepted);
        Assert.NotNull(result.ErrorMessage);
        Assert.Contains("metacloud_code_190", result.ErrorMessage);
        Assert.Contains("Invalid OAuth", result.ErrorMessage);
    }

    [Fact]
    public async Task SemCredenciais_NaoFazRequest()
    {
        var opts = new WhatsAppOptions
        {
            MetaCloud = new MetaCloudOptions { PhoneNumberId = "", AccessToken = "" },
        };
        var (sender, handler) = Build(opts, _ => throw new InvalidOperationException("não deveria chamar"));

        var result = await sender.SendAsync("+551199", "x", CancellationToken.None);

        Assert.False(result.Accepted);
        Assert.Equal("metacloud_credenciais_ausentes", result.ErrorMessage);
        Assert.Equal(0, handler.CallCount);
    }

    [Fact]
    public async Task TelefoneVazio_RetornaErroSemRequest()
    {
        var opts = new WhatsAppOptions
        {
            MetaCloud = new MetaCloudOptions { PhoneNumberId = "PN1", AccessToken = "tk" },
        };
        var (sender, handler) = Build(opts, _ => throw new InvalidOperationException("não deveria chamar"));

        var result = await sender.SendAsync("   ", "x", CancellationToken.None);

        Assert.False(result.Accepted);
        Assert.Equal("telefone_vazio", result.ErrorMessage);
        Assert.Equal(0, handler.CallCount);
    }

    [Fact]
    public async Task ExceptionDeRede_RetornaErroNegativoSemEstourar()
    {
        var opts = new WhatsAppOptions
        {
            MetaCloud = new MetaCloudOptions { PhoneNumberId = "PN1", AccessToken = "tk" },
        };
        var (sender, _) = Build(opts, _ => throw new HttpRequestException("dns"));

        var result = await sender.SendAsync("+551199", "x", CancellationToken.None);

        Assert.False(result.Accepted);
        Assert.NotNull(result.ErrorMessage);
        Assert.StartsWith("metacloud_exception:", result.ErrorMessage);
    }
}
