using System.Net;
using System.Text;
using System.Text.Json;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class BloqueioPessoaApiClient
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public BloqueioPessoaApiClient(HttpClient http) => _http = http;

    public async Task<ApiRawResponse> ListAsync(
        string tenantId,
        string? q,
        int page = 1,
        int pageSize = 20,
        CancellationToken ct = default)
    {
        var url = "api/bloqueio-pessoa?page=" + Math.Max(1, page) + "&pageSize=" + Math.Clamp(pageSize, 1, 100);
        if (!string.IsNullOrWhiteSpace(q))
            url += "&q=" + Uri.EscapeDataString(q);
        var req = BuildRequest(HttpMethod.Get, url, tenantId);
        return await SendAsync(req, ct);
    }

    public async Task<ApiRawResponse> GetByIdAsync(string tenantId, Guid id, CancellationToken ct = default)
    {
        var req = BuildRequest(HttpMethod.Get, "api/bloqueio-pessoa/" + id, tenantId);
        return await SendAsync(req, ct);
    }

    public async Task<ApiRawResponse> CreateManualAsync(
        string tenantId,
        string nome,
        string email,
        string? motivo,
        CancellationToken ct = default)
    {
        var body = JsonSerializer.Serialize(new { nome, email, motivo }, JsonOpts);
        var content = new StringContent(body, Encoding.UTF8, "application/json");
        var req = BuildRequest(HttpMethod.Post, "api/bloqueio-pessoa", tenantId, content);
        return await SendAsync(req, ct);
    }

    public async Task<ApiRawResponse> CreateFromCandidatoAsync(string tenantId, Guid candidatoId, CancellationToken ct = default)
    {
        var req = BuildRequest(HttpMethod.Post, "api/bloqueio-pessoa/from-candidato/" + candidatoId, tenantId);
        return await SendAsync(req, ct);
    }

    public async Task<ApiRawResponse> CreateFromFuncionarioAsync(string tenantId, Guid funcionarioId, CancellationToken ct = default)
    {
        var req = BuildRequest(HttpMethod.Post, "api/bloqueio-pessoa/from-funcionario/" + funcionarioId, tenantId);
        return await SendAsync(req, ct);
    }

    public async Task<ApiRawResponse> CreateFromTalentoAsync(string tenantId, Guid talentoId, CancellationToken ct = default)
    {
        var req = BuildRequest(HttpMethod.Post, "api/bloqueio-pessoa/from-talento/" + talentoId, tenantId);
        return await SendAsync(req, ct);
    }

    public async Task<ApiRawResponse> BlockByPessoaIdAsync(string tenantId, Guid pessoaId, string? motivo, CancellationToken ct = default)
    {
        var body = JsonSerializer.Serialize(new { motivo }, JsonOpts);
        var content = new StringContent(body, Encoding.UTF8, "application/json");
        var req = BuildRequest(HttpMethod.Post, "api/bloqueio-pessoa/block/" + pessoaId, tenantId, content);
        return await SendAsync(req, ct);
    }

    public async Task<ApiRawResponse> DeleteAsync(string tenantId, Guid id, CancellationToken ct = default)
    {
        var req = BuildRequest(HttpMethod.Delete, "api/bloqueio-pessoa/" + id, tenantId);
        return await SendAsync(req, ct);
    }

    private static HttpRequestMessage BuildRequest(HttpMethod method, string url, string tenantId, HttpContent? body = null)
    {
        var req = new HttpRequestMessage(method, url);
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Headers.TryAddWithoutValidation("Accept", "application/json");
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
