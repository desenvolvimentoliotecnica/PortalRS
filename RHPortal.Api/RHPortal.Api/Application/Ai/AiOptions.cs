namespace RhPortal.Api.Application.Ai;

/// <summary>Configuração opcional de OpenAI via appsettings (usa-se quando não houver chave no banco).</summary>
public sealed class AiOptions
{
    public const string SectionName = "Ai";

    public OpenAIOptions OpenAI { get; set; } = new();
}

public sealed class OpenAIOptions
{
    /// <summary>Chave da API OpenAI (sk-...). Preencher em appsettings ou User Secrets para matching por IA.</summary>
    public string ApiKey { get; set; } = "";

    /// <summary>Modelo a usar quando a chave vier das configurações. Padrão: gpt-4o-mini.</summary>
    public string DefaultModel { get; set; } = "gpt-4o-mini";
}
