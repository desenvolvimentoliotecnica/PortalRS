using RhPortal.Api.Domain.Enums;

namespace LioTecnica.Api.Contracts.Lookups;

public sealed class FuncionarioLookupItem
{
    public Guid Id { get; init; }
    public string Nome { get; init; } = "";
    public string? Email { get; init; }
    public string? Cargo { get; init; }
    public string? Area { get; init; }
    public string? Unidade { get; init; }

    public FuncionarioStatus Status { get; init; } = FuncionarioStatus.Active;

    public string? Telefone { get; init; }
    public int Headcount { get; init; }
    public string? Observacao { get; init; }

    public DateTimeOffset? CreatedAt { get; init; }
    public DateTimeOffset? UpdatedAt { get; init; }
}
