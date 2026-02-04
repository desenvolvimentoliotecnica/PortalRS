using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using LioTecnica.Web.ViewModels.Portal;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class PortalAuthApiClient
{
    private readonly HttpClient _http;

    public PortalAuthApiClient(HttpClient http)
    {
        _http = http;
    }

    public async Task<PortalAuthResult> LoginAsync(string tenantId, PortalCandidateLoginRequest request, CancellationToken ct)
    {
        return await SendAsync("api/public/portal-auth/login", tenantId, request, ct);
    }

    public async Task<PortalAuthResult> RegisterAsync(string tenantId, PortalCandidateRegisterRequest request, CancellationToken ct)
    {
        return await SendAsync("api/public/portal-auth/register", tenantId, request, ct);
    }

    private async Task<PortalAuthResult> SendAsync(string path, string tenantId, object payload, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            return PortalAuthResult.Fail(HttpStatusCode.BadRequest, "Tenant nao informado.");
        }

        var url = $"{path}?tenantId={Uri.EscapeDataString(tenantId)}";
        using var req = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = JsonContent.Create(payload)
        };
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);

        using var res = await _http.SendAsync(req, ct);
        if (res.IsSuccessStatusCode)
        {
            var data = await res.Content.ReadFromJsonAsync<PortalCandidateAuthResponse>(cancellationToken: ct);
            if (data is not null)
                return PortalAuthResult.Ok(data);

            return PortalAuthResult.Fail(res.StatusCode, "Resposta invalida da API.");
        }

        var message = await TryReadMessageAsync(res, ct);
        return PortalAuthResult.Fail(res.StatusCode, message ?? "Falha ao autenticar candidato.");
    }

    private static async Task<string?> TryReadMessageAsync(HttpResponseMessage response, CancellationToken ct)
    {
        var body = await response.Content.ReadAsStringAsync(ct);
        if (string.IsNullOrWhiteSpace(body)) return null;

        try
        {
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("message", out var msg))
                return msg.GetString();
        }
        catch
        {
            return body;
        }

        return body;
    }
}
