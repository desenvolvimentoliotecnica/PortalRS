using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.TenantConfiguracao;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Configurações de gestão de headcount (dias de provisão na substituição, alerta de vaga sem preenchimento).
/// Acesso restrito a Admin.
/// </summary>
[ApiController]
[Route("api/admin/configuracoes-headcount")]
public sealed class ConfiguracaoHeadcountController : ControllerBase
{
    private readonly ITenantConfiguracaoService _service;
    private readonly ICurrentUserContext _userContext;

    public ConfiguracaoHeadcountController(
        ITenantConfiguracaoService service,
        ICurrentUserContext userContext)
    {
        _service = service;
        _userContext = userContext;
    }

    /// <summary>Retorna as configurações atuais de headcount do tenant.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ConfiguracaoHeadcountDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var dto = await _service.GetHeadcountConfigAsync(ct);
        return Ok(dto);
    }

    /// <summary>Atualiza as configurações de headcount do tenant (somente Admin).</summary>
    [HttpPut]
    [ProducesResponseType(typeof(ConfiguracaoHeadcountDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Upsert([FromBody] ConfiguracaoHeadcountRequest request, CancellationToken ct)
    {
        if (!_userContext.IsAdmin)
            return Forbid();

        if (request.DiasProvisaoSubstituicao < 1 || request.DiasAlertaVagaSemFill < 1)
            return BadRequest(new { message = "Os dias devem ser maiores que zero." });

        var dto = await _service.UpsertHeadcountConfigAsync(request, ct);
        return Ok(dto);
    }
}
