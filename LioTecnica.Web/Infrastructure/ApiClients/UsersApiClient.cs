using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using LioTecnica.Web.ViewModels.Admin;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class UsersApiClient
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public UsersApiClient(HttpClient http)
    {
        _http = http;
    }

    /// <summary>
    /// Lista usuários que possuem o perfil (role) Gestor — para seleção no cadastro de gestores.
    /// </summary>
    public async Task<IReadOnlyList<UserGestorLookupItem>> GetUsersGestoresAsync(string tenantId, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, "api/lookup/users-gestores");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId ?? "");
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var response = await _http.SendAsync(req, ct);
        if (response.StatusCode == HttpStatusCode.Unauthorized)
            return Array.Empty<UserGestorLookupItem>();

        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<IReadOnlyList<UserGestorLookupItem>>(JsonOptions, ct)
               ?? Array.Empty<UserGestorLookupItem>();
    }

    public async Task<IReadOnlyList<UserListItemViewModel>> ListAsync(CancellationToken ct)
    {
        using var response = await _http.GetAsync("api/users", ct);
        if (response.StatusCode == HttpStatusCode.Unauthorized)
            return Array.Empty<UserListItemViewModel>();

        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<IReadOnlyList<UserListItemViewModel>>(JsonOptions, ct)
               ?? Array.Empty<UserListItemViewModel>();
    }

    public async Task<UserResponseViewModel?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        using var response = await _http.GetAsync($"api/users/{id}", ct);
        if (!response.IsSuccessStatusCode) return null;

        return await response.Content.ReadFromJsonAsync<UserResponseViewModel>(JsonOptions, ct);
    }

    public async Task<UserResponseViewModel?> CreateAsync(UserCreateRequest request, CancellationToken ct)
    {
        using var response = await _http.PostAsJsonAsync("api/users", request, JsonOptions, ct);
        if (!response.IsSuccessStatusCode) return null;

        return await response.Content.ReadFromJsonAsync<UserResponseViewModel>(JsonOptions, ct);
    }

    public async Task<UserResponseViewModel?> UpdateAsync(Guid id, UserUpdateRequest request, CancellationToken ct)
    {
        using var response = await _http.PutAsJsonAsync($"api/users/{id}", request, JsonOptions, ct);
        if (!response.IsSuccessStatusCode) return null;

        return await response.Content.ReadFromJsonAsync<UserResponseViewModel>(JsonOptions, ct);
    }

    public async Task<UserResponseViewModel?> UpdateStatusAsync(Guid id, bool isActive, CancellationToken ct)
    {
        var request = new UserStatusUpdateRequest(isActive);
        using var response = await _http.PatchAsJsonAsync($"api/users/{id}/status", request, JsonOptions, ct);
        if (!response.IsSuccessStatusCode) return null;

        return await response.Content.ReadFromJsonAsync<UserResponseViewModel>(JsonOptions, ct);
    }

    public async Task<UserResponseViewModel?> UpdateRolesAsync(Guid id, IReadOnlyList<Guid> roleIds, CancellationToken ct)
    {
        var request = new UserRolesUpdateRequest(roleIds);
        using var response = await _http.PutAsJsonAsync($"api/users/{id}/roles", request, JsonOptions, ct);
        if (!response.IsSuccessStatusCode) return null;

        return await response.Content.ReadFromJsonAsync<UserResponseViewModel>(JsonOptions, ct);
    }

    public async Task<UserResponseViewModel?> SetPasswordAsync(Guid id, string newPassword, CancellationToken ct)
    {
        var request = new UserPasswordUpdateRequest(newPassword);
        using var response = await _http.PutAsJsonAsync($"api/users/{id}/password", request, JsonOptions, ct);
        if (!response.IsSuccessStatusCode) return null;

        return await response.Content.ReadFromJsonAsync<UserResponseViewModel>(JsonOptions, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        using var response = await _http.DeleteAsync($"api/users/{id}", ct);
        return response.IsSuccessStatusCode;
    }

    public sealed record UserCreateRequest(
        string Email,
        string FullName,
        string Password,
        bool IsActive,
        IReadOnlyList<Guid> RoleIds,
        IReadOnlyList<Guid>? UnitIds,
        Guid? FuncionarioId
    );

    public sealed record UserUpdateRequest(
        string Email,
        string FullName,
        bool IsActive,
        IReadOnlyList<Guid>? UnitIds,
        Guid? FuncionarioId
    );

    public sealed record UserStatusUpdateRequest(bool IsActive);

    public sealed record UserRolesUpdateRequest(IReadOnlyList<Guid> RoleIds);

    public sealed record UserPasswordUpdateRequest(string NewPassword);

    /// <summary>
    /// Usuário com perfil Gestor, para seleção no cadastro de gestores.
    /// </summary>
    public sealed record UserGestorLookupItem(Guid Id, string Name, string Email);
}
