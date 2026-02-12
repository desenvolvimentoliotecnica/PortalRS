namespace RhPortal.Api.Infrastructure.Configuration;

/// <summary>
/// Configuração do serviço RHPortal.Ai (matching por filtros).
/// </summary>
public sealed class RhAiOptions
{
    public const string SectionName = "RhAi";

    /// <summary>URL base do RHPortal.Ai (ex.: http://localhost:8000).</summary>
    public string? BaseUrl { get; set; }
}
