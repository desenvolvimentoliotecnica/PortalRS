namespace LioTecnica.Web.ViewModels.Seed;

public sealed class GestorSeed
{
    public string Id { get; init; } = "";
    public string Nome { get; init; } = "";
    public string Cargo { get; init; } = "";
    public string Area { get; init; } = "";
    public string Email { get; init; } = "";
    public string Telefone { get; init; } = "";
    public string Unidade { get; init; } = "";
    public int Headcount { get; init; }
    public string Status { get; init; } = "";
    public string Observacao { get; init; } = "";
    public string CreatedAt { get; init; } = "";
    public string UpdatedAt { get; init; } = "";
}
