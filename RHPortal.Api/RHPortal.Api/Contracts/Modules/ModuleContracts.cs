namespace RhPortal.Api.Contracts.Modules;

public sealed record TenantModuleResponse(
    string Key,
    string Name,
    string Description,
    bool IsCore,
    bool IsEnabled,
    DateTimeOffset? UpdatedAtUtc,
    Guid? UpdatedByOwnerId,
    string? PackageKey = null);

public sealed record TenantModuleUpdateRequest(bool IsEnabled);

public sealed record TenantPackageResponse(
    string Key,
    string Name,
    string Description,
    bool IsActive,
    bool IsEnabled,
    DateTimeOffset? UpdatedAtUtc,
    Guid? UpdatedByOwnerId);

public sealed record TenantPackageUpdateRequest(bool IsEnabled);

/// <summary>
/// Tela/funcionalidade individual entregue por um módulo. Derivada do
/// <c>NavegacaoManifest</c>, com resolução do bucket de UI já aplicada.
/// </summary>
public sealed record ModuleScreenResponse(
    string Id,
    string Label,
    string Href,
    string Icon,
    string PermissionKey,
    int Ordem,
    string GrupoUiKey,
    string GrupoUiLabel);

/// <summary>
/// Resposta detalhada de um módulo do tenant — inclui a lista de telas
/// que o módulo entrega, derivadas do manifesto de navegação. Usado pela
/// tela do Owner "Configuração de Módulos" para mostrar o que cada pacote
/// libera na prática.
/// </summary>
public sealed record TenantModuleDetailedResponse(
    string Key,
    string Name,
    string Description,
    bool IsCore,
    bool IsEnabled,
    DateTimeOffset? UpdatedAtUtc,
    Guid? UpdatedByOwnerId,
    string? PackageKey,
    IReadOnlyList<ModuleScreenResponse> Telas);
