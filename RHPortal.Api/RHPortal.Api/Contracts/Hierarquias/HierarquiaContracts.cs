namespace RhPortal.Api.Contracts.Hierarquias;

/// <summary>Item flat da hierarquia.</summary>
public sealed record HierarquiaResponse(
    Guid Id,
    int IdHierarquiaRm,
    string Descricao,
    int? IdHierarquiaSuperiorRm,
    Guid? HierarquiaSuperiorId,
    string? Estrutura,
    int? IdNivelHierarquiaRm,
    bool IsActive,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);

/// <summary>Nó da árvore de hierarquia (com children recursivos).</summary>
public sealed record HierarquiaTreeNode(
    Guid Id,
    int IdHierarquiaRm,
    string Descricao,
    string? Estrutura,
    int? IdNivelHierarquiaRm,
    bool IsActive,
    IReadOnlyList<HierarquiaTreeNode> Children);

/// <summary>Body do upsert (idempotente por IdHierarquiaRm).</summary>
public sealed class HierarquiaUpsertRequest
{
    public int IdHierarquiaRm { get; set; }
    public string Descricao { get; set; } = default!;
    public int? IdHierarquiaSuperiorRm { get; set; }
    public string? Estrutura { get; set; }
    public int? IdNivelHierarquiaRm { get; set; }
    public bool IsActive { get; set; } = true;
}

/// <summary>Body do bulk upsert — usado pelo worker pra evitar N+1.</summary>
public sealed class HierarquiaBulkUpsertRequest
{
    public List<HierarquiaUpsertRequest> Items { get; set; } = new();
}

public sealed record HierarquiaBulkUpsertResponse(int Created, int Updated, int Total);
