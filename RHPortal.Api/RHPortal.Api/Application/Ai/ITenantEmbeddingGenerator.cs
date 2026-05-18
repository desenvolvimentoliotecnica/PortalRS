namespace RhPortal.Api.Application.Ai;

/// <summary>
/// Gera vetores de embedding conforme <c>TenantConfiguracao.EmbeddingProvider</c>
/// (Gemini na nuvem, Ollama local, etc.).
/// </summary>
public interface ITenantEmbeddingGenerator
{
    Task<TenantEmbeddingResult?> GenerateAsync(string text, CancellationToken ct = default);
}

public sealed record TenantEmbeddingResult(
    float[] Vector,
    string ModelVersion,
    string Provider);
