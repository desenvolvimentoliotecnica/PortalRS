using System.Net.Http.Json;
using System.Text.Json;
using LioTecnica.Web.ViewModels.Portal;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class PortalCandidatesApiClient
{
    private readonly HttpClient _http;

    public PortalCandidatesApiClient(HttpClient http)
    {
        _http = http;
    }

    public async Task<PortalApiResult<PortalCandidateProfileResponse>> GetProfileAsync(
        string tenantId,
        Guid candidateId,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            return PortalApiResult<PortalCandidateProfileResponse>.Fail(System.Net.HttpStatusCode.BadRequest, "Tenant nao informado.");

        var url = $"api/public/portal-candidates/{candidateId}?tenantId={Uri.EscapeDataString(tenantId)}";
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);

        using var res = await _http.SendAsync(req, ct);
        if (res.IsSuccessStatusCode)
        {
            var data = await res.Content.ReadFromJsonAsync<PortalCandidateProfileResponse>(cancellationToken: ct);
            if (data is not null)
                return PortalApiResult<PortalCandidateProfileResponse>.Ok(data);

            return PortalApiResult<PortalCandidateProfileResponse>.Fail(res.StatusCode, "Resposta invalida da API.");
        }

        var message = await TryReadMessageAsync(res, ct);
        return PortalApiResult<PortalCandidateProfileResponse>.Fail(res.StatusCode, message ?? "Falha ao carregar perfil.");
    }

    public async Task<PortalApiResult<PortalCandidateProfileResponse>> UpdateProfileAsync(
        string tenantId,
        Guid candidateId,
        PortalCandidateProfileUpdateRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            return PortalApiResult<PortalCandidateProfileResponse>.Fail(System.Net.HttpStatusCode.BadRequest, "Tenant nao informado.");

        var url = $"api/public/portal-candidates/{candidateId}?tenantId={Uri.EscapeDataString(tenantId)}";
        using var req = new HttpRequestMessage(HttpMethod.Put, url)
        {
            Content = JsonContent.Create(request)
        };
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);

        using var res = await _http.SendAsync(req, ct);
        if (res.IsSuccessStatusCode)
        {
            var data = await res.Content.ReadFromJsonAsync<PortalCandidateProfileResponse>(cancellationToken: ct);
            if (data is not null)
                return PortalApiResult<PortalCandidateProfileResponse>.Ok(data);

            return PortalApiResult<PortalCandidateProfileResponse>.Fail(res.StatusCode, "Resposta invalida da API.");
        }

        var message = await TryReadMessageAsync(res, ct);
        return PortalApiResult<PortalCandidateProfileResponse>.Fail(res.StatusCode, message ?? "Falha ao atualizar perfil.");
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
