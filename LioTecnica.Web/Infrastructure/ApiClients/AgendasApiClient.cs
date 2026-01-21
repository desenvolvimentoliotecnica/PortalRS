using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using LioTecnica.Web.ViewModels.Agenda;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class AgendasApiClient
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public AgendasApiClient(HttpClient http)
    {
        _http = http;
    }

    public async Task<IReadOnlyList<AgendaEventTypeViewModel>> ListTypesAsync(CancellationToken ct)
    {
        using var response = await _http.GetAsync("api/agenda/types", ct);
        if (response.StatusCode == HttpStatusCode.Unauthorized)
            return Array.Empty<AgendaEventTypeViewModel>();

        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<IReadOnlyList<AgendaEventTypeViewModel>>(JsonOptions, ct)
               ?? Array.Empty<AgendaEventTypeViewModel>();
    }

    public async Task<IReadOnlyList<AgendaEventViewModel>> ListEventsAsync(
        DateTime? start,
        DateTime? end,
        string? search,
        string? type,
        string? status,
        CancellationToken ct)
    {
        var qs = new List<string>();
        if (start.HasValue) qs.Add($"start={Uri.EscapeDataString(start.Value.ToString("s"))}");
        if (end.HasValue) qs.Add($"end={Uri.EscapeDataString(end.Value.ToString("s"))}");
        if (!string.IsNullOrWhiteSpace(search)) qs.Add($"search={Uri.EscapeDataString(search)}");
        if (!string.IsNullOrWhiteSpace(type)) qs.Add($"type={Uri.EscapeDataString(type)}");
        if (!string.IsNullOrWhiteSpace(status)) qs.Add($"status={Uri.EscapeDataString(status)}");

        var url = "api/agenda/events";
        if (qs.Count > 0) url += "?" + string.Join("&", qs);

        using var response = await _http.GetAsync(url, ct);
        if (response.StatusCode == HttpStatusCode.Unauthorized)
            return Array.Empty<AgendaEventViewModel>();

        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<IReadOnlyList<AgendaEventViewModel>>(JsonOptions, ct)
               ?? Array.Empty<AgendaEventViewModel>();
    }

    public async Task<AgendaEventViewModel?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        using var response = await _http.GetAsync($"api/agenda/events/{id}", ct);
        if (!response.IsSuccessStatusCode) return null;

        return await response.Content.ReadFromJsonAsync<AgendaEventViewModel>(JsonOptions, ct);
    }

    public async Task<AgendaEventViewModel?> CreateAsync(AgendaEventRequest request, CancellationToken ct)
    {
        using var response = await _http.PostAsJsonAsync("api/agenda/events", request, JsonOptions, ct);
        if (!response.IsSuccessStatusCode) return null;

        return await response.Content.ReadFromJsonAsync<AgendaEventViewModel>(JsonOptions, ct);
    }

    public async Task<AgendaEventViewModel?> UpdateAsync(Guid id, AgendaEventRequest request, CancellationToken ct)
    {
        using var response = await _http.PutAsJsonAsync($"api/agenda/events/{id}", request, JsonOptions, ct);
        if (!response.IsSuccessStatusCode) return null;

        return await response.Content.ReadFromJsonAsync<AgendaEventViewModel>(JsonOptions, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        using var response = await _http.DeleteAsync($"api/agenda/events/{id}", ct);
        return response.IsSuccessStatusCode;
    }
}
