using Microsoft.AspNetCore.Authorization;
using RhPortal.Api.Application.Owner;
using RhPortal.Api.Infrastructure.Modules;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Infrastructure.Security;

/// <summary>
/// Bloqueia o acesso à rota quando o módulo exigido pela <see cref="RequireModuleAttribute"/>
/// não está habilitado para o tenant corrente (via <see cref="TenantModuleService"/>).
///
/// Exceções:
///   - Roles <c>Owner</c> e <c>ApiKey</c> passam sem checagem (mesmo padrão de permissões);
///   - Módulos core sempre passam;
///   - Módulos inexistentes no catálogo passam (fail-open, para não quebrar rotas legadas).
/// </summary>
public sealed class ModuleAuthorizationHandler : AuthorizationHandler<ModuleRequirement>
{
    private readonly ITenantContext _tenantContext;
    private readonly TenantModuleService _moduleService;

    public ModuleAuthorizationHandler(ITenantContext tenantContext, TenantModuleService moduleService)
    {
        _tenantContext = tenantContext;
        _moduleService = moduleService;
    }

    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, ModuleRequirement requirement)
    {
        // Super-roles passam (Owner global + ApiKey + Admin/Administrador do tenant).
        if (context.User.IsInRole("Owner") || context.User.IsInRole("ApiKey")
            || context.User.IsInRole("Admin") || context.User.IsInRole("Administrador"))
        {
            context.Succeed(requirement);
            return;
        }

        var module = ModuleCatalog.GetByKey(requirement.ModuleKey);
        if (module is null || module.IsCore)
        {
            context.Succeed(requirement);
            return;
        }

        var tenantId = _tenantContext.TenantId;
        if (string.IsNullOrWhiteSpace(tenantId))
            return;

        var enabled = await _moduleService.GetEnabledModuleKeysAsync(tenantId, CancellationToken.None);
        if (enabled.Contains(requirement.ModuleKey))
            context.Succeed(requirement);
    }
}
