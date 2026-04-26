using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Owner;
using RhPortal.Api.Infrastructure.Modules;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Endpoint público (autenticado por X-Api-Key OU JWT) que expõe o status
/// efetivo de um módulo para o tenant atual. Consumido por workers headless
/// (ex.: <c>Liotecnica.Integration.RM</c>) para gating comercial — antes de
/// rodar um ciclo de sync, o worker consulta este endpoint para confirmar
/// que o módulo dele continua habilitado para o tenant.
///
/// O controller já é coberto pelo FallbackPolicy do <c>Program.cs</c>, que
/// aceita JwtBearer + ApiKey scheme — não há necessidade de declarar
/// AuthenticationSchemes explicitamente.
/// </summary>
[ApiController]
[Route("api/tenant-modules")]
public sealed class TenantModulesController : ControllerBase
{
    private readonly TenantModuleService _moduleService;
    private readonly ITenantContext _tenantContext;

    public TenantModulesController(TenantModuleService moduleService, ITenantContext tenantContext)
    {
        _moduleService = moduleService;
        _tenantContext = tenantContext;
    }

    /// <summary>
    /// Retorna o status efetivo (habilitado/desabilitado) do módulo para o tenant
    /// presente em <c>X-Tenant-Id</c>. Considera regras do <c>TenantModuleService</c>
    /// (módulos core sempre on; módulos com PackageKey só on se pacote-pai ativo).
    /// </summary>
    [HttpGet("{moduleKey}/status")]
    [ProducesResponseType(typeof(TenantModuleStatusResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TenantModuleStatusResponse>> GetStatus(string moduleKey, CancellationToken ct)
    {
        if (!ModuleCatalog.Exists(moduleKey))
            return NotFound(new ProblemDetails { Title = "Module not found", Detail = $"Módulo '{moduleKey}' não existe no catálogo." });

        var enabled = await _moduleService.GetEnabledModuleKeysAsync(_tenantContext.TenantId, ct);
        return Ok(new TenantModuleStatusResponse(moduleKey, enabled.Contains(moduleKey)));
    }
}

public sealed record TenantModuleStatusResponse(string Key, bool IsEnabled);
