using LiotecnicaHub.Web.Application.Access;
using LiotecnicaHub.Web.Application.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LiotecnicaHub.Web.Controllers;

[ApiController]
[Route("api/hub")]
[Authorize]
public sealed class HubApiController : ControllerBase
{
    private readonly IHubAccessService _access;

    public HubApiController(IHubAccessService access) => _access = access;

    [HttpGet("meus-acessos")]
    public async Task<IActionResult> GetMeusAcessos(CancellationToken ct)
    {
        var email = ResolveEmail();
        if (email is null) return Unauthorized();

        var result = await _access.GetMeusAcessosAsync(email, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpGet("meus-sistemas")]
    public async Task<IActionResult> GetMeusSistemas(CancellationToken ct)
    {
        var email = ResolveEmail();
        if (email is null) return Unauthorized();

        var sistemas = await _access.GetMeusSistemasAsync(email, ct);
        return Ok(sistemas);
    }

    [HttpGet("verificar-acesso-sistema")]
    public async Task<IActionResult> VerificarAcessoSistema([FromQuery] string codigo, CancellationToken ct)
    {
        var email = ResolveEmail();
        if (email is null) return Unauthorized();
        if (string.IsNullOrWhiteSpace(codigo))
            return BadRequest(new { message = "Informe o parâmetro codigo (ex.: portalrh)." });

        var result = await _access.VerificarAcessoSistemaAsync(email, codigo, ct);
        return Ok(result);
    }

    private string? ResolveEmail() =>
        User.FindFirst(HubClaimTypes.Email)?.Value?.Trim().ToLowerInvariant();
}
