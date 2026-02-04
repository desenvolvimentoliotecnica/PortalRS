using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Application.Portal;
using RhPortal.Api.Contracts.Portal;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Autenticação pública do candidato (Portal de Vagas).
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/public/portal-auth")]
public sealed class PortalAuthController : ControllerBase
{
    private readonly IStringLocalizer<ControllerMessages> _localizer;

    public PortalAuthController(IStringLocalizer<ControllerMessages> localizer)
    {
        _localizer = localizer;
    }

    /// <summary>
    /// Login do candidato no Portal de Vagas.
    /// </summary>
    /// <remarks>
    /// Retorna os dados básicos do candidato autenticado.
    /// </remarks>
    [HttpPost("login")]
    [ProducesResponseType(typeof(PortalCandidateAuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<PortalCandidateAuthResponse>> Login(
        [FromBody] PortalCandidateLoginRequest request,
        [FromServices] IPortalCandidateAuthService service,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var response = await service.LoginAsync(request, ct);
        if (response is null)
            return Unauthorized(new { message = _localizer["ControllerErrors.PortalInvalidCredentials"] });

        return Ok(response);
    }

    /// <summary>
    /// Cria o acesso do candidato no Portal de Vagas.
    /// </summary>
    /// <remarks>
    /// Use este endpoint para cadastrar o primeiro acesso do candidato.
    /// </remarks>
    [HttpPost("register")]
    [ProducesResponseType(typeof(PortalCandidateAuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<PortalCandidateAuthResponse>> Register(
        [FromBody] PortalCandidateRegisterRequest request,
        [FromServices] IPortalCandidateAuthService service,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        try
        {
            var response = await service.RegisterAsync(request, ct);
            return Ok(response);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }
}
