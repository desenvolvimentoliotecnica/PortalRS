using System.Net.Http.Headers;
using Microsoft.Extensions.Options;

namespace RhPortal.Api.Tests.Messaging.WhatsApp;

/// <summary>
/// HttpMessageHandler controlável para testar HttpClient sem rede. Captura snapshot
/// imutável da última requisição (URL/método/headers/body) antes do request ser
/// disposed pelo `using` do sender. A inspeção dos testes deve usar
/// <see cref="LastUri"/>, <see cref="LastMethod"/>, <see cref="LastAuthorization"/>
/// e <see cref="LastBody"/>.
/// </summary>
internal sealed class FakeHttpMessageHandler : HttpMessageHandler
{
    private readonly Func<HttpRequestMessage, HttpResponseMessage> _respond;

    public Uri? LastUri { get; private set; }
    public HttpMethod? LastMethod { get; private set; }
    public AuthenticationHeaderValue? LastAuthorization { get; private set; }
    public string? LastBody { get; private set; }
    public string? LastContentType { get; private set; }
    public int CallCount { get; private set; }

    public FakeHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> respond)
    {
        _respond = respond;
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        CallCount++;
        LastUri = request.RequestUri;
        LastMethod = request.Method;
        LastAuthorization = request.Headers.Authorization;

        if (request.Content is not null)
        {
            LastBody = await request.Content.ReadAsStringAsync(cancellationToken);
            LastContentType = request.Content.Headers.ContentType?.ToString();
        }

        return _respond(request);
    }
}

/// <summary>
/// IOptionsMonitor estático para os testes — sem assinatura de hot-reload.
/// </summary>
internal sealed class StaticOptionsMonitor<T> : IOptionsMonitor<T> where T : class
{
    public StaticOptionsMonitor(T value) { CurrentValue = value; }
    public T CurrentValue { get; }
    public T Get(string? name) => CurrentValue;
    public IDisposable? OnChange(Action<T, string?> listener) => null;
}
