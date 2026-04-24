using System.Net;
using System.Text;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using RhPortal.Api.Messaging.WhatsApp;
using Xunit;

namespace RhPortal.Api.Tests.Messaging.WhatsApp;

/// <summary>
/// Cobertura do provedor Twilio (REST direto via HttpClient). Validamos:
/// montagem da URL/Authorization/payload, parsing do "sid" no sucesso, parsing
/// do erro Twilio (code/message) e fast-fail quando faltam credenciais.
/// </summary>
public class TwilioWhatsAppMessageSenderTests
{
    private static (TwilioWhatsAppMessageSender sender, FakeHttpMessageHandler handler) Build(
        WhatsAppOptions opts,
        Func<HttpRequestMessage, HttpResponseMessage> respond)
    {
        var handler = new FakeHttpMessageHandler(respond);
        var http = new HttpClient(handler);
        var monitor = new StaticOptionsMonitor<WhatsAppOptions>(opts);
        var sender = new TwilioWhatsAppMessageSender(http, monitor, NullLogger<TwilioWhatsAppMessageSender>.Instance);
        return (sender, handler);
    }

    [Fact]
    public async Task EnvioBemSucedido_RetornaSidEMontaUrlComAccountSid()
    {
        var opts = new WhatsAppOptions
        {
            Provider = "Twilio",
            Twilio = new TwilioOptions
            {
                AccountSid = "ACtest123",
                AuthToken = "tokensecreto",
                FromNumber = "+14155238886",
                BaseUrl = "https://api.twilio.com",
            },
        };

        var (sender, handler) = Build(opts, _ =>
            new HttpResponseMessage(HttpStatusCode.Created)
            {
                Content = new StringContent("""{"sid":"SMabcdef","status":"queued"}""", Encoding.UTF8, "application/json"),
            });

        var result = await sender.SendAsync("+5511987654321", "olá", CancellationToken.None);

        Assert.True(result.Accepted);
        Assert.Equal("SMabcdef", result.ProviderMessageId);

        Assert.Equal(HttpMethod.Post, handler.LastMethod);
        Assert.Equal("https://api.twilio.com/2010-04-01/Accounts/ACtest123/Messages.json", handler.LastUri!.ToString());
        Assert.Equal("Basic", handler.LastAuthorization!.Scheme);
        var basicDecoded = Encoding.UTF8.GetString(Convert.FromBase64String(handler.LastAuthorization.Parameter!));
        Assert.Equal("ACtest123:tokensecreto", basicDecoded);

        var body = handler.LastBody!;
        Assert.Contains("From=whatsapp%3A%2B14155238886", body);
        Assert.Contains("To=whatsapp%3A%2B5511987654321", body);
        Assert.Contains("Body=ol%C3%A1", body);
    }

    [Fact]
    public async Task EnvioComFromJaPrefixadoComWhatsApp_NaoDuplicaPrefixo()
    {
        var opts = new WhatsAppOptions
        {
            Twilio = new TwilioOptions
            {
                AccountSid = "AC1",
                AuthToken = "t",
                FromNumber = "whatsapp:+14155238886",
            },
        };
        var (sender, handler) = Build(opts, _ =>
            new HttpResponseMessage(HttpStatusCode.Created)
            {
                Content = new StringContent("""{"sid":"SM1"}""", Encoding.UTF8, "application/json"),
            });

        await sender.SendAsync("whatsapp:+5511999", "x", CancellationToken.None);

        var body = handler.LastBody!;
        // Garante que não virou "whatsapp:whatsapp:..."
        Assert.DoesNotContain("whatsapp%3Awhatsapp", body);
        Assert.Contains("From=whatsapp%3A%2B14155238886", body);
    }

    [Fact]
    public async Task ErroDoTwilio_RetornaErroComCodeEMessage()
    {
        var opts = new WhatsAppOptions
        {
            Twilio = new TwilioOptions { AccountSid = "AC1", AuthToken = "t", FromNumber = "+14155238886" },
        };

        var (sender, _) = Build(opts, _ =>
            new HttpResponseMessage(HttpStatusCode.BadRequest)
            {
                Content = new StringContent("""{"code":21211,"message":"Invalid 'To' phone number"}""", Encoding.UTF8, "application/json"),
            });

        var result = await sender.SendAsync("+1", "msg", CancellationToken.None);

        Assert.False(result.Accepted);
        Assert.NotNull(result.ErrorMessage);
        Assert.Contains("twilio_code_21211", result.ErrorMessage);
        Assert.Contains("Invalid 'To'", result.ErrorMessage);
    }

    [Fact]
    public async Task SemCredenciais_NaoFazRequest_RetornaErroEspecifico()
    {
        var opts = new WhatsAppOptions
        {
            Twilio = new TwilioOptions { AccountSid = "", AuthToken = "", FromNumber = "" },
        };
        var (sender, handler) = Build(opts, _ => throw new InvalidOperationException("não deveria chamar"));

        var result = await sender.SendAsync("+5511999", "x", CancellationToken.None);

        Assert.False(result.Accepted);
        Assert.Equal("twilio_credenciais_ausentes", result.ErrorMessage);
        Assert.Equal(0, handler.CallCount);
    }

    [Fact]
    public async Task TelefoneVazio_RetornaErroSemRequest()
    {
        var opts = new WhatsAppOptions
        {
            Twilio = new TwilioOptions { AccountSid = "AC1", AuthToken = "t", FromNumber = "+1" },
        };
        var (sender, handler) = Build(opts, _ => throw new InvalidOperationException("não deveria chamar"));

        var result = await sender.SendAsync("", "x", CancellationToken.None);

        Assert.False(result.Accepted);
        Assert.Equal("telefone_vazio", result.ErrorMessage);
        Assert.Equal(0, handler.CallCount);
    }

    [Fact]
    public async Task ExceptionDeRede_NaoEstoura_RetornaResultadoNegativo()
    {
        var opts = new WhatsAppOptions
        {
            Twilio = new TwilioOptions { AccountSid = "AC1", AuthToken = "t", FromNumber = "+1" },
        };
        var (sender, _) = Build(opts, _ => throw new HttpRequestException("conn refused"));

        var result = await sender.SendAsync("+5511999", "x", CancellationToken.None);

        Assert.False(result.Accepted);
        Assert.NotNull(result.ErrorMessage);
        Assert.StartsWith("twilio_exception:", result.ErrorMessage);
    }
}
