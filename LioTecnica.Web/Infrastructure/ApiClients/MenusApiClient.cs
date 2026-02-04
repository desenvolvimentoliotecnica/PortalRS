using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using LioTecnica.Web.ViewModels.Admin;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class MenusApiClient
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public MenusApiClient(HttpClient http)
    {
        _http = http;
    }

    public async Task<IReadOnlyList<MenuListItemViewModel>> ListAsync(CancellationToken ct)
    {
        using var response = await _http.GetAsync("api/menus", ct);
        if (response.StatusCode == HttpStatusCode.Unauthorized)
            return Array.Empty<MenuListItemViewModel>();

        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<IReadOnlyList<MenuListItemViewModel>>(JsonOptions, ct)
               ?? Array.Empty<MenuListItemViewModel>();
    }

    public async Task<MenuResponseViewModel?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        using var response = await _http.GetAsync($"api/menus/{id}", ct);
        if (!response.IsSuccessStatusCode) return null;

        return await response.Content.ReadFromJsonAsync<MenuResponseViewModel>(JsonOptions, ct);
    }

    public async Task<MenuResponseViewModel?> CreateAsync(MenuCreateRequest request, CancellationToken ct)
    {
        using var response = await _http.PostAsJsonAsync("api/menus", request, JsonOptions, ct);
        if (!response.IsSuccessStatusCode) return null;

        return await response.Content.ReadFromJsonAsync<MenuResponseViewModel>(JsonOptions, ct);
    }

    public async Task<MenuResponseViewModel?> UpdateAsync(Guid id, MenuUpdateRequest request, CancellationToken ct)
    {
        using var response = await _http.PutAsJsonAsync($"api/menus/{id}", request, JsonOptions, ct);
        if (!response.IsSuccessStatusCode) return null;

        return await response.Content.ReadFromJsonAsync<MenuResponseViewModel>(JsonOptions, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        using var response = await _http.DeleteAsync($"api/menus/{id}", ct);
        return response.IsSuccessStatusCode;
    }

    public async Task<IReadOnlyList<MenuForCurrentUserViewModel>> ListForCurrentUserAsync(CancellationToken ct)
    {
        using var response = await _http.GetAsync("api/menus/for-current-user", ct);
        if (response.StatusCode == HttpStatusCode.Unauthorized)
            return Array.Empty<MenuForCurrentUserViewModel>();

        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<IReadOnlyList<MenuForCurrentUserViewModel>>(JsonOptions, ct)
               ?? Array.Empty<MenuForCurrentUserViewModel>();
    }

    public sealed record MenuCreateRequest(
        string DisplayName,
        string Route,
        string Icon,
        int Order,
        Guid? ParentId,
        string PermissionKey,
        bool IsActive
    );

    public sealed record MenuUpdateRequest(
        string DisplayName,
        string Route,
        string Icon,
        int Order,
        Guid? ParentId,
        string PermissionKey,
        bool IsActive
    );
}
