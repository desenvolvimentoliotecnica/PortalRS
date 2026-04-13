using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Contracts.AprovadoresAlternativos;

public sealed record AprovadorAlternativoResponse(
    Guid Id,
    Guid GestorId,
    string GestorNome,
    Guid AprovadorId,
    string AprovadorNome,
    DateOnly DataInicio,
    DateOnly? DataFim,
    bool Ativo,
    DateTimeOffset CreatedAtUtc
);

public sealed class AprovadorAlternativoSaveRequest
{
    [Required]
    public Guid GestorId { get; set; }

    [Required]
    public Guid AprovadorId { get; set; }

    [Required]
    public DateOnly DataInicio { get; set; }

    public DateOnly? DataFim { get; set; }
}

public sealed record AprovadorAlternativoListQuery(
    string? Q,
    bool? ApenasAtivos,
    int? Page,
    int? PageSize
);
