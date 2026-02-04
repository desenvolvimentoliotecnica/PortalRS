using System.Net.Http.Json;
using System.Text.Json;
using LioTecnica.Web.ViewModels.Authentication;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class OwnerAuthApiClient
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public OwnerAuthApiClient(HttpClient http)
    {
        _http = http;
    }

    public async Task<OwnerLoginResponse?> LoginAsync(string email, string password, CancellationToken ct)
    {
        var request = new { email = email.Trim(), password };
        using var response = await _http.PostAsJsonAsync("api/owner/auth/login", request, JsonOptions, ct);
        if (!response.IsSuccessStatusCode)
            return null;
        return await response.Content.ReadFromJsonAsync<OwnerLoginResponse>(JsonOptions, ct);
    }
}
