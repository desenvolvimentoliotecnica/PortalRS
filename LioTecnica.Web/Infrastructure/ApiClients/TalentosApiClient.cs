using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class TalentosApiClient
{
    private readonly HttpClient _http;

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public TalentosApiClient(HttpClient http) => _http = http;

    public Task<ApiRawResponse> ListRawAsync(
        string tenantId,
        string? q,
        string? origem,
        int page = 1,
        int pageSize = 20,
        CancellationToken ct = default)
    {
        var url = "api/talentos";
        var qs = new List<string>();
        if (!string.IsNullOrWhiteSpace(q)) qs.Add($"q={Uri.EscapeDataString(q)}");
        if (!string.IsNullOrWhiteSpace(origem)) qs.Add($"origem={Uri.EscapeDataString(origem)}");
        qs.Add($"page={Math.Max(1, page)}");
        qs.Add($"pageSize={Math.Clamp(pageSize, 1, 100)}");
        if (qs.Count > 0) url += "?" + string.Join("&", qs);

        var req = BuildRequest(HttpMethod.Get, url, tenantId);
        return SendAsync(req, ct);
    }

    public Task<ApiRawResponse> GetByIdRawAsync(string tenantId, Guid id, CancellationToken ct)
    {
        var req = BuildRequest(HttpMethod.Get, $"api/talentos/{id}", tenantId);
        return SendAsync(req, ct);
    }

    public Task<ApiRawResponse> CreateRawAsync(string tenantId, JsonElement payload, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(payload, JsonOpts);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var req = BuildRequest(HttpMethod.Post, "api/talentos", tenantId, content);
        return SendAsync(req, ct);
    }

    public Task<ApiRawResponse> UpdateRawAsync(string tenantId, Guid id, JsonElement payload, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(payload, JsonOpts);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var req = BuildRequest(HttpMethod.Put, $"api/talentos/{id}", tenantId, content);
        return SendAsync(req, ct);
    }

    public Task<ApiRawResponse> DeleteRawAsync(string tenantId, Guid id, CancellationToken ct)
    {
        var req = BuildRequest(HttpMethod.Delete, $"api/talentos/{id}", tenantId);
        return SendAsync(req, ct);
    }

    public async Task<ApiRawResponse> ImportPdfRawAsync(string tenantId, Stream fileStream, string fileName, bool enviarParaGpt, Guid? talentoId, CancellationToken ct)
    {
        using var form = new MultipartFormDataContent();
        var fileContent = new StreamContent(fileStream);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(fileContent, "Arquivo", fileName);
        form.Add(new StringContent(enviarParaGpt ? "true" : "false"), "EnviarParaGpt");
        if (talentoId.HasValue)
            form.Add(new StringContent(talentoId.Value.ToString()), "TalentoId");

        var req = BuildRequest(HttpMethod.Post, "api/talentos/import-pdf", tenantId, form);
        return await SendAsync(req, ct);
    }

    public Task<ApiRawResponse> AprovarImportJobRawAsync(string tenantId, Guid jobId, CancellationToken ct)
    {
        var req = BuildRequest(HttpMethod.Post, $"api/talentos/import-jobs/{jobId}/aprovar", tenantId);
        return SendAsync(req, ct);
    }

    public Task<ApiRawResponse> RecusarImportJobRawAsync(string tenantId, Guid jobId, CancellationToken ct)
    {
        var req = BuildRequest(HttpMethod.Post, $"api/talentos/import-jobs/{jobId}/recusar", tenantId);
        return SendAsync(req, ct);
    }

    public Task<HttpResponseMessage> DownloadDocumentoAsync(string tenantId, Guid talentoId, Guid documentoId, CancellationToken ct)
    {
        var req = BuildRequest(HttpMethod.Get, $"api/talentos/{talentoId}/documentos/{documentoId}/download", tenantId);
        return _http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
    }

    private static HttpRequestMessage BuildRequest(HttpMethod method, string url, string tenantId, HttpContent? body = null)
    {
        var req = new HttpRequestMessage(method, url);
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Headers.TryAddWithoutValidation("Accept", "application/json");
        if (body != null) req.Content = body;
        return req;
    }

    private async Task<ApiRawResponse> SendAsync(HttpRequestMessage req, CancellationToken ct)
    {
        using var res = await _http.SendAsync(req, ct);
        var content = await res.Content.ReadAsStringAsync(ct);
        return new ApiRawResponse(res.StatusCode, content);
    }
}
