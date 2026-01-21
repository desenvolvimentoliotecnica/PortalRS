using System.Net.Http.Json;
using System.Text.Json;
using LioTecnica.Web.ViewModels.Authentication;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class AuthApiClient
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public AuthApiClient(HttpClient http)
    {
        _http = http;
    }

    public async Task<LoginResponse?> LoginAsync(string tenantId, string email, string password, CancellationToken ct)
    {
        var request = new
        {
            email,
            password
        };

        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, "api/auth/login")
        {
            Content = JsonContent.Create(request, options: JsonOptions)
        };
        httpRequest.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);

        using var response = await _http.SendAsync(httpRequest, ct);
        if (!response.IsSuccessStatusCode)
            return null;

        return await response.Content.ReadFromJsonAsync<LoginResponse>(JsonOptions, ct);
    }

    public async Task<CurrentUserResponse?> GetCurrentUserAsync(CancellationToken ct)
    {
        using var response = await _http.GetAsync("api/auth/me", ct);
        if (!response.IsSuccessStatusCode)
            return null;

        return await response.Content.ReadFromJsonAsync<CurrentUserResponse>(JsonOptions, ct);
    }
}
