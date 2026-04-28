using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.Feedback;

public sealed record OneOnOneCreateRequest(
    [Required] Guid CollaboratorId,
    [Required] DateTimeOffset MeetingDate,
    [MaxLength(200)] string? Subject = null,
    [MaxLength(4000)] string? Notes = null,
    /// <summary>
    /// Opcional. Quando informado, o serviço carrega o template e usa ele para popular
    /// Subject (com o Nome do template) e Notes (com a pauta em markdown — bullets dos
    /// <c>OneOnOneTemplateItem</c>) — só se o request não tiver enviado os próprios.
    /// Permite "começar do template" sem perder a possibilidade de o gestor sobrescrever.
    /// </summary>
    Guid? TemplateId = null);

public sealed record OneOnOneUpdateRequest(
    DateTimeOffset MeetingDate,
    [MaxLength(200)] string? Subject = null,
    [MaxLength(4000)] string? Notes = null);

public sealed record OneOnOneMeetingResponse(
    Guid Id,
    Guid ManagerId,
    string ManagerFullName,
    Guid CollaboratorId,
    string CollaboratorFullName,
    DateTimeOffset MeetingDate,
    string? Subject,
    string? Notes,
    DateTimeOffset CreatedAtUtc);

public sealed record OneOnOneListResponse(
    IReadOnlyList<OneOnOneMeetingResponse> Items,
    int TotalCount,
    int Page,
    int PageSize);
