namespace RhPortal.Api.Infrastructure.Modules;

/// <summary>
/// Catálogo de pacotes comerciais (entitlement de alto nível contratado pelo Owner).
/// Code-first: mudanças exigem deploy. A tabela <c>TenantPackages</c> no master
/// só guarda o estado (ativo/inativo) por tenant.
///
/// Regra de composição: um <see cref="ModuleCatalog.ModuleDefinition"/> com
/// <c>PackageKey</c> preenchido só está habilitado para um tenant se o pacote-pai
/// também estiver habilitado (ver <c>TenantModuleService.GetEnabledModuleKeysAsync</c>).
///
/// Pacotes marcados como <c>IsActive = false</c> não estão disponíveis para contratação
/// no momento (ex.: Folha de Pagamento ainda em construção) — são ignorados em
/// <c>ListAsync</c>/<c>EnsureDefaultsAsync</c> e seus módulos ficam desabilitados.
/// </summary>
public static class PackageCatalog
{
    public sealed record PackageDefinition(
        string Key,
        string Name,
        string Description,
        bool IsActive);

    public static readonly IReadOnlyList<PackageDefinition> All = new List<PackageDefinition>
    {
        new("recrutamento-selecao",
            "Recrutamento e Seleção",
            "Portal de vagas, banco de currículos, pipeline de vaga, matching IA, admissão e agenda",
            IsActive: true),

        new("gestao-pessoas",
            "Gestão de Pessoas",
            "Feedback, PDI, avaliação de desempenho (Nine Box) e dashboards de gestão",
            IsActive: true),

        new("folha-pagamento",
            "Folha de Pagamento",
            "Folha, férias, ponto eletrônico, rescisão e pagamento extra",
            IsActive: false),
    };

    private static readonly Dictionary<string, PackageDefinition> _byKey =
        All.ToDictionary(p => p.Key, StringComparer.OrdinalIgnoreCase);

    public static PackageDefinition? GetByKey(string key) =>
        _byKey.TryGetValue(key, out var p) ? p : null;

    public static bool Exists(string key) => _byKey.ContainsKey(key);
}
