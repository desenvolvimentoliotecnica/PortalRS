namespace LioTecnica.Web.ViewModels.Seed;

public sealed class CandidatoSeed
{
    public string Id { get; init; } = "";
    public string Nome { get; init; } = "";
    public string Email { get; init; } = "";
    public string Fone { get; init; } = "";
    public string Cidade { get; init; } = "";
    public string Uf { get; init; } = "";
    public string Fonte { get; init; } = "";
    public string Status { get; init; } = "";
    public string VagaId { get; init; } = "";
    public string Obs { get; init; } = "";
    public string CvText { get; init; } = "";
    public string CreatedAt { get; init; } = "";
    public string UpdatedAt { get; init; } = "";
    public MatchSeed? LastMatch { get; init; }
}

public sealed class MatchSeed
{
    public int Score { get; init; }
    public bool Pass { get; init; }
    public string At { get; init; } = "";
    public string? VagaId { get; init; }
}
