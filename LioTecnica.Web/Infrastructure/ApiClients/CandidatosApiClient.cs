using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing.Matching;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class CandidatosApiClient
{
    private readonly HttpClient _http;

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public CandidatosApiClient(HttpClient http) => _http = http;

    public Task<ApiRawResponse> GetCandidatosRawAsync(
        string tenantId,
        string? q,
        IReadOnlyList<string>? statuses,
        IReadOnlyList<Guid>? vagaIds,
        int page = 1,
        int pageSize = 20,
        CancellationToken ct = default)
    {
        var url = "api/candidatos";

        var qs = new List<string>();
        if (!string.IsNullOrWhiteSpace(q)) qs.Add($"q={Uri.EscapeDataString(q)}");
        if (statuses is { Count: > 0 })
        {
            foreach (var s in statuses)
                if (!string.IsNullOrWhiteSpace(s))
                    qs.Add($"statuses={Uri.EscapeDataString(s)}");
        }
        if (vagaIds is { Count: > 0 })
        {
            foreach (var id in vagaIds)
                qs.Add($"vagaIds={id:D}");
        }
        qs.Add($"page={Math.Max(1, page)}");
        qs.Add($"pageSize={Math.Clamp(pageSize, 1, 100)}");

        if (qs.Count > 0)
            url += "?" + string.Join("&", qs);

        var req = BuildRequest(HttpMethod.Get, url, tenantId);
        return SendAsync(req, ct);
    }


    public Task<ApiRawResponse> GetCandidatoByIdRawAsync(string tenantId, Guid id, CancellationToken ct)
    {
        var req = BuildRequest(HttpMethod.Get, $"api/candidatos/{id}", tenantId);
        return SendAsync(req, ct);
    }

    public Task<ApiRawResponse> GetCandidatoStatusHistoryRawAsync(string tenantId, Guid id, CancellationToken ct)
    {
        var req = BuildRequest(HttpMethod.Get, $"api/candidatos/{id}/status-history", tenantId);
        return SendAsync(req, ct);
    }

    public Task<ApiRawResponse> CreateRawAsync(string tenantId, JsonElement payload, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(payload, JsonOpts);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var req = BuildRequest(HttpMethod.Post, "api/candidatos", tenantId, content);
        return SendAsync(req, ct);
    }

    public Task<ApiRawResponse> UpdateRawAsync(string tenantId, Guid id, JsonElement payload, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(payload, JsonOpts);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var req = BuildRequest(HttpMethod.Put, $"api/candidatos/{id}", tenantId, content);
        return SendAsync(req, ct);
    }

    public Task<ApiRawResponse> DeleteRawAsync(string tenantId, Guid id, CancellationToken ct)
    {
        var req = BuildRequest(HttpMethod.Delete, $"api/candidatos/{id}", tenantId);
        return SendAsync(req, ct);
    }

    public Task<ApiRawResponse> UploadDocumentoRawAsync(
        string tenantId,
        Guid candidatoId,
        IFormFile arquivo,
        string tipo,
        string? descricao,
        CancellationToken ct)
    {
        var content = new MultipartFormDataContent();
        var fileContent = new StreamContent(arquivo.OpenReadStream());
        if (!string.IsNullOrWhiteSpace(arquivo.ContentType))
        {
            fileContent.Headers.ContentType = new MediaTypeHeaderValue(arquivo.ContentType);
        }
        fileContent.Headers.ContentLength = arquivo.Length;

        content.Add(fileContent, "arquivo", arquivo.FileName);
        content.Add(new StringContent(tipo), "tipo");

        if (!string.IsNullOrWhiteSpace(descricao))
            content.Add(new StringContent(descricao), "descricao");

        var req = BuildRequest(HttpMethod.Post, $"api/candidatos/{candidatoId}/documentos", tenantId, content);
        return SendAsync(req, ct);
    }

    public Task<ApiRawResponse> DeleteDocumentoRawAsync(string tenantId, Guid candidatoId, Guid documentoId, CancellationToken ct)
    {
        var req = BuildRequest(HttpMethod.Delete, $"api/candidatos/{candidatoId}/documentos/{documentoId}", tenantId);
        return SendAsync(req, ct);
    }

    public async Task<ApiFileResponse> DownloadDocumentoAsync(string tenantId, Guid candidatoId, Guid documentoId, CancellationToken ct)
    {
        var req = BuildRequest(HttpMethod.Get, $"api/candidatos/{candidatoId}/documentos/{documentoId}/download", tenantId, accept: "*/*");
        using var res = await _http.SendAsync(req, ct);
        var content = await res.Content.ReadAsByteArrayAsync(ct);
        var contentType = res.Content.Headers.ContentType?.ToString();
        var fileName = res.Content.Headers.ContentDisposition?.FileNameStar
            ?? res.Content.Headers.ContentDisposition?.FileName;
        return new ApiFileResponse(res.StatusCode, content, contentType, fileName);
    }

    private HttpRequestMessage BuildRequest(HttpMethod method, string url, string tenantId, HttpContent? body = null, string? accept = "application/json")
    {
        var req = new HttpRequestMessage(method, url);
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        if (!string.IsNullOrWhiteSpace(accept))
            req.Headers.TryAddWithoutValidation("Accept", accept);

        if (body != null)
            req.Content = body;

        return req;
    }

    private async Task<ApiRawResponse> SendAsync(HttpRequestMessage req, CancellationToken ct)
    {
        using var res = await _http.SendAsync(req, ct);
        var content = await res.Content.ReadAsStringAsync(ct);
        return new ApiRawResponse(res.StatusCode, content);
    }
}

public sealed record ApiFileResponse(HttpStatusCode StatusCode, byte[] Content, string? ContentType, string? FileName);
