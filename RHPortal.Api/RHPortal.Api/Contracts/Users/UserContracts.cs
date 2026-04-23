using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.Users;

public sealed record RoleInfoResponse(
    Guid Id,
    string Name
);

public sealed record UnitInfoResponse(Guid Id, string Code, string Name);

public sealed record FuncionarioInfoResponse(Guid Id, string Name, string Email, Guid? CentroCustoId);

public sealed record UserListItemResponse(
    Guid Id,
    string FullName,
    string Email,
    bool IsActive,
    IReadOnlyList<string> Roles,
    IReadOnlyList<UnitInfoResponse> Units,
    FuncionarioInfoResponse? Funcionario
);

public sealed record UserResponse(
    Guid Id,
    string FullName,
    string Email,
    bool IsActive,
    IReadOnlyList<RoleInfoResponse> Roles,
    IReadOnlyList<UnitInfoResponse> Units,
    FuncionarioInfoResponse? Funcionario,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);

public sealed record UserCreateRequest(
    [Required, EmailAddress, MaxLength(180)] string Email,
    [Required, MaxLength(200)] string FullName,
    [Required, MinLength(8), MaxLength(120)] string Password,
    bool IsActive,
    IReadOnlyList<Guid> RoleIds,
    IReadOnlyList<Guid>? UnitIds,
    Guid? FuncionarioId
);

public sealed record UserUpdateRequest(
    [Required, EmailAddress, MaxLength(180)] string Email,
    [Required, MaxLength(200)] string FullName,
    bool IsActive,
    IReadOnlyList<Guid>? UnitIds,
    Guid? FuncionarioId
);

public sealed record UserStatusUpdateRequest(
    [Required] bool IsActive
);

public sealed record UserRolesUpdateRequest(
    [Required] IReadOnlyList<Guid> RoleIds
);

/// <summary>Alteração de senha por administrador (reset).</summary>
public sealed record UserPasswordUpdateRequest(
    [Required, MinLength(8), MaxLength(120)] string NewPassword
);
