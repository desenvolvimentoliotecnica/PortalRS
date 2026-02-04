using RhPortal.Api.Contracts.ApiKeys;

namespace RhPortal.Api.Application.ApiKeys;

public interface IApiKeyService
{
    Task<IReadOnlyList<ApiKeyResponse>> ListAsync(CancellationToken ct);
    Task<ApiKeyResponse?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<ApiKeyCreateResponse> CreateAsync(ApiKeyCreateRequest request, CancellationToken ct);
    Task<bool> RevokeAsync(Guid id, CancellationToken ct);
}
