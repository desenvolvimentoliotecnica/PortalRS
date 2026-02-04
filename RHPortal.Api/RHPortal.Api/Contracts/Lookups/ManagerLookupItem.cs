using RhPortal.Api.Domain.Enums;

namespace LioTecnica.Api.Contracts.Lookups;

public sealed class LookupResponse<T>
{
    public required IReadOnlyList<T> Items { get; init; }
    public required int Total { get; init; }
    public required bool HasMore { get; init; }
}

public sealed class ManagerLookupItem
{
    public Guid Id { get; init; }
    public string Nome { get; init; } = "";
    public string? Email { get; init; }
    public string? Cargo { get; init; }
    public string? Area { get; init; }
    public string? Unidade { get; init; }

    public ManagerStatus Status { get; init; } = ManagerStatus.Active;

    public string? Telefone { get; init; }
    public int Headcount { get; init; }
    public string? Observacao { get; init; }

    public DateTimeOffset? CreatedAt { get; init; }
    public DateTimeOffset? UpdatedAt { get; init; }
}
