using Microsoft.Extensions.Configuration;
using RhPortal.Api.Application.Owner;
using RhPortal.Api.Contracts.Navegacao;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Modules;
using RhPortal.Api.Infrastructure.Navegacao;

namespace RhPortal.Api.Application.Navegacao;

/// <summary>
/// Constrói a árvore de navegação da sidebar para o usuário atual.
/// Substitui a lógica do <c>permissionManifest.ts</c> + <c>LOCKED_NAV_HREFS</c> + <c>HIDDEN_ROUTES</c>
/// do frontend. O backend passa a ser única fonte da verdade sobre:
///   - quais itens o usuário vê (filtro por permissão);
///   - quais itens estão bloqueados visualmente (cadeado) e por qual motivo (gating por módulo/pacote);
///   - em qual bucket (grupo UI) cada item entra.
///
/// Regras de gating:
///   - Usuário sem permissão → item NÃO é emitido.
///   - Usuário com permissão, mas módulo/pacote não habilitado → item emitido com
///     <see cref="NavItemResponse.Acessivel"/>=false e <c>MotivoBloqueio</c> preenchido.
///   - Owner (permissões = ["*"]) enxerga tudo como acessível em tenant real;
///     em contexto Owner-puro (owner db), o consumidor pode ignorar e injetar itens próprios.
/// </summary>
public sealed class NavegacaoSidebarService
{
    private readonly TenantModuleService _tenantModuleService;
    private readonly TenantScreenService _screenService;
    private readonly IConfiguration _configuration;

    public NavegacaoSidebarService(
        TenantModuleService tenantModuleService,
        TenantScreenService screenService,
        IConfiguration configuration)
    {
        _tenantModuleService = tenantModuleService;
        _screenService = screenService;
        _configuration = configuration;
    }

    /// <summary>
    /// Retorna a sidebar para um usuário comum em contexto de tenant.
    /// </summary>
    public async Task<NavegacaoSidebarResponse> BuildAsync(
        string tenantId,
        IReadOnlyCollection<string> permissions,
        CancellationToken ct)
    {
        var enabledModuleKeys = await _tenantModuleService.GetEnabledModuleKeysAsync(tenantId, ct);
        var screenEstados = await _screenService.GetEstadoMapAsync(tenantId, ct);
        return Build(
            permissions,
            enabledModuleKeys,
            contextoEspecial: null,
            screenEstados,
            portalVagasPublicUrl: ResolvePortalVagasPublicUrl());
    }

    /// <summary>
    /// Retorna a sidebar para um Owner em contexto de tenant real (enxerga tudo).
    /// </summary>
    public async Task<NavegacaoSidebarResponse> BuildForOwnerInTenantAsync(
        string tenantId,
        CancellationToken ct)
    {
        var enabledModuleKeys = await _tenantModuleService.GetEnabledModuleKeysAsync(tenantId, ct);
        var screenEstados = await _screenService.GetEstadoMapAsync(tenantId, ct);
        return Build(
            new[] { "*" },
            enabledModuleKeys,
            contextoEspecial: "owner-em-tenant",
            screenEstados,
            portalVagasPublicUrl: ResolvePortalVagasPublicUrl());
    }

    /// <summary>
    /// URL pública do SPA do portal de candidaturas (ex.: mesma rede, outra porta que o admin).
    /// Vazio = mantém href relativo do manifesto (<c>/portalvagas</c>).
    /// </summary>
    private string? ResolvePortalVagasPublicUrl()
    {
        var raw = _configuration["Navegacao:PortalVagasPublicUrl"];
        if (!string.IsNullOrWhiteSpace(raw))
            return raw.Trim();
        return Environment.GetEnvironmentVariable("PORTAL_VAGAS_PUBLIC_URL")?.Trim();
    }

    /// <summary>
    /// Versão síncrona/pura — usada em testes e quando já temos os conjuntos prontos.
    /// </summary>
    public static NavegacaoSidebarResponse Build(
        IReadOnlyCollection<string> permissions,
        ISet<string> enabledModuleKeys,
        string? contextoEspecial,
        IReadOnlyDictionary<string, string>? screenEstados = null,
        string? portalVagasPublicUrl = null)
    {
        var hasWildcard = permissions.Contains("*");
        var isOwnerContext = contextoEspecial is not null;
        var permSet = new HashSet<string>(permissions, StringComparer.OrdinalIgnoreCase);

        // Baldes iniciados a partir do catálogo (preservam ordem)
        var grupos = NavegacaoManifest.Grupos
            .ToDictionary(g => g.Key, _ => new List<NavItemResponse>(), StringComparer.OrdinalIgnoreCase);

        foreach (var item in NavegacaoManifest.Items)
        {
            // 1) Permissão + filtro de contexto owner
            if (isOwnerContext && item.OcultarDoOwner) continue;
            var temPermissao = hasWildcard || permSet.Contains(item.PermissionKey);
            if (!temPermissao) continue; // não emite sem permissão (matches UX atual)

            // 2) Módulo associado (explícito ou resolvido)
            var moduloKey = item.ModuloKeyOverride
                ?? ModuleCatalog.ResolveModuleKey(item.PermissionKey);
            var modulo = moduloKey is not null ? ModuleCatalog.GetByKey(moduloKey) : null;

            // 3) Gate de módulo/pacote
            string? motivo = null;
            var acessivel = true;
            if (modulo is not null && !modulo.IsCore)
            {
                if (!string.IsNullOrWhiteSpace(modulo.PackageKey))
                {
                    var package = PackageCatalog.GetByKey(modulo.PackageKey!);
                    if (package is null || !package.IsActive)
                    {
                        // Pacote não disponível no catálogo (ex.: Folha de Pagamento em construção).
                        // Enquanto o produto não existir, o item não deve aparecer NEM bloqueado —
                        // simplesmente não existe para o usuário. Volta a aparecer (com gate normal)
                        // quando o pacote for ativado.
                        continue;
                    }
                    else if (!enabledModuleKeys.Contains(modulo.Key))
                    {
                        acessivel = false;
                        motivo = MotivoBloqueioNav.PacoteNaoContratado;
                    }
                }
                else if (!enabledModuleKeys.Contains(modulo.Key))
                {
                    // Módulo desativado pelo Owner → item some do sidebar (não aparece nem bloqueado).
                    continue;
                }
            }

            // 4) Gate por tela (override individual do Owner)
            if (screenEstados is not null && screenEstados.TryGetValue(item.Id, out var estadoTela))
            {
                if (estadoTela == EstadoTela.Oculto) continue;
                if (estadoTela == EstadoTela.Bloqueado && acessivel)
                {
                    acessivel = false;
                    motivo = MotivoBloqueioNav.TelaBloqueada;
                }
            }

            // 5) Resolver bucket de UI
            var grupoKey = NavegacaoManifest.ResolveGrupoUi(item, modulo);
            if (!grupos.ContainsKey(grupoKey))
            {
                // fallback: cria bucket ad-hoc se manifesto estiver desalinhado
                grupos[grupoKey] = new List<NavItemResponse>();
            }

            var href = ResolveItemHref(item, portalVagasPublicUrl);
            grupos[grupoKey].Add(new NavItemResponse(
                Id: item.Id,
                Label: item.Label,
                Href: href,
                Icon: item.Icon,
                Ordem: item.Ordem,
                ModuloKey: modulo?.Key,
                PackageKey: modulo?.PackageKey,
                Acessivel: acessivel,
                MotivoBloqueio: motivo,
                OpenInNewTab: item.OpenInNewTab));
        }

        // Ordenar itens dentro de cada bucket
        var respostaGrupos = NavegacaoManifest.Grupos
            .Select(g => new NavGrupoResponse(
                Key: g.Key,
                Label: g.Label,
                Ordem: g.Ordem,
                OcultarHeader: g.OcultarHeader,
                Itens: grupos.TryGetValue(g.Key, out var list)
                    ? list.OrderBy(i => i.Ordem).ThenBy(i => i.Label, StringComparer.CurrentCultureIgnoreCase).ToList()
                    : new List<NavItemResponse>()))
            .Where(g => g.Itens.Count > 0) // não emite bucket vazio
            .OrderBy(g => g.Ordem)
            .ToList();

        return new NavegacaoSidebarResponse(respostaGrupos, contextoEspecial);
    }

    private static string ResolveItemHref(NavegacaoManifest.NavManifestItem item, string? portalVagasPublicUrl)
    {
        if (!string.Equals(item.Id, "nav-portalvagas", StringComparison.OrdinalIgnoreCase))
            return item.Href;

        var u = portalVagasPublicUrl?.Trim();
        if (string.IsNullOrEmpty(u))
            return item.Href;

        return u.TrimEnd('/') + "/";
    }
}
