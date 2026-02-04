using RhPortal.Api.Contracts.Talentos;

namespace RhPortal.Api.Application.Talentos;

/// <summary>Extrai dados estruturados do texto de currículo usando IA (AiModel).</summary>
public interface ICvGptExtractor
{
    /// <summary>Envia o texto do currículo ao modelo de IA e retorna dados sugeridos (pessoa + competências + experiências + treinamentos + formação), ou null se falhar.</summary>
    Task<TalentoImportPdfSuggestedData?> ExtractSuggestedDataAsync(string cvText, CancellationToken ct);
}
