using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using LioTecnica.Web.ViewModels.Admin;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class EmailTemplatesApiClient
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public EmailTemplatesApiClient(HttpClient http) => _http = http;

    public async Task<IReadOnlyList<EmailTemplateListItemViewModel>?> ListAsync(bool includeInactive, CancellationToken ct)
    {
        var url = $"api/email-templates?includeInactive={includeInactive.ToString().ToLowerInvariant()}";
        using var response = await _http.GetAsync(url, ct);
        if (!response.IsSuccessStatusCode)
            return null;
        return await response.Content.ReadFromJsonAsync<IReadOnlyList<EmailTemplateListItemViewModel>>(JsonOptions, ct);
    }

    public async Task<EmailTemplateResponseViewModel?> GetAsync(Guid id, CancellationToken ct)
    {
        using var response = await _http.GetAsync($"api/email-templates/{id}", ct);
        if (!response.IsSuccessStatusCode)
            return null;
        return await response.Content.ReadFromJsonAsync<EmailTemplateResponseViewModel>(JsonOptions, ct);
    }

    public async Task<EmailTemplateResponseViewModel?> CreateAsync(EmailTemplateCreateViewModel request, CancellationToken ct)
    {
        using var response = await _http.PostAsJsonAsync("api/email-templates", request, JsonOptions, ct);
        if (response.StatusCode == HttpStatusCode.Conflict)
            return null;
        if (!response.IsSuccessStatusCode)
            return null;
        return await response.Content.ReadFromJsonAsync<EmailTemplateResponseViewModel>(JsonOptions, ct);
    }

    public async Task<EmailTemplateResponseViewModel?> UpdateAsync(Guid id, EmailTemplateUpdateViewModel request, CancellationToken ct)
    {
        using var response = await _http.PutAsJsonAsync($"api/email-templates/{id}", request, JsonOptions, ct);
        if (!response.IsSuccessStatusCode)
            return null;
        return await response.Content.ReadFromJsonAsync<EmailTemplateResponseViewModel>(JsonOptions, ct);
    }

    public async Task<bool> SetActiveAsync(Guid id, CancellationToken ct)
    {
        using var response = await _http.PostAsync($"api/email-templates/{id}/set-active", null, ct);
        return response.IsSuccessStatusCode;
    }
}
