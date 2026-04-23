using RhPortal.Api.Contracts.Modules;
using RhPortal.Api.Infrastructure.Modules;
using RhPortal.Api.Infrastructure.Navegacao;

namespace RhPortal.Api.Application.Navegacao;

/// <summary>
/// Deriva a lista de telas (<see cref="NavegacaoManifest.NavManifestItem"/>) que cada módulo
/// do <see cref="ModuleCatalog"/> entrega. Fonte única de verdade: o mesmo manifesto
/// que alimenta a sidebar. Garante que a visão do Owner ("o que cada módulo libera")
/// fica sempre alinhada com a visão do admin ("o que eu vejo no menu").
///
/// Regras de associação:
///   - item com <c>ModuloKeyOverride</c> preenchido → pertence explicitamente àquele módulo;
///   - senão, é usado <see cref="ModuleCatalog.ResolveModuleKey"/> sobre a
///     <c>PermissionKey</c> do item.
///
/// O bucket de UI (grupo do sidebar) é resolvido pelo mesmo método usado em runtime
/// (<see cref="NavegacaoManifest.ResolveGrupoUi"/>), para refletir exatamente onde a tela
/// aparece na navegação do usuário.
/// </summary>
public static class ModuleScreensResolver
{
    /// <summary>
    /// Mapa pré-computado (ordem do manifesto preservada) de moduleKey → telas.
    /// Recalcular é barato (manifesto estático), mas cachear simplifica quem consome.
    /// </summary>
    private static readonly IReadOnlyDictionary<string, IReadOnlyList<ModuleScreenResponse>> _byModuleKey
        = BuildIndex();

    /// <summary>
    /// Retorna as telas associadas ao módulo informado, já ordenadas.
    /// Se o módulo não existe ou não tem telas no manifesto, retorna lista vazia.
    /// </summary>
    public static IReadOnlyList<ModuleScreenResponse> GetScreensForModule(string moduleKey)
    {
        if (string.IsNullOrWhiteSpace(moduleKey)) return Array.Empty<ModuleScreenResponse>();
        return _byModuleKey.TryGetValue(moduleKey, out var list)
            ? list
            : Array.Empty<ModuleScreenResponse>();
    }

    /// <summary>
    /// Retorna o mapa completo módulo → telas. Útil para listagens em massa (ex.: endpoint detailed).
    /// </summary>
    public static IReadOnlyDictionary<string, IReadOnlyList<ModuleScreenResponse>> GetAll() => _byModuleKey;

    private static IReadOnlyDictionary<string, IReadOnlyList<ModuleScreenResponse>> BuildIndex()
    {
        var acc = new Dictionary<string, List<ModuleScreenResponse>>(StringComparer.OrdinalIgnoreCase);

        foreach (var item in NavegacaoManifest.Items)
        {
            var moduloKey = item.ModuloKeyOverride
                ?? ModuleCatalog.ResolveModuleKey(item.PermissionKey);
            if (string.IsNullOrWhiteSpace(moduloKey)) continue;

            var modulo = ModuleCatalog.GetByKey(moduloKey);
            var grupoUiKey = NavegacaoManifest.ResolveGrupoUi(item, modulo);
            var grupoUi = NavegacaoManifest.GetGrupo(grupoUiKey);

            var screen = new ModuleScreenResponse(
                Id: item.Id,
                Label: item.Label,
                Href: item.Href,
                Icon: item.Icon,
                PermissionKey: item.PermissionKey,
                Ordem: item.Ordem,
                GrupoUiKey: grupoUiKey,
                GrupoUiLabel: grupoUi?.Label ?? grupoUiKey);

            if (!acc.TryGetValue(moduloKey, out var list))
            {
                list = new List<ModuleScreenResponse>();
                acc[moduloKey] = list;
            }
            list.Add(screen);
        }

        return acc.ToDictionary(
            kv => kv.Key,
            kv => (IReadOnlyList<ModuleScreenResponse>)kv.Value
                .OrderBy(s => s.Ordem)
                .ThenBy(s => s.Label, StringComparer.CurrentCultureIgnoreCase)
                .ToList(),
            StringComparer.OrdinalIgnoreCase);
    }
}
