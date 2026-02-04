using System.Net;
using System.Text;
using System.Text.Json;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class FeedbackApiClient
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public FeedbackApiClient(HttpClient http) => _http = http;

    public Task<ApiRawResponse> GetCelebrationFeedRawAsync(string tenantId, int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        var qs = $"?page={page}&pageSize={pageSize}";
        var req = BuildRequest(HttpMethod.Get, $"api/feedback/celebrations/feed{qs}", tenantId);
        return SendAsync(req, ct);
    }

    public Task<ApiRawResponse> CreateCelebrationPostRawAsync(string tenantId, object payload, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(payload, JsonOpts);
        var req = BuildRequest(HttpMethod.Post, "api/feedback/celebrations", tenantId, json);
        return SendAsync(req, ct);
    }

    public Task<ApiRawResponse> GetCelebrationMentionUsersRawAsync(string tenantId, string? q, int take = 20, CancellationToken ct = default)
    {
        var qs = $"?take={take}";
        if (!string.IsNullOrWhiteSpace(q))
            qs += "&q=" + Uri.EscapeDataString(q);
        var req = BuildRequest(HttpMethod.Get, "api/feedback/celebrations/mention-users" + qs, tenantId);
        return SendAsync(req, ct);
    }

    public Task<ApiRawResponse> CreateFeedbackRawAsync(string tenantId, object payload, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(payload, JsonOpts);
        var req = BuildRequest(HttpMethod.Post, "api/feedback/items", tenantId, json);
        return SendAsync(req, ct);
    }

    public Task<ApiRawResponse> GetFeedbackMineRawAsync(string tenantId, string? filter = null, int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        var qs = $"?page={page}&pageSize={pageSize}";
        if (!string.IsNullOrWhiteSpace(filter))
            qs += "&filter=" + Uri.EscapeDataString(filter);
        var req = BuildRequest(HttpMethod.Get, "api/feedback/items/mine" + qs, tenantId);
        return SendAsync(req, ct);
    }

    public Task<ApiRawResponse> GetFeedbackAllRawAsync(string tenantId, int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        var qs = $"?page={page}&pageSize={pageSize}";
        var req = BuildRequest(HttpMethod.Get, "api/feedback/items/all" + qs, tenantId);
        return SendAsync(req, ct);
    }

    public Task<ApiRawResponse> GetPlansMyRawAsync(string tenantId, int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        var qs = $"?page={page}&pageSize={pageSize}";
        var req = BuildRequest(HttpMethod.Get, "api/feedback/plans/my" + qs, tenantId);
        return SendAsync(req, ct);
    }

    public Task<ApiRawResponse> GetPlansTeamRawAsync(string tenantId, Guid? targetUserId = null, int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        var qs = $"?page={page}&pageSize={pageSize}";
        if (targetUserId.HasValue) qs += "&targetUserId=" + targetUserId.Value;
        var req = BuildRequest(HttpMethod.Get, "api/feedback/plans/team" + qs, tenantId);
        return SendAsync(req, ct);
    }

    public Task<ApiRawResponse> GetOneOnOneListRawAsync(string tenantId, int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        var qs = $"?page={page}&pageSize={pageSize}";
        var req = BuildRequest(HttpMethod.Get, "api/feedback/oneonone" + qs, tenantId);
        return SendAsync(req, ct);
    }

    public Task<ApiRawResponse> GetOneOnOneByIdRawAsync(string tenantId, Guid id, CancellationToken ct = default)
    {
        var req = BuildRequest(HttpMethod.Get, "api/feedback/oneonone/" + id, tenantId);
        return SendAsync(req, ct);
    }

    public Task<ApiRawResponse> CreateOneOnOneRawAsync(string tenantId, object payload, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(payload, JsonOpts);
        var req = BuildRequest(HttpMethod.Post, "api/feedback/oneonone", tenantId, json);
        return SendAsync(req, ct);
    }

    public Task<ApiRawResponse> UpdateOneOnOneRawAsync(string tenantId, Guid id, object payload, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(payload, JsonOpts);
        var req = BuildRequest(HttpMethod.Put, "api/feedback/oneonone/" + id, tenantId, json);
        return SendAsync(req, ct);
    }

    public Task<ApiRawResponse> DeleteOneOnOneRawAsync(string tenantId, Guid id, CancellationToken ct)
    {
        var req = BuildRequest(HttpMethod.Delete, "api/feedback/oneonone/" + id, tenantId);
        return SendAsync(req, ct);
    }

    public Task<ApiRawResponse> GetGamificationLeaderboardRawAsync(string tenantId, int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        var qs = $"?page={page}&pageSize={pageSize}";
        var req = BuildRequest(HttpMethod.Get, "api/feedback/gamification/leaderboard" + qs, tenantId);
        return SendAsync(req, ct);
    }

    public Task<ApiRawResponse> GetGamificationMyBalanceRawAsync(string tenantId, CancellationToken ct = default)
    {
        var req = BuildRequest(HttpMethod.Get, "api/feedback/gamification/my-balance", tenantId);
        return SendAsync(req, ct);
    }

    private static HttpRequestMessage BuildRequest(HttpMethod method, string url, string tenantId, string? jsonBody = null)
    {
        var req = new HttpRequestMessage(method, url);
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Headers.TryAddWithoutValidation("Accept", "application/json");
        if (jsonBody != null)
            req.Content = new StringContent(jsonBody, Encoding.UTF8, "application/json");
        return req;
    }

    private async Task<ApiRawResponse> SendAsync(HttpRequestMessage req, CancellationToken ct)
    {
        using var res = await _http.SendAsync(req, ct);
        var content = await res.Content.ReadAsStringAsync(ct);
        return new ApiRawResponse(res.StatusCode, content);
    }
}
