using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.TenantBranding;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Branding / white-label do tenant autenticado. Admin lê e edita o próprio branding
/// (nome do portal, subtítulo, cores, logo, footer, versão exibida).
/// Para consumo pré-login (tela de login), use o PublicBrandingController.
/// </summary>
[ApiController]
[Route("api/tenant-branding")]
public sealed class TenantBrandingController : ControllerBase
{
    private readonly ITenantBrandingService _service;
    private readonly ICurrentUserContext _userContext;

    public TenantBrandingController(ITenantBrandingService service, ICurrentUserContext userContext)
    {
        _service = service;
        _userContext = userContext;
    }

    /// <summary>Retorna o branding do tenant corrente (campos null = usar default).</summary>
    [HttpGet]
    [ProducesResponseType(typeof(TenantBrandingDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var dto = await _service.GetAsync(ct);
        return Ok(dto);
    }

    /// <summary>Cria ou atualiza o branding (Admin). Campos vazios voltam a usar default.</summary>
    [HttpPut]
    [ProducesResponseType(typeof(TenantBrandingDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Upsert([FromBody] TenantBrandingUpsertRequest request, CancellationToken ct)
    {
        if (!_userContext.IsAdmin)
            return Forbid();

        var dto = await _service.UpsertAsync(request, ct);
        return Ok(dto);
    }

    /// <summary>Remove o branding — tenant volta aos defaults da plataforma (Admin). Idempotente.</summary>
    [HttpDelete]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Reset(CancellationToken ct)
    {
        if (!_userContext.IsAdmin)
            return Forbid();

        await _service.ResetAsync(ct);
        return NoContent();
    }
}
