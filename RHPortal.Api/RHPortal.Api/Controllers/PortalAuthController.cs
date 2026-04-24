using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Application.Candidaturas;
using RhPortal.Api.Application.Portal;
using RhPortal.Api.Contracts.Candidatura;
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

    /// <summary>
    /// Lista as candidaturas do candidato (histórico server-side com etapa macro por vaga).
    /// </summary>
    /// <remarks>
    /// Recebe o <c>candidatoId</c> via rota — o front deve enviar o Id salvo após login/register.
    /// Retorna lista ordenada da mais recente para a mais antiga.
    /// </remarks>
    [HttpGet("minhas-candidaturas/{candidatoId:guid}")]
    [ProducesResponseType(typeof(IReadOnlyList<CandidaturaResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<CandidaturaResponse>>> MinhasCandidaturas(
        Guid candidatoId,
        [FromServices] ICandidaturaService service,
        CancellationToken ct)
    {
        if (candidatoId == Guid.Empty)
            return BadRequest(new { message = "candidatoId inválido." });

        var list = await service.ListarDoCandidatoAsync(candidatoId, ct);
        return Ok(list);
    }
}
