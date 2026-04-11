using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.TenantConfiguracao;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Configurações gerais do tenant (ex: fluxo de aprovação com etapa RH).
/// Acesso restrito a Admin.
/// </summary>
[ApiController]
[Route("api/tenant-configuracao")]
public sealed class TenantConfiguracaoController : ControllerBase
{
    private readonly ITenantConfiguracaoService _service;
    private readonly ICurrentUserContext _userContext;

    public TenantConfiguracaoController(
        ITenantConfiguracaoService service,
        ICurrentUserContext userContext)
    {
        _service = service;
        _userContext = userContext;
    }

    /// <summary>Retorna a configuração atual do tenant.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(TenantConfiguracaoDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var dto = await _service.GetAsync(ct);
        return Ok(dto);
    }

    /// <summary>Cria ou atualiza a configuração do tenant (somente Admin).</summary>
    [HttpPut]
    [ProducesResponseType(typeof(TenantConfiguracaoDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Upsert([FromBody] TenantConfiguracaoUpsertRequest request, CancellationToken ct)
    {
        if (!_userContext.IsAdmin)
            return Forbid();

        var dto = await _service.UpsertAsync(request, ct);
        return Ok(dto);
    }
}
