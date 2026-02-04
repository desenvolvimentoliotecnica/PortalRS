using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using LioTecnica.Web.Infrastructure.Serialization;
using LioTecnica.Web.ViewModels.Admin;

namespace LioTecnica.Web.Infrastructure.ApiClients;

/// <summary>Cliente para gestão de usuários de um tenant pelo Owner (api/owner/tenants/{tenantId}/...).</summary>
public sealed class OwnerTenantUsersApiClient
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new EnumNameOrNumberToIntConverter() }
    };

    public OwnerTenantUsersApiClient(HttpClient http)
    {
        _http = http;
    }

    private static string TenantPath(string tenantId) => $"api/owner/tenants/{Uri.EscapeDataString(tenantId)}";

    /// <summary>Lista usuários do tenant. Retorna null se a chamada à API falhar (ex.: 401).</summary>
    public async Task<IReadOnlyList<UserListItemViewModel>?> ListUsersAsync(string tenantId, CancellationToken ct)
    {
        var url = $"{TenantPath(tenantId)}/users";
        using var response = await _http.GetAsync(url, ct);
        if (!response.IsSuccessStatusCode)
            return null;
        var body = await response.Content.ReadAsStringAsync(ct);
        List<UserListItemApiDto>? list;
        try
        {
            list = System.Text.Json.JsonSerializer.Deserialize<List<UserListItemApiDto>>(body, JsonOptions);
        }
        catch
        {
            return null;
        }
        if (list == null)
            return Array.Empty<UserListItemViewModel>();
        return list.Select(u => new UserListItemViewModel(u.Id, u.FullName ?? "", u.Email ?? "", u.IsActive, (IReadOnlyList<string>)(u.Roles ?? new List<string>()))).ToList();
    }

    public async Task<UserResponseViewModel?> GetUserAsync(string tenantId, Guid userId, CancellationToken ct)
    {
        using var response = await _http.GetAsync($"{TenantPath(tenantId)}/users/{userId}", ct);
        if (!response.IsSuccessStatusCode) return null;
        return await response.Content.ReadFromJsonAsync<UserResponseViewModel>(JsonOptions, ct);
    }

    public async Task<UserResponseViewModel?> CreateUserAsync(string tenantId, UsersApiClient.UserCreateRequest request, CancellationToken ct)
    {
        using var response = await _http.PostAsJsonAsync($"{TenantPath(tenantId)}/users", request, JsonOptions, ct);
        if (!response.IsSuccessStatusCode) return null;
        return await response.Content.ReadFromJsonAsync<UserResponseViewModel>(JsonOptions, ct);
    }

    public async Task<UserResponseViewModel?> UpdateUserAsync(string tenantId, Guid userId, UsersApiClient.UserUpdateRequest request, CancellationToken ct)
    {
        using var response = await _http.PutAsJsonAsync($"{TenantPath(tenantId)}/users/{userId}", request, JsonOptions, ct);
        if (!response.IsSuccessStatusCode) return null;
        return await response.Content.ReadFromJsonAsync<UserResponseViewModel>(JsonOptions, ct);
    }

    public async Task<UserResponseViewModel?> UpdateUserStatusAsync(string tenantId, Guid userId, bool isActive, CancellationToken ct)
    {
        var body = new { isActive };
        using var response = await _http.PatchAsJsonAsync($"{TenantPath(tenantId)}/users/{userId}/status", body, JsonOptions, ct);
        if (!response.IsSuccessStatusCode) return null;
        return await response.Content.ReadFromJsonAsync<UserResponseViewModel>(JsonOptions, ct);
    }

    public async Task<UserResponseViewModel?> UpdateUserRolesAsync(string tenantId, Guid userId, IReadOnlyList<Guid> roleIds, CancellationToken ct)
    {
        var body = new { roleIds };
        using var response = await _http.PutAsJsonAsync($"{TenantPath(tenantId)}/users/{userId}/roles", body, JsonOptions, ct);
        if (!response.IsSuccessStatusCode) return null;
        return await response.Content.ReadFromJsonAsync<UserResponseViewModel>(JsonOptions, ct);
    }

    public async Task<UserResponseViewModel?> SetUserPasswordAsync(string tenantId, Guid userId, string newPassword, CancellationToken ct)
    {
        var body = new { newPassword };
        using var response = await _http.PutAsJsonAsync($"{TenantPath(tenantId)}/users/{userId}/password", body, JsonOptions, ct);
        if (!response.IsSuccessStatusCode) return null;
        return await response.Content.ReadFromJsonAsync<UserResponseViewModel>(JsonOptions, ct);
    }

    public async Task<bool> DeleteUserAsync(string tenantId, Guid userId, CancellationToken ct)
    {
        using var response = await _http.DeleteAsync($"{TenantPath(tenantId)}/users/{userId}", ct);
        return response.IsSuccessStatusCode;
    }

    public async Task<IReadOnlyList<RoleListItemViewModel>> ListRolesAsync(string tenantId, CancellationToken ct)
    {
        using var response = await _http.GetAsync($"{TenantPath(tenantId)}/roles", ct);
        if (!response.IsSuccessStatusCode) return Array.Empty<RoleListItemViewModel>();
        var list = await response.Content.ReadFromJsonAsync<IReadOnlyList<RoleListItemViewModel>>(JsonOptions, ct);
        return list ?? Array.Empty<RoleListItemViewModel>();
    }

    public async Task<OwnerUnitsPagedResponse> ListUnitsAsync(string tenantId, int page = 1, int pageSize = 500, CancellationToken ct = default)
    {
        using var response = await _http.GetAsync($"{TenantPath(tenantId)}/units?page={page}&pageSize={pageSize}", ct);
        if (!response.IsSuccessStatusCode) return new OwnerUnitsPagedResponse(Array.Empty<UnitInfoViewModel>(), 0);
        var data = await response.Content.ReadFromJsonAsync<PagedResult<UnitGridRow>>(JsonOptions, ct);
        if (data?.Items == null) return new OwnerUnitsPagedResponse(Array.Empty<UnitInfoViewModel>(), 0);
        var units = data.Items.Select(x => new UnitInfoViewModel(x.Id, x.Code ?? "", x.Name ?? "")).ToList();
        return new OwnerUnitsPagedResponse(units, data.TotalItems);
    }

    public async Task<OwnerFuncionariosPagedResponse> ListFuncionariosAsync(string tenantId, int page = 1, int pageSize = 500, CancellationToken ct = default)
    {
        using var response = await _http.GetAsync($"{TenantPath(tenantId)}/funcionarios?page={page}&pageSize={pageSize}", ct);
        if (!response.IsSuccessStatusCode) return new OwnerFuncionariosPagedResponse(Array.Empty<FuncionarioInfoViewModel>(), 0);
        var data = await response.Content.ReadFromJsonAsync<PagedResult<FuncionarioGridRow>>(JsonOptions, ct);
        if (data?.Items == null) return new OwnerFuncionariosPagedResponse(Array.Empty<FuncionarioInfoViewModel>(), 0);
        var list = data.Items.Select(x => new FuncionarioInfoViewModel(x.Id, x.Name ?? "", x.Email)).ToList();
        return new OwnerFuncionariosPagedResponse(list, data.TotalItems);
    }
}

public sealed record OwnerUnitsPagedResponse(IReadOnlyList<UnitInfoViewModel> Items, int TotalCount);
public sealed record OwnerFuncionariosPagedResponse(IReadOnlyList<FuncionarioInfoViewModel> Items, int TotalCount);

internal sealed class PagedResult<T>
{
    public List<T>? Items { get; set; }
    public int TotalItems { get; set; }
}

internal sealed class UnitGridRow
{
    public Guid Id { get; set; }
    public string? Code { get; set; }
    public string? Name { get; set; }
}

internal sealed class FuncionarioGridRow
{
    public Guid Id { get; set; }
    public string? Name { get; set; }
    public string? Email { get; set; }
}

/// <summary>Formato exato da API UserListItemResponse para deserialização.</summary>
internal sealed class UserListItemApiDto
{
    public Guid Id { get; set; }
    public string? FullName { get; set; }
    public string? Email { get; set; }
    public bool IsActive { get; set; }
    public List<string>? Roles { get; set; }
    public List<UnitInfoApiDto>? Units { get; set; }
    public ManagerInfoApiDto? Manager { get; set; }
}

internal sealed class UnitInfoApiDto
{
    public Guid Id { get; set; }
    public string? Code { get; set; }
    public string? Name { get; set; }
}

internal sealed class ManagerInfoApiDto
{
    public Guid Id { get; set; }
    public string? Name { get; set; }
    public string? Email { get; set; }
}
