using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.RequisitoCategorias;

public sealed record RequisitoCategoriaCreateRequest(
    [Required, MaxLength(40)] string Code,
    [Required, MaxLength(120)] string Name,
    [MaxLength(1000)] string? Description,
    bool IsActive
);

public sealed record RequisitoCategoriaUpdateRequest(
    [Required, MaxLength(40)] string Code,
    [Required, MaxLength(120)] string Name,
    [MaxLength(1000)] string? Description,
    bool IsActive
);

public sealed record RequisitoCategoriaResponse(Guid Id, string Code, string Name, string? Description, bool IsActive);
