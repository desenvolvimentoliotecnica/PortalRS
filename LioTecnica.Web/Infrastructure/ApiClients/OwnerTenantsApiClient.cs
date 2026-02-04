using System.Net.Http.Json;
using System.Text.Json;
using RhPortal.Web.Infrastructure.ApiClients;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed record TenantListItemDto(string TenantId, string Name, bool IsActive, DateTimeOffset CreatedAtUtc, DateTimeOffset UpdatedAtUtc);

/// <summary>Detalhes do tenant para tela de detalhes (inclui criador).</summary>
public sealed record TenantDetailDto(
    string TenantId,
    string Name,
    bool IsActive,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    Guid? CreatedByOwnerId,
    string? CreatedByOwnerEmail
);

/// <summary>Status de migrações do tenant (se o schema está em dia).</summary>
public sealed record TenantMigrationStatusDto(string TenantId, bool IsUpToDate, int PendingCount, IReadOnlyList<string> PendingMigrationIds, string? ErrorMessage);

public sealed record TenantMigrationsApplyResultDto(int AppliedCount);

/// <summary>Tenant com status de migrações para a tela de listagem.</summary>
public sealed record TenantWithStatusDto(
    string TenantId,
    string Name,
    bool IsActive,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    bool? IsUpToDate,
    int PendingCount,
    string? MigrationError
);

public sealed class OwnerTenantsApiClient
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public OwnerTenantsApiClient(HttpClient http)
    {
        _http = http;
    }

    public async Task<IReadOnlyList<TenantListItemDto>?> ListTenantsAsync(CancellationToken ct)
    {
        using var response = await _http.GetAsync("api/owner/tenants", ct);
        if (!response.IsSuccessStatusCode)
            return null;
        return await response.Content.ReadFromJsonAsync<IReadOnlyList<TenantListItemDto>>(JsonOptions, ct);
    }

    public async Task<(bool Success, string? Error)> CreateTenantAsync(string tenantId, string name, CancellationToken ct)
    {
        var request = new { tenantId = tenantId.Trim().ToLowerInvariant(), name = name.Trim() };
        using var response = await _http.PostAsJsonAsync("api/owner/tenants", request, JsonOptions, ct);
        if (response.IsSuccessStatusCode)
            return (true, null);
        var body = await response.Content.ReadAsStringAsync(ct);
        // Extrai "detail" do ProblemDetails (API retorna JSON) para exibir mensagem clara
        var error = TryGetProblemDetail(body) ?? body?.Trim();
        if (string.IsNullOrWhiteSpace(error))
            error = $"A API retornou {(int)response.StatusCode} ({response.StatusCode}). Verifique os logs da API.";
        return (false, error);
    }

    /// <summary>Obtém detalhes de um tenant.</summary>
    public async Task<TenantDetailDto?> GetTenantAsync(string tenantId, CancellationToken ct)
    {
        var id = tenantId?.Trim().ToLowerInvariant() ?? "";
        using var response = await _http.GetAsync($"api/owner/tenants/{Uri.EscapeDataString(id)}", ct);
        if (!response.IsSuccessStatusCode)
            return null;
        return await response.Content.ReadFromJsonAsync<TenantDetailDto>(JsonOptions, ct);
    }

    /// <summary>Elimina o tenant (soft delete: IsActive = false; bloqueia acesso dos usuários).</summary>
    public async Task<(bool Success, string? Error)> DeleteTenantAsync(string tenantId, CancellationToken ct)
    {
        var id = tenantId?.Trim().ToLowerInvariant() ?? "";
        using var response = await _http.DeleteAsync($"api/owner/tenants/{Uri.EscapeDataString(id)}", ct);
        if (response.IsSuccessStatusCode)
            return (true, null);
        var body = await response.Content.ReadAsStringAsync(ct);
        var error = TryGetProblemDetail(body) ?? $"{(int)response.StatusCode}";
        return (false, error);
    }

    /// <summary>Lista unidades de um tenant (endpoint owner: api/owner/tenants/{tenantId}/units).</summary>
    public async Task<UnitsPagedResponse?> ListTenantUnitsAsync(string tenantId, CancellationToken ct)
    {
        var id = tenantId?.Trim().ToLowerInvariant() ?? "";
        if (string.IsNullOrEmpty(id)) return null;
        using var response = await _http.GetAsync($"api/owner/tenants/{Uri.EscapeDataString(id)}/units", ct);
        if (!response.IsSuccessStatusCode)
            return null;
        return await response.Content.ReadFromJsonAsync<UnitsPagedResponse>(JsonOptions, ct);
    }

    /// <summary>Obtém o status de migrações de todos os tenants.</summary>
    public async Task<IReadOnlyList<TenantMigrationStatusDto>?> GetMigrationStatusAsync(CancellationToken ct)
    {
        using var response = await _http.GetAsync("api/owner/tenants/migrations/status", ct);
        if (!response.IsSuccessStatusCode)
            return null;
        return await response.Content.ReadFromJsonAsync<IReadOnlyList<TenantMigrationStatusDto>>(JsonOptions, ct);
    }

    /// <summary>Executa o seed do tenant (admin user, roles, áreas, etc.). Idempotente.</summary>
    public async Task<(bool Success, string? Error)> SeedTenantAsync(string tenantId, CancellationToken ct)
    {
        var id = tenantId?.Trim().ToLowerInvariant() ?? "";
        using var response = await _http.PostAsync($"api/owner/tenants/{Uri.EscapeDataString(id)}/seed", null, ct);
        if (response.IsSuccessStatusCode)
            return (true, null);
        var body = await response.Content.ReadAsStringAsync(ct);
        var error = TryGetProblemDetail(body) ?? $"{(int)response.StatusCode}";
        return (false, error);
    }

    /// <summary>Aplica migrações pendentes no tenant.</summary>
    public async Task<(bool Success, int AppliedCount, string? Error)> ApplyMigrationsAsync(string tenantId, CancellationToken ct)
    {
        var id = tenantId?.Trim().ToLowerInvariant() ?? "";
        using var response = await _http.PostAsync($"api/owner/tenants/{Uri.EscapeDataString(id)}/migrations/apply", null, ct);
        if (response.IsSuccessStatusCode)
        {
            var result = await response.Content.ReadFromJsonAsync<TenantMigrationsApplyResultDto>(JsonOptions, ct);
            return (true, result?.AppliedCount ?? 0, null);
        }
        var body = await response.Content.ReadAsStringAsync(ct);
        var error = TryGetProblemDetail(body) ?? $"{(int)response.StatusCode}";
        return (false, 0, error);
    }

    private static string? TryGetProblemDetail(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("detail", out var detail))
                return detail.GetString();
            if (doc.RootElement.TryGetProperty("title", out var title))
                return title.GetString();
        }
        catch { }
        return null;
    }
}
