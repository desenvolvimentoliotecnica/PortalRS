using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using LioTecnica.Web.ViewModels.Admin;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class RolesApiClient
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public RolesApiClient(HttpClient http)
    {
        _http = http;
    }

    public async Task<IReadOnlyList<RoleListItemViewModel>> ListAsync(CancellationToken ct)
    {
        using var response = await _http.GetAsync("api/roles", ct);
        if (response.StatusCode == HttpStatusCode.Unauthorized)
            return Array.Empty<RoleListItemViewModel>();

        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<IReadOnlyList<RoleListItemViewModel>>(JsonOptions, ct)
               ?? Array.Empty<RoleListItemViewModel>();
    }

    public async Task<RoleResponseViewModel?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        using var response = await _http.GetAsync($"api/roles/{id}", ct);
        if (!response.IsSuccessStatusCode) return null;

        return await response.Content.ReadFromJsonAsync<RoleResponseViewModel>(JsonOptions, ct);
    }

    public async Task<RoleResponseViewModel?> CreateAsync(RoleCreateRequest request, CancellationToken ct)
    {
        using var response = await _http.PostAsJsonAsync("api/roles", request, JsonOptions, ct);
        if (!response.IsSuccessStatusCode) return null;

        return await response.Content.ReadFromJsonAsync<RoleResponseViewModel>(JsonOptions, ct);
    }

    public async Task<RoleResponseViewModel?> UpdateAsync(Guid id, RoleUpdateRequest request, CancellationToken ct)
    {
        using var response = await _http.PutAsJsonAsync($"api/roles/{id}", request, JsonOptions, ct);
        if (!response.IsSuccessStatusCode) return null;

        return await response.Content.ReadFromJsonAsync<RoleResponseViewModel>(JsonOptions, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        using var response = await _http.DeleteAsync($"api/roles/{id}", ct);
        return response.IsSuccessStatusCode;
    }

    public async Task<IReadOnlyList<RoleMenuAssignmentViewModel>> GetRoleMenusAsync(Guid id, CancellationToken ct)
    {
        using var response = await _http.GetAsync($"api/roles/{id}/menus", ct);
        if (!response.IsSuccessStatusCode) return Array.Empty<RoleMenuAssignmentViewModel>();

        return await response.Content.ReadFromJsonAsync<IReadOnlyList<RoleMenuAssignmentViewModel>>(JsonOptions, ct)
               ?? Array.Empty<RoleMenuAssignmentViewModel>();
    }

    public async Task<bool> UpdateRoleMenusAsync(Guid id, RoleMenusUpdateRequest request, CancellationToken ct)
    {
        using var response = await _http.PutAsJsonAsync($"api/roles/{id}/menus", request, JsonOptions, ct);
        return response.IsSuccessStatusCode;
    }

    public sealed record RoleCreateRequest(string Name, string Description, bool IsActive);
    public sealed record RoleUpdateRequest(string Name, string Description, bool IsActive);
    public sealed record RoleMenusUpdateRequest(IReadOnlyList<RoleMenuAssignmentViewModel> Items);
}
