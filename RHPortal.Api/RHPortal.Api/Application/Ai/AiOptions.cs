namespace RhPortal.Api.Application.Ai;

/// <summary>
/// Configuração de provedores de IA — OpenAI (legado), Ollama (local, default), embeddings.
/// </summary>
public sealed class AiOptions
{
    public const string SectionName = "Ai";

    public OpenAIOptions OpenAI { get; set; } = new();
    public OllamaOptions Ollama { get; set; } = new();
}

public sealed class OpenAIOptions
{
    public string ApiKey { get; set; } = "";
    public string DefaultModel { get; set; } = "gpt-4o-mini";
}

/// <summary>
/// Configuração do cliente Ollama local. Endpoint default é localhost:11434 (padrão
/// Ollama). Modelos recomendados:
///   - ChatModel       : qwen2.5:7b (multilingual pt-br, Apache 2.0, function calling)
///   - EmbeddingModel  : bge-m3     (1024 dims, multilingual, estado-da-arte open-source)
/// </summary>
public sealed class OllamaOptions
{
    /// <summary>Endpoint base do Ollama HTTP API.</summary>
    public string Endpoint { get; set; } = "http://localhost:11434";

    /// <summary>Modelo usado para chat/completion/rerank.</summary>
    public string ChatModel { get; set; } = "qwen2.5:7b";

    /// <summary>Modelo usado para gerar embeddings de textos.</summary>
    public string EmbeddingModel { get; set; } = "bge-m3";

    /// <summary>Dimensão do vetor gerado pelo EmbeddingModel. bge-m3 = 1024.</summary>
    public int EmbeddingDimensions { get; set; } = 1024;

    /// <summary>
    /// Timeout (segundos) para chamadas HTTP ao Ollama. Chat pode ser longo — Qwen 7B
    /// na CPU do Mac M1/M2 leva 60-180s quando o modelo precisa ser recarregado do disco
    /// (cold start). Default 300s (5min) é folgado; GPU roda em 5-10s.
    /// </summary>
    public int TimeoutSeconds { get; set; } = 300;

    /// <summary>
    /// Tempo que o Ollama mantém o modelo carregado na memória após a última chamada.
    /// Default "30m" = 30 minutos. Cold start custa ~30-60s no CPU, então manter
    /// quente evita reaquecimento entre chamadas consecutivas. Formato Ollama: "10m", "1h", etc.
    /// </summary>
    public string KeepAlive { get; set; } = "30m";

    /// <summary>Se false, todos os endpoints de IA ficam em fallback léxico sem tentar Ollama.</summary>
    public bool Enabled { get; set; } = true;
}
