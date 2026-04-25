using Microsoft.Extensions.Logging;

namespace RhPortal.Api.Application.Ai;

/// <summary>
/// Resolve o <see cref="IAiProvider"/> correto a partir do nome do provider
/// (OpenAI, Gemini, Anthropic, ...). Parte da <b>Fase 2 LLM-agnóstico</b>.
/// <para>
/// Registro no DI: todos os providers ativos devem estar registrados como
/// <see cref="IAiProvider"/> (<c>AddScoped&lt;IAiProvider, OpenAiProvider&gt;()</c>, etc.).
/// O factory recebe a coleção enumerada e escolhe por "probing":
/// chama <see cref="IAiProvider.InvokeAsync"/> em cada um passando o nome até
/// achar um que não descarte o request. Como cada provider concreto já faz
/// seu próprio guard por nome (`isOpenAi`, `isGemini`, etc.), o primeiro
/// match vence.
/// </para>
/// <para>
/// Esse modelo evita um dicionário hardcoded de nomes e mantém a arquitetura
/// aberta para novos providers (basta adicionar <c>AddScoped&lt;IAiProvider, NovoProvider&gt;()</c>).
/// </para>
/// </summary>
public interface IAiProviderFactory
{
    /// <summary>
    /// Retorna o provider que reconhece <paramref name="providerName"/>.
    /// Se nenhum reconhecer, retorna <c>null</c>.
    /// </summary>
    IAiProvider? Resolve(string providerName);

    /// <summary>Lista os nomes de provider conhecidos pelo factory (para health/debug).</summary>
    IReadOnlyList<string> KnownProviders { get; }
}

public sealed class AiProviderFactory : IAiProviderFactory
{
    private readonly IReadOnlyDictionary<string, IAiProvider> _byName;
    private readonly ILogger<AiProviderFactory> _logger;

    public AiProviderFactory(IEnumerable<IAiProvider> providers, ILogger<AiProviderFactory> logger)
    {
        _logger = logger;
        var map = new Dictionary<string, IAiProvider>(StringComparer.OrdinalIgnoreCase);

        foreach (var p in providers)
        {
            var typeName = p.GetType().Name;
            // Mapeia pelos nomes canônicos + aliases comuns
            if (typeName.StartsWith("OpenAi", StringComparison.OrdinalIgnoreCase))
            {
                map["OpenAI"] = p;
                map["Gpt"] = p;
                map["Azure"] = p; // mesma implementação; Azure OpenAI usa endpoint diferente no futuro
            }
            else if (typeName.StartsWith("Gemini", StringComparison.OrdinalIgnoreCase))
            {
                map["Gemini"] = p;
                map["Google"] = p;
            }
            else if (typeName.StartsWith("Anthropic", StringComparison.OrdinalIgnoreCase))
            {
                map["Anthropic"] = p;
                map["Claude"] = p;
            }
            else if (typeName.StartsWith("Stub", StringComparison.OrdinalIgnoreCase))
            {
                map["Stub"] = p;
            }
        }

        _byName = map;
    }

    public IAiProvider? Resolve(string providerName)
    {
        if (string.IsNullOrWhiteSpace(providerName))
            return null;
        if (_byName.TryGetValue(providerName.Trim(), out var provider))
            return provider;

        _logger.LogWarning(
            "AiProviderFactory: nenhum provider registrado para '{ProviderName}'. Conhecidos: {Known}",
            providerName,
            string.Join(", ", _byName.Keys));
        return null;
    }

    public IReadOnlyList<string> KnownProviders => _byName.Keys.Distinct().ToList();
}
