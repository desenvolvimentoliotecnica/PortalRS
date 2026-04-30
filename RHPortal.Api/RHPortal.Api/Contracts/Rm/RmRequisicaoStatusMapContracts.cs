using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.Rm;

public sealed record RmRequisicaoStatusMapResponse(
    Guid Id,
    int CodStatusRm,
    string PortalStatusKey,
    int? Priority);

public sealed class RmRequisicaoStatusMapCreateRequest
{
    [Range(0, int.MaxValue)]
    public int CodStatusRm { get; set; }

    [Required, MaxLength(80)]
    public string PortalStatusKey { get; set; } = "";

    public int? Priority { get; set; }
}

public sealed class RmRequisicaoStatusMapUpdateRequest
{
    [Required, MaxLength(80)]
    public string PortalStatusKey { get; set; } = "";

    public int? Priority { get; set; }
}
