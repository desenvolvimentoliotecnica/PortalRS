using System;
using System.Collections.Generic;
using System.Linq;

namespace RhPortal.Api.Application.Ai.Agent;

/// <summary>
/// Registry central de todas as <see cref="IAgentTool"/> disponíveis para o agente.
/// Registrado como Scoped — resolve as tools do DI container da request atual
/// (garantindo que cada tool tenha seu <c>AppDbContext</c> + <c>ITenantContext</c>).
/// </summary>
public interface IAgentToolRegistry
{
    /// <summary>Retorna todas as tools registradas.</summary>
    IReadOnlyList<IAgentTool> All { get; }

    /// <summary>Busca tool pelo nome (case-sensitive). Null se não existe.</summary>
    IAgentTool? FindByName(string name);
}

public sealed class AgentToolRegistry : IAgentToolRegistry
{
    private readonly Dictionary<string, IAgentTool> _byName;

    public AgentToolRegistry(IEnumerable<IAgentTool> tools)
    {
        _byName = tools.ToDictionary(t => t.Name, t => t, StringComparer.Ordinal);
    }

    public IReadOnlyList<IAgentTool> All => _byName.Values.OrderBy(t => t.Name).ToList();

    public IAgentTool? FindByName(string name) =>
        string.IsNullOrEmpty(name) ? null : _byName.GetValueOrDefault(name);
}
