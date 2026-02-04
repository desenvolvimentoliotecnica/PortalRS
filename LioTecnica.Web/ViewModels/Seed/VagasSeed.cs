namespace LioTecnica.Web.ViewModels.Seed;

public sealed class VagaSeed
{
    public string Id { get; init; } = "";
    public string Codigo { get; init; } = "";
    public string Titulo { get; init; } = "";
    public string Area { get; init; } = "";
    public string Modalidade { get; init; } = "";
    public string Status { get; init; } = "";
    public string Cidade { get; init; } = "";
    public string Uf { get; init; } = "";
    public string Senioridade { get; init; } = "";
    public int Threshold { get; init; }
    public string Descricao { get; init; } = "";
    public string CreatedAt { get; init; } = "";
    public string UpdatedAt { get; init; } = "";
    public PesoSeed Weights { get; init; } = new();
    public IReadOnlyList<RequisitoSeed> Requisitos { get; init; } = Array.Empty<RequisitoSeed>();
}

public sealed class PesoSeed
{
    public int Competencia { get; init; }
    public int Experiencia { get; init; }
    public int Formacao { get; init; }
    public int Localidade { get; init; }
}

public sealed class RequisitoSeed
{
    public string Id { get; init; } = "";
    public string Categoria { get; init; } = "";
    public string Termo { get; init; } = "";
    public int Peso { get; init; }
    public bool Obrigatorio { get; init; }
    public IReadOnlyList<string> Sinonimos { get; init; } = Array.Empty<string>();
    public string Obs { get; init; } = "";
}
